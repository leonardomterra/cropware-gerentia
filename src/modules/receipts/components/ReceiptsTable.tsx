import Eye from "~icons/material-symbols-light/visibility-outline";
import Pencil from "~icons/material-symbols-light/edit-outline";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import Notes from "~icons/material-symbols-light/notes";
import ListIcon from "~icons/material-symbols-light/format-list-bulleted";
import ReceiptLong from "~icons/material-symbols-light/receipt-long-outline";
import CreditCard from "~icons/material-symbols-light/credit-card-outline";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { Receipt } from "../types";
import {
  DOC_TYPE_LABEL,
  DOC_TYPE_PREFIX,
  STATUS_COLOR_SCHEME,
  STATUS_LABEL,
  isCreditCard,
} from "../constants";
import { useCategories } from "../hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import {
  formatBRL,
  formatDateBR,
  getCategoryLabel,
} from "../utils/receiptFormatters";

interface ReceiptsTableProps {
  receipts: Receipt[];
  onView: (r: Receipt) => void;
  onEdit: (r: Receipt) => void;
  onDelete: (r: Receipt) => void;
  /** IDs selecionados (Set pra lookup O(1)). */
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: () => void;
  /** Só a ação "Ver detalhes" (sem descrição/editar/excluir). */
  viewOnly?: boolean;
}

/**
 * Tabela de lançamentos no padrão CDM PlotManagement: header branco com
 * border-b leve, células com py-3 (mais respiro vertical), texto em
 * hierarquia de cor slate (primary 700, secondary 600, emphasis 900),
 * coluna "Ações" com botões outline w-9 h-9 (ver / editar / excluir).
 * Suporta seleção em lote via checkbox header + por linha.
 */
