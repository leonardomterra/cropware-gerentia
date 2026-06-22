import { useState } from "react";
import { cn } from "@/components/ui/utils";
import { useIsMobile } from "@/components/ui/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CostCentersManager } from "../components/CostCentersManager";
import { CategoriesManager } from "../components/CategoriesManager";

type SubTab = "centros" | "cat-despesa" | "cat-receita";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "centros", label: "Centros de Custo" },
  { id: "cat-despesa", label: "Categorias de Despesa" },
  { id: "cat-receita", label: "Categorias de Receita" },
];

/**
 * Pagina de Configuracoes - central de organizacao financeira.
 * Sub-tabs internas: Centros de Custo + Categorias. Cada uma e' um
 * "manager" autonomo (CRUD proprio). A aba substituiu a antiga "Centros"
 * e absorveu o gerenciamento de categorias (decisao 2026-05-30).
 */
export default function ConfiguracoesPage() {
  const [active, setActive] = useState<SubTab>("centros");
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      {/* Mobile: Select (3 labels longos não cabem como tabs). Desktop: sub-tabs
          pill underline estilo leve (nao confundir com a tab bar principal). */}
      {isMobile ? (
        <Select value={active} onValueChange={(v) => setActive(v as SubTab)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUB_TABS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="border-b border-slate-200 flex items-center gap-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "relative px-3 py-2 text-sm transition-colors -mb-px",
                active === t.id
                  ? "text-slate-900 font-medium"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
              {active === t.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700" />
              )}
            </button>
          ))}
        </div>
      )}

      {active === "centros" ? (
        <CostCentersManager />
      ) : (
        <CategoriesManager
          key={active}
          direction={active === "cat-receita" ? "income" : "expense"}
        />
      )}
    </div>
  );
}
