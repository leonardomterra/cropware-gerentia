import { useMemo, useState } from "react";
import Search from "~icons/ph/magnifying-glass";
import FilterList from "~icons/ph/funnel";
import ChevronDown from "~icons/ph/caret-down";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type SearchableOption } from "@/components/ui/searchable-select";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { cn } from "@/components/ui/utils";
import { FilterCountBadge } from "@/components/ui/FilterCountBadge";
import {
  BOTAO_BARRA,
  ICONE_BOTAO_BARRA,
  PAINEL_ESCURO,
  ROTULO_PAINEL_ESCURO,
  SETA_BOTAO_BARRA,
} from "@/lib/ui-tokens";
import { useIsMobile } from "@/components/ui/use-mobile";
import { useCategories } from "../hooks/useCategories";
import type { ReceiptDirection, ReceiptFilters, ReceiptStatus } from "../types";
import { STATUS_LABEL } from "../constants";

interface ReceiptFiltersBarProps {
  value: ReceiptFilters;
  onChange: (next: ReceiptFilters) => void;
  /**
   * Campos que ficam À VISTA na barra, ao lado da busca (ex.: Centro de Custo).
   * Entram na MESMA grade da busca — grade, e não flex, porque em
   * `minmax(0,1fr)` o conteúdo não consegue alargar a coluna. Num flex a
   * largura mínima do item é o `min-content`, e bastava um nome de centro maior
   * pra a busca encolher.
   */
  campos?: React.ReactNode;
  /** Mais um campo à vista, depois de `campos` na mesma grade. */
  camposExtra?: React.ReactNode;
  /** Botões à direita, encostados no de Filtros (ex.: Ordenar). */
  acoes?: React.ReactNode;
}

const STATUS_OPTIONS: ReceiptStatus[] = [
  "a_pagar",
  "pago",
  "a_receber",
  "recebido",
  "vencido",
  "cancelado",
];

/**
 * Barra de filtros e ações — padrão da seção 26 do `ui-polish-patterns` do Flag
 * Field (ver docs/ADOCAO-DESIGN-FLAGFIELD.md, Etapa C).
 *
 * Duas linhas. Na primeira, os filtros de uso constante como campos diretos,
 * esticando, e os botões de painel encostados à direita. Na segunda (montada
 * por quem usa o componente), as ações.
 *
 * O que fica À VISTA: o que se consulta toda hora. O resto mora no painel, onde
 * ocupa zero espaço quando não está em uso.
 *
 * Os valores vêm de `src/lib/ui-tokens.ts` — importe de lá, não copie a classe.
 */
export function ReceiptFiltersBar({
  value,
  onChange,
  campos,
  camposExtra,
  acoes,
}: ReceiptFiltersBarProps) {
  const { categories } = useCategories();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const set = <K extends keyof ReceiptFilters>(
    key: K,
    v: ReceiptFilters[K],
  ) => {
    onChange({ ...value, [key]: v });
  };

  // Conta CAMPOS de filtro ativos (busca nao conta - ela e visivel).
  const activeCount =
    (value.direction ? 1 : 0) +
    (value.status && value.status.length > 0 ? 1 : 0) +
    (value.category && value.category.length > 0 ? 1 : 0);

  // Cor de fonte mais sutil em todos os campos - bate com o CDM.
  const fieldText = "text-slate-500";

  const statusOptions: SearchableOption[] = useMemo(
    () => STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    [],
  );

  const categoryOptions: SearchableOption[] = useMemo(
    () =>
      categories.map((c) => ({
        value: c.slug,
        label: c.name,
        group: c.group_name ?? "Outras",
      })),
    [categories],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 w-full">
      {/* w-full: sem ele o container encolhe até o conteúdo e os botões não
          chegam na borda direita. */}
      <div
        className={cn(
          "grid flex-1 min-w-0 gap-2 grid-cols-1",
          // Uma coluna por campo à vista. Sem contar `camposExtra`, o terceiro
          // item quebrava linha sozinho numa grade de duas.
          campos && !camposExtra && "sm:grid-cols-2",
          campos && camposExtra && "sm:grid-cols-2 lg:grid-cols-3",
          !campos && camposExtra && "sm:grid-cols-2",
        )}
      >
        <div className="relative">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={value.search ?? ""}
            onChange={(e) => set("search", e.target.value || undefined)}
            placeholder="Buscar por origem ou descrição..."
            className={cn("pl-8 h-9 border-slate-200 shadow-none", fieldText)}
          />
        </div>
        {campos}
        {camposExtra}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(BOTAO_BARRA, "inline-flex items-center rounded-md")}
          >
            <FilterList className={ICONE_BOTAO_BARRA} />
            Filtros
            <FilterCountBadge count={activeCount} />
            <ChevronDown className={SETA_BOTAO_BARRA} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={PAINEL_ESCURO}
          style={
            isMobile
              ? { width: "var(--radix-popover-trigger-width)" }
              : undefined
          }
        >
          {/* Os controles de dentro continuam BRANCOS. Escurecê-los foi testado
              e descartado no Flag Field: texto claro sobre painel escuro dentro
              de outro painel escuro perde contraste. */}
          <div className="space-y-1.5">
            <label className={ROTULO_PAINEL_ESCURO}>Tipo</label>
            <Select
              value={value.direction ?? "all"}
              onValueChange={(v) =>
                set(
                  "direction",
                  v === "all" ? undefined : (v as ReceiptDirection),
                )
              }
            >
              {/* Aqui o campo continua BRANCO, e não no cinza dos demais: sobre o
                  painel escuro, campo branco é a separação mais forte que existe. */}
              <SelectTrigger className={cn("h-9 bg-white", fieldText)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className={ROTULO_PAINEL_ESCURO}>Situação</label>
            <MultiSearchableSelect
              options={statusOptions}
              value={value.status ?? []}
              onValueChange={(arr) =>
                set(
                  "status",
                  arr.length > 0 ? (arr as ReceiptStatus[]) : undefined,
                )
              }
              placeholder="Todos os status"
              searchPlaceholder="Buscar status..."
              multiLabel={(n) => `${n} status`}
            />
          </div>

          <div className="space-y-1.5">
            <label className={ROTULO_PAINEL_ESCURO}>Categoria</label>
            <MultiSearchableSelect
              options={categoryOptions}
              value={value.category ?? []}
              onValueChange={(arr) =>
                set("category", arr.length > 0 ? arr : undefined)
              }
              placeholder="Todas as categorias"
              searchPlaceholder="Buscar categoria..."
              multiLabel={(n) => `${n} categorias`}
            />
          </div>
        </PopoverContent>
      </Popover>

      {acoes}
    </div>
  );
}
