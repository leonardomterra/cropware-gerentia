import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  FarmCategory,
  FarmCategoryGroup,
  ReceiptDirection,
} from "@/modules/receipts/types";
import {
  DEFAULT_CUSTOM_GROUP,
  compareGroups,
  newGroupKey,
  resolveGroups,
  type ResolvedGroup,
} from "@/modules/receipts/categoryGroups";

/** Categoria + flag de ocultacao pela org (so usado no gerenciador). */
export interface ManageCategory extends FarmCategory {
  hidden: boolean;
}

export interface CreateCategoryInput {
  name: string;
  direction: ReceiptDirection;
  /** chave do grupo (group_key) em que a categoria vai aparecer. */
  group_name: string;
  /** codigo contabil opcional. */
  code?: string | null;
}

const CATEGORY_COLS =
  "id, organization_id, slug, name, code, color, icon_lucide, direction, is_preset, group_name, created_by_user_id";
const GROUP_COLS =
  "id, organization_id, group_key, name, hidden, sort_order, is_custom, code, direction";

/** slug ASCII a partir do nome. Unico dentro de unique(organization_id, slug). */
function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "")
      .slice(0, 40) || "cat"
  );
}

function isDuplicate(message: string): boolean {
  return /duplicate|unique/i.test(message);
}

/**
 * Gerenciador de categorias e grupos (Configuracoes). Ve TUDO: presets
 * (inclusive os desativados, pra reativar) + as da org. CRUD via supabase-js
 * + RLS, sem edge function:
 * - categoria: create/update/remove so nas da propria org (owner/admin);
 * - preset: setHidden desativa/reativa pela org (farm_category_hidden);
 * - grupo: createGroup/saveGroup/setGroupHidden/removeGroup em
 *   farm_category_groups. Grupo preset so aceita rename e hidden - a linha
 *   nasce na hora que a org mexe nele pela primeira vez (upsert).
 */
