import { useMemo } from "react";
import { Search, X } from "lucide-react";
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
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/searchable-select";
import { cn } from "@/components/ui/utils";
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
}

const STATUS_OPTIONS: ReceiptStatus[] = [
  "a_pagar",
  "pago",
  "a_receber",
  "recebido",
  "vencido",
  "cancelado",
];

export function ReceiptFiltersBar({ value, onChange, trailing }: ReceiptFiltersBarProps) {
  const { categories } = useCategories();

  const set = <K extends keyof ReceiptFilters>(
    key: K,
    v: ReceiptFilters[K],
  ) => {
    onChange({ ...value, [key]: v });
  };

  const clearAll = () => onChange({});
  const hasAny = Object.values(value).some((v) => v !== undefined && v !== "");

  // Cor de fonte mais sutil em todos os campos - bate com o CDM (texto
  // do SelectValue + placeholder do Input em cinza medio em vez do
  // slate-900 default). Aplica via className no Trigger/Input.
  const fieldText = "text-slate-500";

  const statusOptions: SearchableOption[] = useMemo(
    () => [
      { value: "all", label: "Todos os status" },
      ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    ],
    [],
  );

  const categoryOptions: SearchableOption[] = useMemo(
    () => [
      { value: "all", label: "Todas as categorias" },
      ...categories.map((c) => ({
        value: c.slug,
        label: c.name,
        group: c.group_name ?? "Outras",
      })),
    ],
    [categories],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[200px] max-w-sm">
        <div className="relative">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={value.search ?? ""}
            onChange={(e) =>
              set("search", e.target.value || undefined)
            }
            placeholder="Buscar por fornecedor ou descrição..."
            className={cn("pl-8 h-9 bg-white", fieldText)}
          />
        </div>
      </div>

      <div className="min-w-[160px]">
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

      <div className="w-[180px]">
        <SearchableSelect
          options={statusOptions}
          value={value.status ?? "all"}
          onValueChange={(v) =>
            set("status", v === "all" ? undefined : (v as ReceiptStatus))
          }
          placeholder="Todos os status"
          searchPlaceholder="Buscar status..."
        />
      </div>

      <div className="w-[200px]">
        <SearchableSelect
          options={categoryOptions}
          value={value.category ?? "all"}
          onValueChange={(v) =>
            set("category", v === "all" ? undefined : v)
          }
          placeholder="Todas as categorias"
          searchPlaceholder="Buscar categoria..."
        />
      </div>

      <Input
        type="date"
        value={value.from ?? ""}
        onChange={(e) => set("from", e.target.value || undefined)}
        className={cn("h-9 w-[150px] bg-white", fieldText)}
        title="Data inicial"
      />

      <Input
        type="date"
        value={value.to ?? ""}
        onChange={(e) => set("to", e.target.value || undefined)}
        className={cn("h-9 w-[150px] bg-white", fieldText)}
        title="Data final"
      />

      {hasAny ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-slate-500 h-9"
        >
          <X className="size-4 mr-1" />
          Limpar
        </Button>
      ) : null}

      {/* Slot trailing - empurrado pra direita via ml-auto. Flex group
          pra aceitar varios botoes (ex: CC dropdown + sort dropdown). */}
      {trailing ? (
        <div className="ml-auto flex items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}
