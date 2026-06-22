import { useMemo, useState } from "react";
import Search from "~icons/material-symbols-light/search";
import FilterList from "~icons/material-symbols-light/filter-list";
import X from "~icons/material-symbols-light/close";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type SearchableOption } from "@/components/ui/searchable-select";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { cn } from "@/components/ui/utils";
import { useIsMobile } from "@/components/ui/use-mobile";
import { useCategories } from "../hooks/useCategories";
import type {
  ReceiptDirection,
  ReceiptFilters,
  ReceiptStatus,
} from "../types";
import { STATUS_LABEL } from "../constants";

interface ReceiptFiltersBarProps {
  value: ReceiptFilters;
  onChange: (next: ReceiptFilters) => void;
  /** Conteudo extra rendered no final da row de filtros (ex: dropdown
   *  de Centro de Custo). Fica na mesma flex line dos campos. */
  trailing?: React.ReactNode;
  /** Classe extra no botão "Filtrar" (ex.: sombra no teste de Lançamentos). */
  triggerClassName?: string;
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
 * Barra de filtros minimalista: so a BUSCA fica visivel; tipos/status/
 * categorias moram num popover atras do botao "Filtrar" (com badge de
 * contagem quando ha filtro ativo). Menos caixas na tela.
 */
export function ReceiptFiltersBar({ value, onChange, trailing, triggerClassName }: ReceiptFiltersBarProps) {
  const { categories } = useCategories();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const set = <K extends keyof ReceiptFilters>(
    key: K,
    v: ReceiptFilters[K],
  ) => {
    onChange({ ...value, [key]: v });
  };

  const clearFilters = () =>
    onChange({ ...(value.search ? { search: value.search } : {}) });

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <div className="relative">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={value.search ?? ""}
            onChange={(e) =>
              set("search", e.target.value || undefined)
            }
            placeholder="Buscar por origem ou descrição..."
            className={cn(
              "pl-8 h-9 bg-white border-slate-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.07)]",
              fieldText,
            )}
          />
        </div>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-9 w-full sm:w-auto shrink-0 inline-flex items-center justify-start gap-1.5 px-3 rounded border border-slate-300 bg-white text-base md:text-sm text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300",
              triggerClassName,
            )}
          >
            <FilterList className="size-4 shrink-0" />
            Filtrar
            {activeCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center size-5 rounded-full bg-zinc-800 text-white text-xs tabular-nums">
                {activeCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="p-3 space-y-3"
          style={isMobile ? { width: "var(--radix-popover-trigger-width)" } : undefined}
        >
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">Tipo</p>
            <Select
              value={value.direction ?? "all"}
              onValueChange={(v) =>
                set("direction", v === "all" ? undefined : (v as ReceiptDirection))
              }
            >
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
            <p className="text-xs text-slate-500">Status</p>
            <MultiSearchableSelect
              options={statusOptions}
              value={value.status ?? []}
              onValueChange={(arr) =>
                set("status", arr.length > 0 ? (arr as ReceiptStatus[]) : undefined)
              }
              placeholder="Todos os status"
              searchPlaceholder="Buscar status..."
              multiLabel={(n) => `${n} status`}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">Categoria</p>
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

          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="w-full text-slate-500 h-8"
            >
              <X className="size-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Slot trailing (ex: CC dropdown). */}
      {trailing ? (
        <div className="ml-auto flex items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}
