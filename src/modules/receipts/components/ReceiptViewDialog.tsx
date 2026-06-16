import { useState } from "react";
import { toast } from "sonner";
import Pencil from "~icons/material-symbols-light/edit-outline";
import CallMade from "~icons/material-symbols-light/call-made";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { useAuth } from "@/contexts/AuthContext";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import type { Receipt, ReceiptItem } from "../types";
import {
  DOC_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  STATUS_COLOR_SCHEME,
  STATUS_LABEL,
} from "../constants";
import { useCategories } from "../hooks/useCategories";
import { promoteReceiptItem } from "../hooks/useReceipts";
import {
  formatBRL,
  formatDateBR,
  getCategoryLabel,
} from "../utils/receiptFormatters";

interface ReceiptViewDialogProps {
  receipt: Receipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (r: Receipt) => void;
  /** chamado quando um item e' convertido (pra refetch da lista). */
  onChanged?: () => void;
}

/** Linha label + valor lado a lado, hierarquia de cor padrão. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2 border-b border-slate-100 last:border-b-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 break-words">{children}</dd>
    </div>
  );
}

export function ReceiptViewDialog({
  receipt,
  open,
  onOpenChange,
  onEdit,
  onChanged,
}: ReceiptViewDialogProps) {
  const { categories } = useCategories();
  const { user } = useAuth();
  const ccById = new Map((user?.costCenters ?? []).map((c) => [c.id, c]));
  const [pendingPromote, setPendingPromote] = useState<ReceiptItem | null>(null);
  const [promoting, setPromoting] = useState(false);

  if (!receipt) return null;

  const directionLabel =
    receipt.direction === "income" ? "Entrada (receita)" : "Saída (despesa)";
  const items = receipt.items ?? [];
  const hasItems = items.length > 0;
  const canPromote = (receipt.item_count ?? 0) >= 2;

  async function confirmPromote() {
    if (!receipt || !pendingPromote) return;
    setPromoting(true);
    try {
      await promoteReceiptItem(receipt.id, pendingPromote.id);
      toast.success("Item convertido em lançamento.");
      setPendingPromote(null);
      onChanged?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível converter.",
      );
    } finally {
      setPromoting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Lançamento</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <div>
            <Field label="Tipo">{directionLabel}</Field>
            <Field label="Status">
              <Badge colorScheme={STATUS_COLOR_SCHEME[receipt.status]}>
                {STATUS_LABEL[receipt.status]}
              </Badge>
            </Field>
            <Field label="Valor">
              <span
                className={
                  receipt.direction === "income"
                    ? "text-emerald-700 font-medium tabular-nums"
                    : "text-slate-900 font-medium tabular-nums"
                }
              >
                {receipt.direction === "income" ? "+" : ""}
                {formatBRL(receipt.total_value)}
              </span>
            </Field>
            <Field label="Origem">{receipt.vendor || "—"}</Field>
            <Field label="CNPJ">{receipt.vendor_cnpj || "—"}</Field>
            {!hasItems && (
              <Field label="Categoria">
                {getCategoryLabel(receipt.category, categories)}
              </Field>
            )}
            <Field label="Descrição">{receipt.description || "—"}</Field>
          </div>

          <div>
            <Field label="Data da transação">
              {receipt.transaction_date
                ? formatDateBR(receipt.transaction_date)
                : "—"}
            </Field>
            <Field label="Vencimento">
              {receipt.due_date ? formatDateBR(receipt.due_date) : "—"}
            </Field>
            <Field label="Pago em">
              {receipt.paid_date ? formatDateBR(receipt.paid_date) : "—"}
            </Field>
            <Field label="Forma de pagamento">
              {receipt.payment_method
                ? PAYMENT_METHOD_LABEL[receipt.payment_method]
                : "—"}
            </Field>
            <Field label="Tipo de documento">
              {DOC_TYPE_LABEL[receipt.doc_type]}
            </Field>
            <Field label="Número da NF">
              {receipt.invoice_number || "—"}
            </Field>
            <Field label="Origem">
              <span className="capitalize">{receipt.source}</span>
            </Field>
          </div>
        </div>

        {hasItems && (
          <div className="mt-3">
            <p className="text-sm text-slate-500 mb-2">Itens</p>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Descrição</th>
                    <th className="text-left px-3 py-2 font-medium">Categoria</th>
                    <th className="text-left px-3 py-2 font-medium">Centro</th>
                    <th className="text-right px-3 py-2 font-medium">Valor</th>
                    <th className="px-3 py-2 w-9"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const cc = it.cost_center_id
                      ? ccById.get(it.cost_center_id)
                      : null;
                    return (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">
                          {it.description || "—"}
                          {it.quantity != null && it.unit_value != null ? (
                            <span className="text-xs text-slate-400">
                              {" "}
                              · {it.quantity} × {formatBRL(it.unit_value)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {getCategoryLabel(it.category, categories)}
                        </td>
                        <td className="px-3 py-2">
                          {cc ? (
                            <span className="inline-flex items-center gap-1.5">
                              <CostCenterChip
                                icon={cc.icon}
                                color={cc.color}
                                className="size-5 shrink-0"
                              />
                              <span className="text-slate-600 truncate">
                                {cc.name}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {formatBRL(it.total_value)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ActionIconButton
                            icon={CallMade}
                            label="Converter em lançamento"
                            disabled={!canPromote}
                            onClick={() => setPendingPromote(it)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td
                      className="px-3 py-2 font-medium text-slate-700"
                      colSpan={3}
                    >
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                      {formatBRL(receipt.total_value)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {receipt.notes ? (
          <div className="mt-2">
            <p className="text-sm text-slate-500 mb-1">Observações</p>
            <p className="text-sm text-slate-900 whitespace-pre-wrap bg-slate-50 rounded p-3 border border-slate-100">
              {receipt.notes}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
          <Button
            onClick={() => {
              onOpenChange(false);
              onEdit(receipt);
            }}
            className="gap-1"
          >
            <Pencil className="size-4" />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmActionDialog
        open={pendingPromote !== null}
        onOpenChange={(o) => {
          if (!o) setPendingPromote(null);
        }}
        title="Converter em Lançamento"
        description={
          pendingPromote
            ? `Converter "${pendingPromote.description || getCategoryLabel(pendingPromote.category, categories)}" (${formatBRL(pendingPromote.total_value)}) em um lançamento separado? Ele sai deste lançamento e o total é recalculado.`
            : ""
        }
        confirmLabel="Converter"
        cancelLabel="Cancelar"
        loading={promoting}
        loadingLabel="Convertendo..."
        onConfirm={confirmPromote}
      />
    </Dialog>
  );
}
