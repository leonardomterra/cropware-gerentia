import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  STATUSES_BY_DIRECTION,
  STATUS_LABEL,
} from "../constants";
import {
  parseBRLInput,
  todayISO,
} from "../utils/receiptFormatters";
import { createReceipt, updateReceipt } from "../hooks/useReceipts";
import { useCategories } from "../hooks/useCategories";
import type {
  Receipt,
  ReceiptDirection,
  ReceiptDocType,
  ReceiptPaymentMethod,
  ReceiptStatus,
} from "../types";

interface PrefillFromScan {
  values: Partial<FormState>;
  attachment_key: string;
  attachment_mime: string;
  ai_confidence?: number | null;
  ai_raw?: unknown;
}

interface ReceiptFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt?: Receipt | null;
  prefill?: PrefillFromScan | null;
  onSaved: () => void;
}

interface FormState {
  direction: ReceiptDirection;
  doc_type: ReceiptDocType;
  status: ReceiptStatus;
  total_value: string;
  vendor: string;
  category: string;
  description: string;
  payment_method: ReceiptPaymentMethod | "";
  transaction_date: string;
  due_date: string;
  paid_date: string;
  invoice_number: string;
  notes: string;
}

const EMPTY: FormState = {
  direction: "expense",
  doc_type: "cupom",
  status: "a_pagar",
  total_value: "",
  vendor: "",
  category: "",
  description: "",
  payment_method: "",
  transaction_date: todayISO(),
  due_date: "",
  paid_date: "",
  invoice_number: "",
  notes: "",
};

export function ReceiptFormDialog({
  open,
  onOpenChange,
  receipt,
  prefill,
  onSaved,
}: ReceiptFormDialogProps) {
  const isEdit = !!receipt;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { categories } = useCategories();

  useEffect(() => {
    if (!open) return;
    if (receipt) {
      setForm({
        direction: receipt.direction,
        doc_type: receipt.doc_type,
        status: receipt.status,
        total_value: String(receipt.total_value).replace(".", ","),
        vendor: receipt.vendor ?? "",
        category: receipt.category ?? "",
        description: receipt.description ?? "",
        payment_method: receipt.payment_method ?? "",
        transaction_date: receipt.transaction_date ?? "",
        due_date: receipt.due_date ?? "",
        paid_date: receipt.paid_date ?? "",
        invoice_number: receipt.invoice_number ?? "",
        notes: receipt.notes ?? "",
      });
    } else if (prefill) {
      setForm({ ...EMPTY, ...prefill.values });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [open, receipt, prefill]);

  const availableStatuses = useMemo(
    () => STATUSES_BY_DIRECTION[form.direction],
    [form.direction],
  );

  // Auto-ajusta status quando trocar direction se status atual nao se aplica
  useEffect(() => {
    if (!availableStatuses.includes(form.status)) {
      setForm((f) => ({ ...f, status: availableStatuses[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.direction]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.direction === form.direction),
    [categories, form.direction],
  );

  const showDueDate =
    form.status === "a_pagar" ||
    form.status === "a_receber" ||
    form.status === "vencido";
  const showPaidDate = form.status === "pago" || form.status === "recebido";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = parseBRLInput(form.total_value);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Informe um valor valido (ex: 1234,56).");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doc_type: form.doc_type,
        direction: form.direction,
        status: form.status,
        total_value: value,
        currency: "BRL" as const,
        transaction_date: form.transaction_date || null,
        due_date: showDueDate ? form.due_date || null : null,
        paid_date: showPaidDate ? form.paid_date || null : null,
        vendor: form.vendor.trim() || null,
        category: form.category || null,
        description: form.description.trim() || null,
        payment_method:
          form.payment_method === "" ? null : form.payment_method,
        invoice_number: form.invoice_number.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (isEdit && receipt) {
        await updateReceipt(receipt.id, payload);
        toast.success("Lançamento atualizado");
      } else if (prefill) {
        await createReceipt({
          ...payload,
          attachment_key: prefill.attachment_key,
          attachment_mime: prefill.attachment_mime,
          source: "photo",
          ai_confidence: prefill.ai_confidence ?? null,
          ai_raw: prefill.ai_raw ?? null,
        });
        toast.success("Lançamento criado");
      } else {
        await createReceipt(payload);
        toast.success("Lançamento criado");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar lancamento" : "Novo lancamento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.direction}
                onValueChange={(v) =>
                  set("direction", v as ReceiptDirection)
                }
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as ReceiptStatus)}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="total_value">Valor (R$)</Label>
            <Input
              id="total_value"
              value={form.total_value}
              onChange={(e) => set("total_value", e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="vendor">
              {form.direction === "expense" ? "Fornecedor" : "Pagador"}
            </Label>
            <Input
              id="vendor"
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)}
              placeholder={
                form.direction === "expense"
                  ? "Ex: Posto Vale do Sol"
                  : "Ex: Cooperativa XYZ"
              }
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.category || "none"}
                onValueChange={(v) => set("category", v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de doc.</Label>
              <Select
                value={form.doc_type}
                onValueChange={(v) => set("doc_type", v as ReceiptDocType)}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOC_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="transaction_date">Data do lancamento</Label>
              <Input
                id="transaction_date"
                type="date"
                value={form.transaction_date}
                onChange={(e) => set("transaction_date", e.target.value)}
                className="mt-1"
              />
            </div>
            {showDueDate ? (
              <div>
                <Label htmlFor="due_date">Vencimento</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set("due_date", e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : null}
            {showPaidDate ? (
              <div>
                <Label htmlFor="paid_date">
                  {form.direction === "expense" ? "Pago em" : "Recebido em"}
                </Label>
                <Input
                  id="paid_date"
                  type="date"
                  value={form.paid_date}
                  onChange={(e) => set("paid_date", e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Forma de pgto</Label>
              <Select
                value={form.payment_method || "none"}
                onValueChange={(v) =>
                  set(
                    "payment_method",
                    v === "none" ? "" : (v as ReceiptPaymentMethod),
                  )
                }
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informado</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="invoice_number">Numero da NF</Label>
              <Input
                id="invoice_number"
                value={form.invoice_number}
                onChange={(e) => set("invoice_number", e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descricao</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ex: Diesel S10 - 50L"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notes">Observacoes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="default" disabled={submitting}>
              {submitting ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
