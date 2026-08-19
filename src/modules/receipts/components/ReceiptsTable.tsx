import MoreVert from "~icons/ph/dots-three-vertical";
import ListIcon from "~icons/ph/list-bullets";
import ReceiptLong from "~icons/ph/receipt";
import CreditCard from "~icons/ph/credit-card";
// Duotone só no indicador de cartão: ele marca UMA condição da linha, e o
// segundo tom o separa dos ícones de tipo de documento, que são estruturais.
import CreditCardDuotone from "~icons/ph/credit-card-duotone";
import InfoIcon from "~icons/ph/info";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { BOTAO_ACOES } from "@/lib/ui-tokens";
import { useOrgPeople } from "@/modules/team/hooks/useOrgPeople";
import { useReceiptPermissions } from "../hooks/useReceiptPermissions";
import { useCategories } from "../hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import {
  formatAmountBR,
  formatDateShortBR,
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
  /** Só a ação "Ver" (sem descrição/editar/excluir). */
  viewOnly?: boolean;
  /** Mensagem quando não há registros. */
  emptyLabel?: string;
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
  emptyLabel = "Nenhum lançamento neste mês.",
}: ReceiptsTableProps) {
  // allCategories (e nao `categories`): aqui so resolvemos ROTULO de
  // lancamento ja gravado, que pode apontar pra categoria desativada.
  const { allCategories: categories } = useCategories();
  const { nameOf } = useOrgPeople();
  const { canEdit } = useReceiptPermissions();
  const { user } = useAuth();
  const ccById = new Map(
    (user?.costCenters ?? []).map((c) => [c.id, c] as const),
  );
  const allSelected =
    receipts.length > 0 && receipts.every((r) => selectedIds.has(r.id));

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-slate-200">
            <TableHead className="w-[44px] py-3 pl-4">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[80px]">
              Data
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[80px]">
              Venc.
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[180px]">
              Origem
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[130px]">
              Categoria
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[150px]">
              Centro de Custo
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[130px]">
              Status
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[110px] text-right whitespace-nowrap">
              Valor R$
            </TableHead>
            <TableHead className="font-medium text-sm py-3 w-[70px] text-right pr-4">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.length === 0 ? (
            <TableRow className="hover:bg-transparent border-b-0">
              <TableCell
                colSpan={9}
                className="py-12 text-center text-sm text-slate-400"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}
          {receipts.map((r) => {
            const isSelected = selectedIds.has(r.id);
            // Com itens: se TODOS partilham a mesma categoria/CC, mostra ela;
            // so' vira "Vários" quando realmente diverge (independente p/ cat e CC).
            // Itens ativos (desmembrados não entram na derivação de categoria/CC).
            const its = (r.items ?? []).filter(
              (i) => !i.promoted_to_receipt_id,
            );
            const hasItems = r.item_count > 0 && its.length > 0;
            const uCats = hasItems
              ? [...new Set(its.map((i) => i.category))]
              : [];
            const uCcs = hasItems
              ? [...new Set(its.map((i) => i.cost_center_id))]
              : [];
            const catMulti = uCats.length > 1;
            const ccMulti = uCcs.length > 1;
            const catSlug = hasItems ? (uCats[0] ?? null) : r.category;
            const ccId = hasItems ? (uCcs[0] ?? null) : r.cost_center_id;
            const cc = ccId ? ccById.get(ccId) : null;
            // Textos truncáveis: guardados p/ reusar no tooltip (leitura do valor completo).
            const origem = r.vendor
              ? r.vendor.toUpperCase()
              : r.description
                ? r.description.toUpperCase()
                : "—";
            const catLabel = catMulti
              ? "Vários"
              : getCategoryLabel(catSlug, categories);
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
                <TableCell className="py-3 text-sm font-normal text-slate-600 whitespace-nowrap tabular-nums">
                  {formatDateShortBR(r.transaction_date)}
                </TableCell>
                <TableCell
                  className={cn(
                    "py-3 text-sm font-normal whitespace-nowrap tabular-nums",
                    r.due_date ? "text-slate-600" : "text-slate-400",
                  )}
                >
                  {r.due_date ? formatDateShortBR(r.due_date) : "—"}
                </TableCell>
                <TableCell className="py-3">
                  <span
                    className={cn(
                      "text-sm font-normal flex items-center gap-1.5 min-w-0",
                      // 1ª linha da coluna que identifica a linha: o tom mais
                      // forte. As demais colunas seguem no tom da tabela — num
                      // grid com cabeçalho, subir todas ao 900 pesa a página.
                      (r.vendor ?? r.description)
                        ? "text-slate-900"
                        : "text-slate-500",
                    )}
                  >
                    {/* Ícone do TIPO de documento: tooltip próprio explicando o
                        que ele significa (Nota fiscal / Recibo / Cupom / Fatura). */}
                    {(DOC_TYPE_PREFIX[r.doc_type] === "F" ||
                      DOC_TYPE_PREFIX[r.doc_type] === "N") && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex shrink-0 text-slate-400">
                            {DOC_TYPE_PREFIX[r.doc_type] === "F" ? (
                              <CreditCard className="size-4" />
                            ) : (
                              <ReceiptLong className="size-4" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {DOC_TYPE_LABEL[r.doc_type]}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isCreditCard(r.payment_method) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex shrink-0 text-violet-500">
                            <CreditCardDuotone className="size-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Cartão de crédito
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate">{origem}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {origem}
                      </TooltipContent>
                    </Tooltip>
                  </span>
                  {nameOf(r.created_by) && (
                    <span className="block text-sm text-slate-500 truncate mt-0.5">
                      Lançado por {nameOf(r.created_by)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-sm font-normal text-slate-600">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block truncate">{catLabel}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {catLabel}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="py-3">
                  {ccMulti ? (
                    <span className="text-sm text-slate-500">Vários</span>
                  ) : cc ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <CostCenterChip
                        icon={cc.icon}
                        color={cc.color}
                        className="size-5 shrink-0"
                      />
                      {/* O nome trunca: tooltip pra ler completo (o chip em si
                          não precisa — o nome dele já está aqui do lado). */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-slate-600 truncate">
                            {cc.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{cc.name}</TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  {/* Previsto: 1 badge só, em cor própria (laranja) — sinaliza
                      que é projeção, não conta firmada. Lançamento itemizado
                      ganha um badge "Tipo · N itens" ao lado. */}
                  <div className="flex items-center gap-1.5">
                    <Badge
                      colorScheme={
                        r.is_estimated
                          ? "orange"
                          : (STATUS_COLOR_SCHEME[r.status] ?? "slate")
                      }
                    >
                      {r.is_estimated ? "Previsto" : STATUS_LABEL[r.status]}
                    </Badge>
                    {hasItems && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge colorScheme="white">
                            <ListIcon />
                            {r.item_count}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {DOC_TYPE_LABEL[r.doc_type]} — {r.item_count}{" "}
                          {r.item_count === 1 ? "item" : "itens"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right text-sm font-medium tabular-nums">
                  <div className="flex items-center justify-end gap-1.5">
                    {r.counts_in_total === false && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex text-slate-400">
                            <InfoIcon className="size-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Informativo — não entra nos totais
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span
                      className={cn(
                        r.is_estimated || r.counts_in_total === false
                          ? "text-slate-400"
                          : r.direction === "income"
                            ? "text-emerald-700"
                            : "text-slate-900",
                      )}
                    >
                      {r.is_estimated
                        ? "~"
                        : r.direction === "income"
                          ? "+"
                          : "−"}
                      {formatAmountBR(r.total_value)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right pr-4">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Ações"
                          title="Ações"
                          className={cn(
                            BOTAO_ACOES,
                            "size-9 inline-flex items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-slate-300",
                          )}
                        >
                          <MoreVert className="size-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
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
                            variant="destructive"
                            onSelect={() => onDelete(r)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
