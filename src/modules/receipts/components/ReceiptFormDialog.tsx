import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { AiSuggestButton } from "@/components/ui/AiSuggestButton";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import Plus from "~icons/material-symbols-light/add";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import CallMade from "~icons/material-symbols-light/call-made";
import OpenInNew from "~icons/material-symbols-light/open-in-new";
import { useAuth } from "@/contexts/AuthContext";
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  STATUSES_BY_DIRECTION,
  STATUS_LABEL,
} from "../constants";
import {
  formatBRL,
  formatBRLInput,
  parseBRLInput,
  todayISO,
} from "../utils/receiptFormatters";
import {
  createReceipt,
  promoteReceiptItem,
  suggestCategory,
  updateReceipt,
} from "../hooks/useReceipts";
import { useCategories } from "../hooks/useCategories";
import type {
  ItemRow,
  Receipt,
  ReceiptDirection,
  ReceiptDocType,
  ReceiptItemInput,
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
  /** Habilita o editor de itens (split). Em Lançamentos = false (simples);
   *  nas páginas Notas e Recibos / Faturas = true. */
  allowItems?: boolean;
  /** doc_type semeado ao criar (ex.: "fatura" na página de Faturas). */
  defaultDocType?: ReceiptDocType;
  /** Títulos do dialog (por contexto de aba). */
  titleNew?: string;
  titleEdit?: string;
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
  cost_center_id: string;
  items: ItemRow[];
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
  cost_center_id: "",
  items: [],
};

function newItemRow(): ItemRow {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: "",
    unit_value: "",
    total_value: "",
    category: "",
    cost_center_id: "",
  };
}