export function useManageCategories() {
  const { user, isAdmin } = useAuth();
  const [categories, setCategories] = useState<ManageCategory[]>([]);
  const [groupRows, setGroupRows] = useState<FarmCategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [catsRes, hiddenRes, groupsRes] = await Promise.all([
      supabase
        .from("farm_categories")
        .select(CATEGORY_COLS)
        .order("group_name", { ascending: true, nullsFirst: false })
        .order("name"),
      supabase.from("farm_category_hidden").select("category_id"),
      supabase.from("farm_category_groups").select(GROUP_COLS),
    ]);
    if (catsRes.error) {
      setError(catsRes.error.message);
      setCategories([]);
      setGroupRows([]);
      setLoading(false);
      return;
    }
    const hiddenIds = new Set(
      (hiddenRes.data ?? []).map((r) => r.category_id as string),
    );
    const list = ((catsRes.data as FarmCategory[]) ?? []).map((c) => ({
      ...c,
      hidden: hiddenIds.has(c.id),
    }));
    setCategories(list);
    setGroupRows((groupsRes.data as FarmCategoryGroup[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Grupos resolvidos (linha da org quando existe, senao o preset cru). */
  const groups = useMemo(
    () => resolveGroups(categories, groupRows),
    [categories, groupRows],
  );

  // ------------------------------------------------------------- categorias

  const create = useCallback(
    async (input: CreateCategoryInput): Promise<boolean> => {
      if (!user) return false;
      const { error: e } = await supabase.from("farm_categories").insert({
        organization_id: user.organizationId,
        created_by_user_id: user.id,
        slug: slugify(input.name),
        name: input.name.trim(),
        code: input.code?.trim() || null,
        direction: input.direction,
        is_preset: false,
        group_name: input.group_name || DEFAULT_CUSTOM_GROUP,
      });
      if (e) {
        setError(
          isDuplicate(e.message)
            ? "Já existe uma categoria com esse nome nesta conta."
            : e.message,
        );
        return false;
      }
      await load();
      return true;
    },
    [user, load],
  );

  const update = useCallback(
    async (
      id: string,
      patch: { name?: string; code?: string | null },
    ): Promise<boolean> => {
      const { error: e } = await supabase
        .from("farm_categories")
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.code !== undefined
            ? { code: patch.code?.trim() || null }
            : {}),
        })
        .eq("id", id);
      if (e) {
        setError(e.message);
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: e } = await supabase
        .from("farm_categories")
        .delete()
        .eq("id", id);
      if (e) {
        setError(e.message);
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  const setHidden = useCallback(
    async (categoryId: string, hidden: boolean): Promise<boolean> => {
      if (!user) return false;
      if (hidden) {
        const { error: e } = await supabase
          .from("farm_category_hidden")
          .insert({
            organization_id: user.organizationId,
            category_id: categoryId,
            hidden_by: user.id,
          });
        if (e) {
          setError(e.message);
          return false;
        }
      } else {
        const { error: e } = await supabase
          .from("farm_category_hidden")
          .delete()
          .eq("category_id", categoryId)
          .eq("organization_id", user.organizationId);
        if (e) {
          setError(e.message);
          return false;
        }
      }
      await load();
      return true;
    },
    [user, load],
  );

  // ----------------------------------------------------------------- grupos

  /** Rotulo ja usado por outro grupo? (compara contra presets tambem.) */
  const groupNameTaken = useCallback(
    (name: string, exceptKey?: string): boolean => {
      const n = name.trim().toLowerCase();
      for (const g of groups.values()) {
        if (g.key === exceptKey) continue;
        if (g.name.trim().toLowerCase() === n) return true;
      }
      return false;
    },
    [groups],
  );

  const createGroup = useCallback(
    async (
      name: string,
      direction: ReceiptDirection,
      code?: string | null,
    ): Promise<boolean> => {
      if (!user) return false;
      const clean = name.trim();
      if (groupNameTaken(clean)) {
        setError("Já existe um grupo com esse nome.");
        return false;
      }
      const { error: e } = await supabase.from("farm_category_groups").insert({
        organization_id: user.organizationId,
        created_by_user_id: user.id,
        group_key: newGroupKey(),
        name: clean,
        code: code?.trim() || null,
        is_custom: true,
        direction,
      });
      if (e) {
        setError(
          isDuplicate(e.message)
            ? "Já existe um grupo com esse nome."
            : e.message,
        );
        return false;
      }
      await load();
      return true;
    },
    [user, load, groupNameTaken],
  );

  /**
   * Renomear/ocultar grupo preset cria a linha de override na hora (a org
   * nunca tinha mexido nele). Grupo da org so faz update.
   */
  const upsertGroup = useCallback(
    async (
      group: ResolvedGroup,
      patch: { name?: string; hidden?: boolean; code?: string | null },
    ): Promise<boolean> => {
      if (!user) return false;
      if (group.row) {
        const { error: e } = await supabase
          .from("farm_category_groups")
          .update(patch)
          .eq("id", group.row.id);
        if (e) {
          setError(
            isDuplicate(e.message)
              ? "Já existe um grupo com esse nome."
              : e.message,
          );
          return false;
        }
      } else {
        const { error: e } = await supabase
          .from("farm_category_groups")
          .insert({
            organization_id: user.organizationId,
            created_by_user_id: user.id,
            group_key: group.key,
            name: patch.name ?? group.name,
            code: patch.code !== undefined ? patch.code : group.code,
            hidden: patch.hidden ?? group.hidden,
            sort_order: group.sortOrder,
            direction: group.direction,
            is_custom: false,
          });
        if (e) {
          setError(
            isDuplicate(e.message)
              ? "Já existe um grupo com esse nome."
              : e.message,
          );
          return false;
        }
      }
      await load();
      return true;
    },
    [user, load],
  );

  /** Salva rotulo/codigo do grupo. No preset intocado a linha nasce aqui. */
  const saveGroup = useCallback(
    async (
      group: ResolvedGroup,
      patch: { name: string; code?: string | null },
    ): Promise<boolean> => {
      const clean = patch.name.trim();
      if (groupNameTaken(clean, group.key)) {
        setError("Já existe um grupo com esse nome.");
        return false;
      }
      return upsertGroup(group, {
        name: clean,
        code: patch.code?.trim() || null,
      });
    },
    [upsertGroup, groupNameTaken],
  );

  const setGroupHidden = useCallback(
    (group: ResolvedGroup, hidden: boolean) => upsertGroup(group, { hidden }),
    [upsertGroup],
  );

  /**
   * Exclui grupo criado pela org junto com as categorias dele. Grupo preset
   * nao e' excluivel - so desativavel (o preset e' global, de todo mundo).
   * Lancamentos antigos guardam o slug e continuam intactos.
   */
  const removeGroup = useCallback(
    async (group: ResolvedGroup): Promise<boolean> => {
      if (!user || !group.row || !group.isCustom) return false;
      const { error: catErr } = await supabase
        .from("farm_categories")
        .delete()
        .eq("organization_id", user.organizationId)
        .eq("group_name", group.key);
      if (catErr) {
        setError(catErr.message);
        return false;
      }
      const { error: e } = await supabase
        .from("farm_category_groups")
        .delete()
        .eq("id", group.row.id);
      if (e) {
        setError(e.message);
        return false;
      }
      await load();
      return true;
    },
    [user, load],
  );

  return {
    categories,
    groups,
    loading,
    error,
    canManage: isAdmin,
    create,
    update,
    remove,
    setHidden,
    createGroup,
    saveGroup,
    setGroupHidden,
    removeGroup,
    compareGroups,
    reload: load,
  };
}
