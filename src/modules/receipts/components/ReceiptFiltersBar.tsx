import { useMemo } from "react";
import Search from "~icons/ph/magnifying-glass";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type SearchableOption } from "@/components/ui/searchable-select";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { cn } from "@/components/ui/utils";
import { BarraDeTela, type CampoDaBarra } from "@/components/ui/BarraDeTela";
import { ROTULO_PAINEL_ESCURO } from "@/lib/ui-tokens";
import { useCategories } from "../hooks/useCategories";
import type { ReceiptDirection, ReceiptFilters, ReceiptStatus } from "../types";
import { STATUS_LABEL } from "../constants";

interface ReceiptFiltersBarProps {
  value: ReceiptFilters;
  onChange: (next: ReceiptFilters) => void;
  /**
   * Campos à vista ao lado da busca. Cada um traz um RÓTULO porque no celular
   * ele desce para o painel, onde o valor sozinho não se explica — e um `ativo`
   * porque, escondido, ele precisa aparecer no badge. Ver `BarraDeTela`.
   */
  campos?: CampoDaBarra[];
  /** Botões à direita, encostados no de Filtros (ex.: Ordenar). */
  acoes?: React.ReactNode;
  /** A ação principal (Novo). No celular ocupa a largura da linha. */
  acaoPrincipal?: React.ReactNode;
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
 * A barra de Lançamentos / Notas / Faturas.
 *
 * Desde 25/08/2026 é um ADAPTADOR: o layout (e a regra do celular) mora em
 * `components/ui/BarraDeTela`, e o que sobra aqui é o que só esta tela sabe —
 * quais filtros existem e como cada um se desenha.
 *
 * Os valores de estilo vêm de `src/lib/ui-tokens.ts` — importe de lá, não copie
 * a classe.
 */
export function ReceiptFiltersBar({
  value,
  onChange,
  campos,
  acoes,
  acaoPrincipal,
}: ReceiptFiltersBarProps) {
  const { categories } = useCategories();

  const set = <K extends keyof ReceiptFilters>(
    key: K,
    v: ReceiptFilters[K],
  ) => {
    onChange({ ...value, [key]: v });
  };

  // Conta os filtros DO PAINEL. Os campos à vista contam sozinhos, e só quando
  // estão escondidos — quem faz essa soma é a BarraDeTela.
  const filtrosDoPainel =
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
    <BarraDeTela
      busca={
        <div className="relative">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={value.search ?? ""}
            onChange={(e) => set("search", e.target.value || undefined)}
            placeholder="Buscar por origem ou descrição..."
            className={cn("pl-8 h-9 border-slate-200 shadow-none", fieldText)}
          />
        </div>
      }
      campos={campos}
      filtrosAtivos={filtrosDoPainel}
      acoes={acoes}
      acaoPrincipal={acaoPrincipal}
      painel={
        <>
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
        </>
      }
    />
  );
}