export function ReceiptsTable({
  receipts,
  onView,
  onEdit,
  onDelete,
  selectedIds,
  onToggleOne,
  onToggleAll,
  viewOnly = false,
}: ReceiptsTableProps) {
  const { categories } = useCategories();
  const { user } = useAuth();
  const ccById = new Map((user?.costCenters ?? []).map((c) => [c.id, c] as const));
  const allSelected = receipts.length > 0 && receipts.every((r) => selectedIds.has(r.id));

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-slate-200">
            <TableHead className="w-[50px] py-3 pl-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[120px]">
              Data
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[120px]">
              Vencimento
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[180px]">
              Origem
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[150px]">
              Categoria
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[160px]">
              Centro de Custo
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[150px]">
              Status
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[120px] text-right">
              Valor
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[160px] text-right pr-4">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.length === 0 ? (
            <TableRow className="hover:bg-transparent border-b-0 text-slate-300">
              <TableCell className="py-3 pl-4" />
              <TableCell className="py-3 text-sm">—</TableCell>
              <TableCell className="py-3 text-sm">—</TableCell>
              <TableCell className="py-3 text-sm">—</TableCell>
              <TableCell className="py-3 text-sm">—</TableCell>
              <TableCell className="py-3 text-sm">—</TableCell>
              <TableCell className="py-3 text-sm">—</TableCell>
              <TableCell className="py-3 text-sm text-right">—</TableCell>
              <TableCell className="py-3 text-sm text-right pr-4">—</TableCell>
            </TableRow>
          ) : null}
          {receipts.map((r) => {
            const isSelected = selectedIds.has(r.id);
            // Com itens: se TODOS partilham a mesma categoria/CC, mostra ela;
            // so' vira "Vários" quando realmente diverge (independente p/ cat e CC).
            // Itens ativos (desmembrados não entram na derivação de categoria/CC).
            const its = (r.items ?? []).filter((i) => !i.promoted_to_receipt_id);
            const hasItems = r.item_count > 0 && its.length > 0;
            const uCats = hasItems ? [...new Set(its.map((i) => i.category))] : [];
            const uCcs = hasItems ? [...new Set(its.map((i) => i.cost_center_id))] : [];
            const catMulti = uCats.length > 1;
            const ccMulti = uCcs.length > 1;
            const catSlug = hasItems ? uCats[0] ?? null : r.category;
            const ccId = hasItems ? uCcs[0] ?? null : r.cost_center_id;
            const cc = ccId ? ccById.get(ccId) : null;
            return (
              <TableRow
                key={r.id}
                className={cn(
                  "border-b border-slate-200 last:border-b-0",
                  isSelected && "bg-slate-50",
                )}
              >
                <TableCell className="py-3 pl-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleOne(r.id)}
                    aria-label={`Selecionar lançamento de ${r.vendor ?? "origem"}`}
                  />
                </TableCell>
                <TableCell className="py-3 text-sm font-normal text-slate-600 whitespace-nowrap">
                  {formatDateBR(r.transaction_date)}
                </TableCell>
                <TableCell className={cn("py-3 text-sm font-normal whitespace-nowrap", r.due_date ? "text-slate-600" : "text-slate-400")}>
                  {r.due_date ? formatDateBR(r.due_date) : "—"}
                </TableCell>
                <TableCell className="py-3">
                  <span
                    className={cn(
                      "text-sm font-normal flex items-center gap-1.5 min-w-0",
                      (r.vendor ?? r.description) ? "text-slate-700" : "text-slate-400",
                    )}
                  >
                    {DOC_TYPE_PREFIX[r.doc_type] === "F" ? (
                      <CreditCard className="size-4 shrink-0 text-slate-400" />
                    ) : DOC_TYPE_PREFIX[r.doc_type] === "N" ? (
                      <ReceiptLong className="size-4 shrink-0 text-slate-400" />
                    ) : null}
                    {isCreditCard(r.payment_method) && (
                      <CreditCard
                        className="size-4 shrink-0 text-violet-500"
                        title="Cartão de crédito"
                      />
                    )}
                    <span className="truncate">
                      {r.vendor ? r.vendor.toUpperCase() : (r.description ? r.description.toUpperCase() : "—")}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="py-3 text-sm font-normal text-slate-600">
                  {catMulti ? "Vários" : getCategoryLabel(catSlug, categories)}
                </TableCell>
                <TableCell className="py-3">
                  {ccMulti ? (
                    <span className="text-sm text-slate-500">Vários</span>
                  ) : cc ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <CostCenterChip icon={cc.icon} color={cc.color} className="size-5 shrink-0" />
                      <span className="text-sm text-slate-600 truncate">{cc.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  {/* Previsto: 1 badge só, em cor própria (laranja) — sinaliza
                      que é projeção, não conta firmada. Lançamento itemizado
                      ganha um badge "Tipo · N itens" ao lado. */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge colorScheme={r.is_estimated ? "orange" : STATUS_COLOR_SCHEME[r.status]}>
                      {r.is_estimated ? "Previsto" : STATUS_LABEL[r.status]}
                    </Badge>
                    {hasItems && (
                      <Badge
                        colorScheme="white"
                        title={`${DOC_TYPE_LABEL[r.doc_type]} — ${r.item_count} ${r.item_count === 1 ? "item" : "itens"}`}
                      >
                        <ListIcon />
                        {r.item_count}
                      </Badge>
                    )}
                    {r.counts_in_total === false && (
                      <Badge colorScheme="slate" title="Não entra nos totais">
                        Informativo
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right text-sm font-medium tabular-nums">
                  <span
                    className={cn(
                      r.is_estimated || r.counts_in_total === false
                        ? "text-slate-400"
                        : r.direction === "income"
                          ? "text-emerald-700"
                          : "text-slate-900",
                    )}
                  >
                    {r.is_estimated ? "~" : r.direction === "income" ? "+" : "−"}
                    {formatBRL(r.total_value)}
                  </span>
                </TableCell>
                <TableCell className="py-3 text-right pr-2">
                  <div className="flex gap-2 justify-end items-center">
                    {!viewOnly && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <ActionIconButton
                            icon={Notes}
                            label="Descrição"
                            title=""
                            className={
                              r.description?.trim()
                                ? undefined
                                : "text-slate-300 hover:text-slate-400"
                            }
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {r.description?.trim() || "Sem descrição"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <ActionIconButton
                      icon={Eye}
                      label="Ver detalhes"
                      onClick={() => onView(r)}
                    />
                    {!viewOnly && (
                      <ActionIconButton
                        icon={Pencil}
                        label="Editar"
                        onClick={() => onEdit(r)}
                      />
                    )}
                    {!viewOnly && (
                      <ActionIconButton
                        icon={Trash2}
                        label="Excluir"
                        tone="danger"
                        onClick={() => onDelete(r)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
