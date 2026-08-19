import ArrowDownLeft from "~icons/ph/arrow-down-left";
import ArrowUpRight from "~icons/ph/arrow-up-right";
import MoreVertical from "~icons/ph/dots-three-vertical";
import ListIcon from "~icons/ph/list-bullets";
import ReceiptLong from "~icons/ph/receipt";
import CreditCard from "~icons/ph/credit-card";
// Duotone só no indicador de cartão: ele marca UMA condição da linha, e o
// segundo tom o separa dos ícones de tipo de documento, que são estruturais.
import CreditCardDuotone from "~icons/ph/credit-card-duotone";
import InfoIcon from "~icons/ph/info";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import { Badge } from "@/components/ui/badge";
import type { Receipt } from "../types";
import {
  DOC_TYPE_LABEL,
  DOC_TYPE_PREFIX,
  STATUS_COLOR_SCHEME,
  STATUS_LABEL,
  isCreditCard,
} from "../constants";
import { BOTAO_ACOES } from "@/lib/ui-tokens";
import { useOrgPeople } from "@/modules/team/hooks/useOrgPeople";
import { useReceiptPermissions } from "../hooks/useReceiptPermissions";
import { useCategories } from "../hooks/useCategories";
import {
  formatBRL,
  formatDateBR,
  getCategoryLabel,
} from "../utils/receiptFormatters";

interface ReceiptsCardsProps {
  receipts: Receipt[];
  onView: (r: Receipt) => void;
  onEdit: (r: Receipt) => void;
  onDelete: (r: Receipt) => void;
  /** Só a ação "Ver" (sem editar/excluir). */
  viewOnly?: boolean;
  /** Mensagem quando não há registros. */
  emptyLabel?: string;
}

export function ReceiptsCards({
  receipts,
  onView,
  onEdit,
  onDelete,
  viewOnly = false,
  emptyLabel = "Nenhum lançamento neste mês.",
}: ReceiptsCardsProps) {
  const { categories } = useCategories();
  const { nameOf } = useOrgPeople();
  const { canEdit } = useReceiptPermissions();
  return (
    <div className="flex flex-col gap-2">
      {receipts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : null}
      {receipts.map((r) => (
        <div
          key={r.id}
          className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3"
        >
          <div className="flex-1 min-w-0">
            {/* Valor em destaque, na própria linha (mobile). */}
            <div className="flex items-center gap-1.5">
              {r.counts_in_total === false && (
                <span
                  className="inline-flex text-slate-400"
                  title="Informativo — não entra nos totais"
                >
                  <InfoIcon className="size-4" />
                </span>
              )}
              <p
                className={cn(
                  "font-semibold tabular-nums whitespace-nowrap text-base",
                  r.is_estimated || r.counts_in_total === false
                    ? "text-slate-400"
                    : r.direction === "income"
                      ? "text-emerald-700"
                      : "text-slate-900",
                )}
              >
                {r.is_estimated ? "~" : r.direction === "income" ? "+" : "−"}
                {formatBRL(r.total_value)}
              </p>
            </div>
            <p className="font-medium text-slate-900 text-sm flex items-center gap-1.5 min-w-0 mt-0.5">
              {DOC_TYPE_PREFIX[r.doc_type] === "F" ? (
                <CreditCard className="size-4 shrink-0 text-slate-400" />
              ) : DOC_TYPE_PREFIX[r.doc_type] === "N" ? (
                <ReceiptLong className="size-4 shrink-0 text-slate-400" />
              ) : null}
              {isCreditCard(r.payment_method) && (
                <CreditCardDuotone
                  className="size-4 shrink-0 text-violet-500"
                  title="Cartão de crédito"
                />
              )}
              <span className="truncate">
                {r.vendor
                  ? r.vendor.toUpperCase()
                  : r.description
                    ? r.description.toUpperCase()
                    : "(sem origem)"}
              </span>
            </p>
            {/* 2ª linha da escada: slate-700. Ver a tabela de tons em
                docs/ADOCAO-DESIGN-FLAGFIELD.md, Etapa G. */}
            <p className="text-sm text-slate-700 mt-0.5 truncate">
              {formatDateBR(r.transaction_date)}
              {(() => {
                const its = (r.items ?? []).filter(
                  (i) => !i.promoted_to_receipt_id,
                );
                const hasItems = r.item_count > 0 && its.length > 0;
                if (hasItems) {
                  const uCats = [...new Set(its.map((i) => i.category))];
                  if (uCats.length > 1) return " - Vários";
                  return uCats[0]
                    ? ` - ${getCategoryLabel(uCats[0], categories)}`
                    : "";
                }
                return r.category
                  ? ` - ${getCategoryLabel(r.category, categories)}`
                  : "";
              })()}
            </p>
            {nameOf(r.created_by) && (
              <p className="text-sm text-slate-500 mt-0.5 truncate">
                Lançado por {nameOf(r.created_by)}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <Badge
                colorScheme={r.direction === "income" ? "emerald" : "slate"}
                className="px-0 w-6"
                title={r.direction === "income" ? "Entrada" : "Saída"}
              >
                {r.direction === "income" ? (
                  <ArrowDownLeft />
                ) : (
                  <ArrowUpRight />
                )}
              </Badge>
              <Badge
                colorScheme={
                  r.is_estimated
                    ? "orange"
                    : (STATUS_COLOR_SCHEME[r.status] ?? "slate")
                }
              >
                {r.is_estimated ? "Previsto" : STATUS_LABEL[r.status]}
              </Badge>
              {r.item_count > 0 && (r.items?.length ?? 0) > 0 && (
                <Badge
                  colorScheme="white"
                  title={`${DOC_TYPE_LABEL[r.doc_type]} — ${r.item_count} ${r.item_count === 1 ? "item" : "itens"}`}
                >
                  <ListIcon />
                  {r.item_count}
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(BOTAO_ACOES, "size-9 shrink-0 -mt-1")}
                aria-label="Ações"
              >
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              <DropdownMenuItem onSelect={() => onView(r)}>
                Ver
              </DropdownMenuItem>
              {!viewOnly && canEdit(r) && (
                <DropdownMenuItem onSelect={() => onEdit(r)}>
                  Editar
                </DropdownMenuItem>
              )}
              {!viewOnly && canEdit(r) && (
                <DropdownMenuItem
                  onSelect={() => onDelete(r)}
                  variant="destructive"
                >
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
