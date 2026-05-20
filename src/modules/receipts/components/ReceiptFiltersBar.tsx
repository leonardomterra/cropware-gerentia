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
}

const STATUS_OPTIONS: ReceiptStatus[] = [
  "a_pagar",
  "pago",
  "a_receber",
  "recebido",
  "vencido",
  "cancelado",
];

export function ReceiptFiltersBar({ value, onChange }: ReceiptFiltersBarProps) {
  const { categories } = useCategories();

  const set = <K extends keyof ReceiptFilters>(
    key: K,
    v: ReceiptFilters[K],
  ) => {
    onChange({ ...value, [key]: v });
  };

  const clearAll = () => onChange({});
  const hasAny = Object.values(value).some((v) => v !== undefined && v !== "");

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[180px] max-w-sm">
        <label className="block text-sm text-slate-500 mb-1">Busca</label>
        <div className="relative">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={value.search ?? ""}
            onChange={(e) =>
              set("search", e.target.value || undefined)
            }
            placeholder="Fornecedor, descricao..."
            className="pl-8 h-9"
          />
        </div>
      </div>

      <div className="min-w-[140px]">
        <label className="block text-sm text-slate-500 mb-1">Tipo</label>
        <Select
          value={value.direction ?? "all"}
          onValueChange={(v) =>
            set("direction", v === "all" ? undefined : (v as ReceiptDirection))
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[140px]">
        <label className="block text-sm text-slate-500 mb-1">Status</label>
        <Select
          value={value.status ?? "all"}
          onValueChange={(v) =>
            set("status", v === "all" ? undefined : (v as ReceiptStatus))
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[160px]">
        <label className="block text-sm text-slate-500 mb-1">Categoria</label>
        <Select
          value={value.category ?? "all"}
          onValueChange={(v) =>
            set("category", v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm text-slate-500 mb-1">De</label>
        <Input
          type="date"
          value={value.from ?? ""}
          onChange={(e) => set("from", e.target.value || undefined)}
          className="h-9 w-[140px]"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-500 mb-1">Ate</label>
        <Input
          type="date"
          value={value.to ?? ""}
          onChange={(e) => set("to", e.target.value || undefined)}
          className="h-9 w-[140px]"
        />
      </div>

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
    </div>
  );
}
