import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { FarmCategory, ReceiptDirection } from "@/modules/receipts/types";

/** Categoria + flag de ocultacao pela org (so usado no gerenciador). */
export interface ManageCategory extends FarmCategory {
  hidden: boolean;
}

export interface CreateCategoryInput {
  name: string;
  direction: ReceiptDirection;
  /** grupo (group_name) em que a categoria custom vai aparecer. */
  group_name: string;
}

/** slug ASCII a partir do nome + sufixo do user pra garantir unicidade
 *  dentro de unique(organization_id, slug) entre users da mesma org. */
function slugify(name: string, userId: string): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "")
      .slice(0, 32) || "cat";
  return `${base}_${userId.slice(0, 8)}`;
}

/**
 * Gerenciador de categorias (Configuracoes). Ve TUDO: presets (inclusive
 * ocultos, pra reativar) + custom do user. CRUD via supabase-js + RLS:
 * - create/update/remove: so categorias custom do proprio user.
 * - setHidden: oculta/reativa preset pela org (farm_category_hidden).
 */
export function useManageCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ManageCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [catsRes, hiddenRes] = await Promise.all([
      supabase
        .from("farm_categories")
        .select(
          "id, organization_id, slug, name, color, icon_lucide, direction, is_preset, group_name, created_by_user_id",
        )
        .order("group_name", { ascending: true, nullsFirst: false })
        .order("name"),
      supabase.from("farm_category_hidden").select("category_id"),
    ]);
    if (catsRes.error) {
      setError(catsRes.error.message);
      setCategories([]);
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
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (input: CreateCategoryInput): Promise<boolean> => {
      if (!user) return false;
      const { error: e } = await supabase.from("farm_categories").insert({
        organization_id: user.organizationId,
        created_by_user_id: user.id,
        slug: slugify(input.name, user.id),
        name: input.name.trim(),
        direction: input.direction,
        is_preset: false,
        group_name: input.group_name || "Minhas Categorias",
      });
      if (e) {
        setError(
          e.message.includes("duplicate")
            ? "Você já tem uma categoria com esse nome."
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
    async (id: string, patch: { name?: string }): Promise<boolean> => {
      const { error: e } = await supabase
        .from("farm_categories")
        .update(patch)
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

  return {
    categories,
    loading,
    error,
    create,
    update,
    remove,
    setHidden,
    reload: load,
  };
}
