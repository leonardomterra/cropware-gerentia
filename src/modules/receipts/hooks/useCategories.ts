import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import type { FarmCategory, FarmCategoryGroup } from "../types";
import { groupOf, resolveGroups, visibleCategories } from "../categoryGroups";

interface UseCategoriesResult {
  /** Escolhiveis num lancamento: sem preset desativado, sem grupo desativado. */
  categories: FarmCategory[];
  /**
   * TODAS as categorias visiveis pela RLS, inclusive as desativadas pela org.
   * Use pra RESOLVER ROTULO de lancamento antigo (`getCategoryLabel`): o
   * lancamento continua apontando pra categoria mesmo depois de desativada, e
   * sem ela na lista o nome cairia num "pretty" derivado do slug.
   */
  allCategories: FarmCategory[];
  loading: boolean;
  error: string | null;
}

const CATEGORY_COLS =
  "id, organization_id, slug, name, code, color, icon_lucide, direction, is_preset, group_name";

/**
 * Categorias que o usuario pode ESCOLHER num lancamento. Le direto via
 * supabase-js com a sessao dele (RLS: preset global OU da org).
 *
 * Ja vem resolvido - quem consome nao filtra nada:
 * - preset desativado pela org (farm_category_hidden) sai da lista;
 * - categoria de grupo desativado sai junto;
 * - `group_name` vem com o ROTULO que a org escolheu, nao a chave crua.
 *
 * Pra gerenciar (ver os ocultos, reativar, editar) use `useManageCategories`.
 */
export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<FarmCategory[]>([]);
  const [allCategories, setAllCategories] = useState<FarmCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [catsRes, hiddenRes, groupsRes] = await Promise.all([
        supabase.from("farm_categories").select(CATEGORY_COLS),
        supabase.from("farm_category_hidden").select("category_id"),
        supabase
          .from("farm_category_groups")
          .select(
            "id, organization_id, group_key, name, hidden, sort_order, is_custom, code, direction",
          ),
      ]);

      if (!mounted) return;
      if (catsRes.error) {
        setError(catsRes.error.message);
        setCategories([]);
        setAllCategories([]);
        setLoading(false);
        return;
      }

      const all = (catsRes.data as FarmCategory[]) ?? [];
      const hiddenIds = new Set(
        (hiddenRes.data ?? []).map((r) => r.category_id as string),
      );
      const groups = resolveGroups(
        all,
        (groupsRes.data as FarmCategoryGroup[]) ?? [],
      );

      setError(null);
      setAllCategories(
        all.map((c) => ({ ...c, group_name: groupOf(c, groups).name })),
      );
      setCategories(visibleCategories(all, hiddenIds, groups));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { categories, allCategories, loading, error };
}