export function ReceiptFormDialog({
  open,
  onOpenChange,
  receipt,
  prefill,
  onSaved,
  allowItems = true,
  defaultDocType,
  titleNew = "Novo Lançamento",
  titleEdit = "Editar Lançamento",
}: ReceiptFormDialogProps) {
  const isEdit = !!receipt;
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Qual campo esta inferindo categoria via IA ("header" ou item.key).
  const [suggestingKey, setSuggestingKey] = useState<string | null>(null);
  // Desagrupar item (converter em lançamento) — confirmação.
  const [pendingConvert, setPendingConvert] = useState<ItemRow | null>(null);
  const [converting, setConverting] = useState(false);
  const { categories } = useCategories();
  const { user } = useAuth();
  const ccs = user?.costCenters ?? [];
  const defaultCCId = ccs.find((c) => c.is_default)?.id || ccs[0]?.id || "";

  // Lançamento itemizado sendo editado num contexto SEM editor de itens
  // (Lançamentos): vira resumo (total read-only + atalho "gerenciar itens").
  const summaryMode = !allowItems && isEdit && (receipt?.item_count ?? 0) > 0;

  // Itens já salvos (têm id no banco) podem ser desagrupados; itens novos não.
  // Só dá pra desagrupar com 2+ itens ativos (não esvaziar o lançamento).
  const savedItemIds = useMemo(
    () => new Set((receipt?.items ?? []).map((i) => i.id)),
    [receipt],
  );
  const canConvert = isEdit && (receipt?.item_count ?? 0) >= 2;

  useEffect(() => {
    if (!open) return;
    if (receipt) {
      const brl = (n: number) =>
        n.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      setForm({
        direction: receipt.direction,
        doc_type: receipt.doc_type,
        status: receipt.status,
        total_value: brl(receipt.total_value),
        vendor: receipt.vendor ?? "",
        category: receipt.category ?? "",
        description: receipt.description ?? "",
        payment_method: receipt.payment_method ?? "",
        transaction_date: receipt.transaction_date ?? "",
        due_date: receipt.due_date ?? "",
        paid_date: receipt.paid_date ?? "",
        invoice_number: receipt.invoice_number ?? "",
        notes: receipt.notes ?? "",
        cost_center_id:
          receipt.cost_center_id ??
          receipt.items?.[0]?.cost_center_id ??
          defaultCCId,
        items: allowItems
          ? (receipt.items ?? [])
              .filter((it) => !it.promoted_to_receipt_id)
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((it) => ({
                key: it.id,
                description: it.description ?? "",
                quantity: it.quantity != null ? String(it.quantity) : "",
                unit_value: it.unit_value != null ? brl(it.unit_value) : "",
                total_value: brl(it.total_value),
                category: it.category ?? "",
                cost_center_id: it.cost_center_id ?? "",
              }))
          : [],
      });
    } else if (prefill) {
      setForm({
        ...EMPTY,
        cost_center_id: defaultCCId,
        ...(defaultDocType ? { doc_type: defaultDocType } : {}),
        ...prefill.values,
        items: allowItems ? prefill.values.items ?? [] : [],
      });
    } else {
      setForm({
        ...EMPTY,
        cost_center_id: defaultCCId,
        ...(defaultDocType ? { doc_type: defaultDocType } : {}),
        // Páginas itemizadas começam com 1 linha de item pra o editor aparecer.
        items: allowItems ? [newItemRow()] : [],
      });
    }
    setError(null);
  }, [open, receipt, prefill, defaultCCId, allowItems, defaultDocType]);

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

  // Agrupa categorias por group_name preservando ordem do array filtrado
  // (que ja vem ordenado por group_name asc + name asc do supabase).
  const groupedCategories = useMemo(() => {
    const groups: { name: string; items: typeof filteredCategories }[] = [];
    for (const c of filteredCategories) {
      const g = c.group_name || "Outras";
      const last = groups[groups.length - 1];
      if (last && last.name === g) last.items.push(c);
      else groups.push({ name: g, items: [c] });
    }
    return groups;
  }, [filteredCategories]);

  const catOptions = useMemo(
    () =>
      groupedCategories.flatMap((g) =>
        g.items.map((c) => ({ value: c.slug, label: c.name, group: g.name })),
      ),
    [groupedCategories],
  );

  const hasItems = allowItems && form.items.length > 0;
  const itemsTotal = useMemo(
    () =>
      form.items.reduce((s, it) => {
        const v = parseBRLInput(it.total_value);
        return s + (Number.isFinite(v) ? v : 0);
      }, 0),
    [form.items],
  );

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, newItemRow()] }));
  }
  function removeItem(key: string) {
    setForm((f) => ({ ...f, items: f.items.filter((it) => it.key !== key) }));
  }
  function updateItem(key: string, patch: Partial<ItemRow>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, ...patch };
        // auto-total quando Qtd E Valor unit. presentes (nao sobrescreve
        // edicao direta do Total).
        if ("quantity" in patch || "unit_value" in patch) {
          const q = parseBRLInput(next.quantity);
          const u = parseBRLInput(next.unit_value);
          if (Number.isFinite(q) && q > 0 && Number.isFinite(u) && u > 0) {
            next.total_value = formatBRLInput(String(Math.round(q * u * 100)));
          }
        }
        return next;
      }),
    }));
  }

  // Inferir categoria via IA (fornecedor + descrição -> melhor categoria).
  async function runSuggest(key: "header" | string, description: string) {
    if (catOptions.length === 0) return;
    setSuggestingKey(key);
    try {
      const slug = await suggestCategory({
        vendor: form.vendor.trim() || null,
        description: description.trim() || null,
        direction: form.direction,
        categories: catOptions.map((o) => ({ slug: o.value, name: o.label })),
      });
      if (!slug) {
        toast.info("Não consegui sugerir uma categoria com confiança.");
      } else if (key === "header") {
        set("category", slug);
      } else {
        updateItem(key, { category: slug });
      }
    } catch {
      toast.error("Falha ao sugerir categoria.");
    } finally {
      setSuggestingKey(null);
    }
  }

  // Desagrupar: converte o item (já salvo) num lançamento próprio. Opera no
  // backend pelo id do item; fecha o dialog e refetch (o estado local fica
  // defasado após o split).
  async function confirmConvert() {
    if (!receipt || !pendingConvert) return;
    setConverting(true);
    try {
      await promoteReceiptItem(receipt.id, pendingConvert.key);
      toast.success("Item convertido em lançamento.");
      setPendingConvert(null);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível converter.",
      );
    } finally {
      setConverting(false);
    }
  }

  const showDueDate =
    form.status === "a_pagar" ||
    form.status === "a_receber" ||
    form.status === "vencido";
  const showPaidDate = form.status === "pago" || form.status === "recebido";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Resumo de itemizado (Lançamentos): PATCH só do cabeçalho, sem mexer em
    // total/categoria/CC/itens (que são derivados dos itens).
    if (summaryMode && receipt) {
      setSubmitting(true);
      try {
        await updateReceipt(receipt.id, {
          doc_type: form.doc_type,
          direction: form.direction,
          status: form.status,
          transaction_date: form.transaction_date || null,
          due_date: showDueDate ? form.due_date || null : null,
          paid_date: showPaidDate ? form.paid_date || null : null,
          vendor: form.vendor.trim().toUpperCase() || null,
          description: form.description.trim() || null,
          payment_method:
            form.payment_method === "" ? null : form.payment_method,
          invoice_number: form.invoice_number.trim() || null,
          notes: form.notes.trim() || null,
        });
        toast.success("Lançamento atualizado");
        onSaved();
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Monta itens (split) ou valida o valor unico (caso simples).
    let itemsPayload: ReceiptItemInput[] | undefined;
    if (hasItems) {
      itemsPayload = form.items
        .map((it, i) => {
          const total = parseBRLInput(it.total_value);
          const q = parseBRLInput(it.quantity);
          const u = parseBRLInput(it.unit_value);
          return {
            description: it.description.trim() || null,
            category: it.category || null,
            // Um CC pro documento inteiro: aplica o CC do cabeçalho a cada item.
            cost_center_id: form.cost_center_id || null,
            quantity: Number.isFinite(q) ? q : null,
            unit_value: Number.isFinite(u) ? u : null,
            total_value: total,
            position: i,
          } as ReceiptItemInput;
        })
        .filter((it) => Number.isFinite(it.total_value) && it.total_value > 0);
      if (itemsPayload.length === 0) {
        setError("Adicione ao menos um item com valor, ou remova os itens.");
        return;
      }
    } else {
      const value = parseBRLInput(form.total_value);
      if (!Number.isFinite(value) || value <= 0) {
        setError("Informe um valor valido (ex: 1234,56).");
        return;
      }
    }

    // Se editava um lançamento itemizado e o usuario removeu todos os itens,
    // manda items:[] pro backend voltar a header-only. (Só quando allowItems.)
    const wasItemized = allowItems && isEdit && (receipt?.item_count ?? 0) > 0;
    const itemsKey = hasItems
      ? { items: itemsPayload }
      : wasItemized
        ? { items: [] as ReceiptItemInput[] }
        : {};

    setSubmitting(true);
    try {
      const value = hasItems ? 0 : parseBRLInput(form.total_value);
      const payload = {
        doc_type: form.doc_type,
        direction: form.direction,
        status: form.status,
        total_value: value,
        currency: "BRL" as const,
        transaction_date: form.transaction_date || null,
        due_date: showDueDate ? form.due_date || null : null,
        paid_date: showPaidDate ? form.paid_date || null : null,
        vendor: form.vendor.trim().toUpperCase() || null,
        category: hasItems ? null : form.category || null,
        description: form.description.trim() || null,
        payment_method:
          form.payment_method === "" ? null : form.payment_method,
        invoice_number: form.invoice_number.trim() || null,
        notes: form.notes.trim() || null,
        cost_center_id: hasItems ? null : form.cost_center_id || null,
        ...itemsKey,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? titleEdit : titleNew}</DialogTitle>
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
            {hasItems || summaryMode ? (
              <Input
                id="total_value"
                value={formatBRL(summaryMode ? receipt!.total_value : itemsTotal)}
                readOnly
                disabled
                className="mt-1"
              />
            ) : (
              <Input
                id="total_value"
                value={form.total_value}
                onChange={(e) =>
                  set("total_value", formatBRLInput(e.target.value))
                }
                placeholder="0,00"
                inputMode="decimal"
                required
                className="mt-1"
              />
            )}
          </div>

          <div>
            <Label htmlFor="vendor">
              Origem
            </Label>
            <Input
              id="vendor"
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value.toUpperCase())}
              placeholder={
                form.direction === "expense"
                  ? "Ex: Posto Vale do Sol"
                  : "Ex: Cooperativa XYZ"
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value.toUpperCase())}
              placeholder="Ex: Diesel S10 - 50L"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!hasItems && !summaryMode && (
              <div>
                <div className="flex items-center justify-between min-h-[1.125rem]">
                  <Label>Categoria</Label>
                  <AiSuggestButton
                    onClick={() => runSuggest("header", form.description)}
                    loading={suggestingKey === "header"}
                    disabled={
                      suggestingKey !== null ||
                      !form.vendor.trim() ||
                      !form.description.trim()
                    }
                  />
                </div>
                <SearchableSelect
                  options={[
                    { value: "none", label: "Sem categoria" },
                    ...catOptions,
                  ]}
                  value={form.category || "none"}
                  onValueChange={(v) => set("category", v === "none" ? "" : v)}
                  placeholder="Selecione..."
                  searchPlaceholder="Buscar categoria..."
                  emptyMessage="Nenhuma categoria."
                  triggerClassName="mt-1"
                />
              </div>
            )}
            <div>
              <div className="flex items-center min-h-[1.125rem]">
                <Label>Tipo de Documento</Label>
              </div>
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

          {!summaryMode && ccs.length > 1 && (
            <div>
              <Label>
                Centro de Custo
                {hasItems && (
                  <span className="text-slate-400 font-normal"> (aplica a todos os itens)</span>
                )}
              </Label>
              <Select
                value={form.cost_center_id}
                onValueChange={(v) => set("cost_center_id", v)}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Escolher..." />
                </SelectTrigger>
                <SelectContent>
                  {ccs.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.name}{cc.is_default ? " (Padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="transaction_date">Data do Lançamento</Label>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Forma de Pagamento</Label>
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
                  <SelectItem value="none">Não informado</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="invoice_number">Número da Nota Fiscal</Label>
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
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value.toUpperCase())}
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Resumo de itemizado (Lançamentos): atalho pra gerenciar os itens
              na página dedicada (Notas e Recibos / Faturas). */}
          {summaryMode && receipt && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Este lançamento tem{" "}
                <span className="font-medium text-slate-900">
                  {receipt.item_count} {receipt.item_count === 1 ? "item" : "itens"}
                </span>
                . Edite-os na página dedicada.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 shrink-0"
                onClick={() => {
                  onOpenChange(false);
                  const base = receipt.doc_type === "fatura" ? "/faturas" : "/notas";
                  navigate(`${base}?open=${receipt.id}`);
                }}
              >
                <OpenInNew className="size-4" />
                Gerenciar itens
              </Button>
            </div>
          )}

          {/* Itens (split): cada um com categoria + centro de custo proprios.
              Com itens, o total/categoria/CC do cabeçalho vem dos itens.
              Só aparece quando allowItems (páginas Notas e Recibos / Faturas). */}
          {allowItems && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  {hasItems ? `Itens (${form.items.length})` : "Itens (opcional)"}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="gap-1"
                >
                  <Plus className="size-4" />
                  Adicionar item
                </Button>
              </div>

              {hasItems && (
                <div className="space-y-2">
                  {form.items.map((it) => (
                    <div
                      key={it.key}
                      className="rounded-md border border-slate-200 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={it.description}
                          onChange={(e) =>
                            updateItem(it.key, {
                              description: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="Descrição do item"
                          className="flex-1"
                        />
                        {canConvert && savedItemIds.has(it.key) && (
                          <ActionIconButton
                            icon={CallMade}
                            label="Converter em lançamento"
                            onClick={() => setPendingConvert(it)}
                          />
                        )}
                        <ActionIconButton
                          icon={Trash2}
                          label="Remover item"
                          tone="danger"
                          onClick={() => removeItem(it.key)}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-slate-500">Qtd</Label>
                          <Input
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(it.key, { quantity: e.target.value })
                            }
                            placeholder="0"
                            inputMode="decimal"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">
                            Valor unit.
                          </Label>
                          <Input
                            value={it.unit_value}
                            onChange={(e) =>
                              updateItem(it.key, {
                                unit_value: formatBRLInput(e.target.value),
                              })
                            }
                            placeholder="0,00"
                            inputMode="decimal"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Total</Label>
                          <Input
                            value={it.total_value}
                            onChange={(e) =>
                              updateItem(it.key, {
                                total_value: formatBRLInput(e.target.value),
                              })
                            }
                            placeholder="0,00"
                            inputMode="decimal"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between min-h-[1.125rem]">
                          <Label className="text-xs text-slate-500">
                            Categoria
                          </Label>
                          <AiSuggestButton
                            onClick={() => runSuggest(it.key, it.description)}
                            loading={suggestingKey === it.key}
                            disabled={
                              suggestingKey !== null ||
                              !form.vendor.trim() ||
                              !it.description.trim()
                            }
                            disabledHint="Preencha origem e a descrição do item para sugerir"
                          />
                        </div>
                        <SearchableSelect
                          options={[
                            { value: "none", label: "Sem categoria" },
                            ...catOptions,
                          ]}
                          value={it.category || "none"}
                          onValueChange={(v) =>
                            updateItem(it.key, {
                              category: v === "none" ? "" : v,
                            })
                          }
                          placeholder="Selecione..."
                          searchPlaceholder="Buscar categoria..."
                          emptyMessage="Nenhuma categoria."
                          triggerClassName="mt-1"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm text-slate-600">
                    Total dos itens:{" "}
                    <span className="font-medium text-slate-900">
                      {formatBRL(itemsTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

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

      <ConfirmActionDialog
        open={pendingConvert !== null}
        onOpenChange={(o) => {
          if (!o) setPendingConvert(null);
        }}
        title="Converter em Lançamento"
        description={
          pendingConvert
            ? `Converter "${pendingConvert.description || "este item"}" (${formatBRL(parseBRLInput(pendingConvert.total_value) || 0)}) em um lançamento separado? Ele sai deste lançamento e o total é recalculado.`
            : ""
        }
        confirmLabel="Converter"
        cancelLabel="Cancelar"
        loading={converting}
        loadingLabel="Convertendo..."
        onConfirm={confirmConvert}
      />
    </Dialog>
  );
}
