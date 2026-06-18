import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Receipt } from "../types";
import {
  DOC_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  STATUS_COLOR_SCHEME,
  STATUS_LABEL,
} from "../constants";
import { useCategories } from "../hooks/useCategories";
import { ReceiptItemsTable } from "./ReceiptItemsTable";
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

/** Linha label + valor lado a lado, hierarquia de cor padrão. Sem divisória.
 *  `wide` faz o campo ocupar a linha inteira (2 colunas) — bom p/ textos longos. */
function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[140px_1fr] gap-3 py-1.5",
        wide && "sm:col-span-2",
      )}
    >
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
}: ReceiptViewDialogProps) {
  const { categories } = useCategories();

  if (!receipt) return null;

  const directionLabel =
    receipt.direction === "income" ? "Entrada (receita)" : "Saída (despesa)";
  const items = receipt.items ?? [];
  const hasItems = items.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Lançamento</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <Field label="Tipo">{directionLabel}</Field>
          <Field label="Status">
            <Badge colorScheme={STATUS_COLOR_SCHEME[receipt.status]}>
              {STATUS_LABEL[receipt.status]}
            </Badge>
          </Field>

          <Field label="Origem" wide>{receipt.vendor || "—"}</Field>

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
          <Field label="Data da transação">
            {receipt.transaction_date ? formatDateBR(receipt.transaction_date) : "—"}
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
          <Field label="Número da NF">{receipt.invoice_number || "—"}</Field>
          <Field label="CNPJ">{receipt.vendor_cnpj || "—"}</Field>
          <Field label="Fonte">
            <span className="capitalize">{receipt.source}</span>
          </Field>
          {!hasItems && (
            <Field label="Categoria">
              {getCategoryLabel(receipt.category, categories)}
            </Field>
          )}

          <Field label="Descrição" wide>{receipt.description || "—"}</Field>
        </div>

        {hasItems && (
          <div className="mt-3">
            <p className="text-sm text-slate-500 mb-2">Itens</p>
            {/* Só leitura: converter/desagrupar agora vive no dialog de edição. */}
            <ReceiptItemsTable receipt={receipt} editable={false} />
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
          >
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
