import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import type { FarmCategory } from "@/modules/receipts/types";

/**
 * Gerenciador de Categorias (Fase A: read-only). Lista os presets
 * agrupados por group_name + custom do usuario. CRUD (criar/editar/
 * excluir custom, ocultar/reativar preset) vem na Fase B junto com a
 * migration (created_by_user_id + farm_category_hidden).
 */
export function CategoriesManager() {
  const { categories, loading, error } = useCategories();

  // Agrupa por group_name preservando ordem (hook ja ordena por
  // group_name + name). Despesas e receitas juntas no mesmo grupo
  // visual ("Receitas" ja e' um group_name proprio).
  const groups = useMemo(() => {
    const out: { name: string; items: FarmCategory[] }[] = [];
    for (const c of categories) {
      const g = c.group_name || "Outras";
      const last = out[out.length - 1];
      if (last && last.name === g) last.items.push(c);
      else out.push({ name: g, items: [c] });
    }
    return out;
  }, [categories]);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-slate-500">
          Categorias usadas pra classificar lançamentos. Os presets cobrem
          os casos mais comuns; em breve você poderá criar, editar e
          desativar categorias.
        </p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.name}>
              <h3 className="text-xs font-medium text-slate-500 mb-2">
                {group.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {group.items.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-white rounded-lg border border-slate-200 px-3 py-2.5 flex items-center gap-2.5"
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || "#64748b" }}
                    />
                    <span className="text-sm text-slate-700 truncate flex-1">
                      {cat.name}
                    </span>
                    <Badge
                      size="compact"
                      colorScheme={cat.direction === "income" ? "emerald" : "slate"}
                    >
                      {cat.direction === "income" ? "receita" : "despesa"}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
