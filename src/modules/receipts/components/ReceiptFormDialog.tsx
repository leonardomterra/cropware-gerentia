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
import { Ajuda } from "@/components/ui/Ajuda";
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
import Plus from "~icons/ph/plus";
import Trash2 from "~icons/ph/trash";
import CallMade from "~icons/ph/arrow-up-right";
import OpenInNew from "~icons/ph/arrow-square-out";
import AttachFile from "~icons/ph/paperclip";
import Pencil from "~icons/ph/pencil-simple";
import { cn } from "@/components/ui/utils";
import { useOrgPeople } from "@/modules/team/hooks/useOrgPeople";
import { AttachmentViewerDialog } from "./AttachmentViewerDialog";
import { ReceiptItemsTable } from "./ReceiptItemsTable";
import { rotuloDoCartao, useCards } from "@/modules/cards/useCards";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import { Obrigatorio } from "@/components/ui/Obrigatorio";
import { BOTAO_BARRA, BOTAO_BARRA_PRIMARIO, ICONE_BOTAO_BARRA } from "@/lib/ui-tokens";
import { useAuth } from "@/contexts/AuthContext";
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  STATUSES_BY_DIRECTION,
  STATUS_LABEL,
  isCreditCard,
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
  /** Valores iniciais ao CRIAR (sem anexo) — ex.: converter um lembrete em
   *  lançamento pré-preenchido. Ignorado no modo edição. */
  seed?: Partial<FormState> | null;
  onSaved: () => void;
  /** Habilita o editor de itens (split). Em Lançamentos = false (simples);
   *  nas páginas Notas e Recibos / Faturas = true. */
  allowItems?: boolean;
  /** doc_type semeado ao criar (ex.: "fatura" na página de Faturas). */
  defaultDocType?: ReceiptDocType;
  /** Títulos do dialog (por contexto de aba). */
  titleNew?: string;
  titleEdit?: string;
  /** Título no modo leitura. */
  titleView?: string;
  /**
   * VER É ESTA MESMA TELA, TRAVADA.
   *
   * Ver um lançamento abria um diálogo com um resumo desenhado à parte — outra
   * ordem, outro formato, e um campo novo aqui que ninguém lembrava de repetir
   * lá. Com `somenteLeitura` o formulário inteiro entra num `<fieldset
   * disabled>` e o rodapé troca Cancelar/Salvar por Fechar/Editar.
   *
   * Ver docs/ADOCAO-DESIGN-FLAGFIELD.md, Etapa D.
   */
  somenteLeitura?: boolean;
  /** Chamado pelo botão *Editar* do rodapé, na leitura. Ausente = sem permissão. */
  aoEditar?: () => void;
  /**
   * Onde o formulário é servido.
   *
   * `pagina` é o padrão novo (rota própria, casca `PaginaDeFormulario`): num
   * diálogo o teclado do iOS espreme o conteúdo, a rolagem do modal briga com a
   * da tela atrás e sobra menos largura no celular — e este formulário é longo.
   *
   * `dialogo` continua existindo para quem o abre de dentro de outro fluxo (o
   * Lembrete que vira lançamento, em Pendências), onde tirar a pessoa da tela
   * custaria o contexto dela.
   */
  modo?: "pagina" | "dialogo";
}

export interface FormState {
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
  is_estimated: boolean;
  counts_in_total: boolean;
  card_id: string;
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
  is_estimated: false,
  counts_in_total: true,
  card_id: "",
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

/** Linha rótulo/valor do bloco que só aparece na leitura. */
function InfoLeitura({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-slate-700 truncate">{children}</p>
    </div>
  );
}

export function ReceiptFormDialog({
  open,
  onOpenChange,
  receipt,
  prefill,
  seed,
  onSaved,
  allowItems = true,
  defaultDocType,
  titleNew = "Novo Lançamento",
  titleEdit = "Editar Lançamento",
  titleView = "Lançamento",
  somenteLeitura = false,
  aoEditar,
  modo = "dialogo",
}: ReceiptFormDialogProps) {
  const { nameOf } = useOrgPeople();
  const autor = receipt ? nameOf(receipt.created_by) : null;
  const [verAnexo, setVerAnexo] = useState(false);
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
        is_estimated: receipt.is_estimated,
        counts_in_total: receipt.counts_in_total,
        card_id: receipt.card_id ?? "",
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
        // Compra no cartão de crédito nasce informativa; o resto soma. Mesmo
        // default do backend (handlers/receipts.ts) e do WhatsApp.
        counts_in_total: !isCreditCard(prefill.values.payment_method),
        items: allowItems ? (prefill.values.items ?? []) : [],
      });
    } else if (seed) {
      setForm({
        ...EMPTY,
        cost_center_id: defaultCCId,
        ...(defaultDocType ? { doc_type: defaultDocType } : {}),
        ...seed,
        items: allowItems ? [newItemRow()] : [],
      });
    } else {
      setForm({
        ...EMPTY,
        cost_center_id: defaultCCId,
        ...(defaultDocType ? { doc_type: defaultDocType } : {}),
        // Formulário em branco não tem forma de pagamento ainda: soma. Quando o
        // usuário escolher cartão de crédito, o onValueChange abaixo desliga.
        counts_in_total: true,
        // Páginas itemizadas começam com 1 linha de item pra o editor aparecer.
        items: allowItems ? [newItemRow()] : [],
      });
    }
    setError(null);
  }, [open, receipt, prefill, seed, defaultCCId, allowItems, defaultDocType]);

  // Cartões da organização que a RLS deixa ver. Sem cartão cadastrado o
  // seletor não aparece — seria um campo com uma opção só.
  const { cards } = useCards();

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
          is_estimated: form.is_estimated,
          counts_in_total: form.counts_in_total,
          card_id: form.card_id || null,
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
        payment_method: form.payment_method === "" ? null : form.payment_method,
        invoice_number: form.invoice_number.trim() || null,
        notes: form.notes.trim() || null,
        cost_center_id: hasItems ? null : form.cost_center_id || null,
        is_estimated: form.is_estimated,
        counts_in_total: form.counts_in_total,
        card_id: form.card_id || null,
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

  /**
   * O corpo do formulário mora numa variável porque ele é servido em DUAS
   * cascas — página e diálogo. Copiá-lo seria garantir que um campo novo
   * entrasse só numa das duas, que é exatamente o defeito que a fusão de
   * "ver" com "editar" acabou de corrigir.
   */
  const camposDoFormulario = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select
            value={form.direction}
            onValueChange={(v) => set("direction", v as ReceiptDirection)}
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
            value={form.is_estimated ? "previsto" : form.status}
            onValueChange={(v) => {
              if (v === "previsto") {
                set("is_estimated", true);
              } else {
                setForm((f) => ({
                  ...f,
                  is_estimated: false,
                  status: v as ReceiptStatus,
                }));
              }
            }}
          >
            <SelectTrigger className="h-9 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="previsto">Previsto</SelectItem>
              {availableStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Valor e Origem na mesma linha: o valor é curto e sobrava
                metade da largura ao lado dele. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="total_value">
            Valor (R$)
            {/* Obrigatório só quando o valor é digitado. No itemizado ele é a
                soma dos itens, num campo somente-leitura — marcar seria pedir
                algo que a pessoa não pode preencher ali. */}
            {!hasItems && !summaryMode && <Obrigatorio />}
          </Label>
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
          <Label htmlFor="vendor">Origem</Label>
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
        {!summaryMode && ccs.length > 1 && (
          <div>
            {/* Mesmo invólucro do rótulo acima, para os dois selects da linha
                começarem na mesma altura. */}
            <div className="flex items-center min-h-[1.125rem]">
              <Label>
                Centro de Custo
                {hasItems && (
                  <span className="text-slate-400 font-normal">
                    {" "}
                    (aplica a todos os itens)
                  </span>
                )}
              </Label>
            </div>
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
                    {cc.name}
                    {cc.is_default ? " (Padrão)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {/* "Contabilizar no Total" — aparece só onde há risco de duplicar
            (fatura ou cartão de crédito). Desde 25/08/2026 a FATURA nasce
            ligada e a compra no cartão, desligada — ver
            docs/CARTOES-E-FATURAS.md. Desligado = informativo (não soma).

            Era um interruptor num card de largura cheia, embaixo de tudo. Virou
            select por dois motivos: o card empurrava o campo para fora do fluxo
            do formulário, como se fosse outra coisa; e um interruptor não diz o
            que acontece em cada posição — o select diz, no próprio rótulo da
            opção escolhida.

            A tonalização existe porque este é o único campo do formulário que
            muda o SALDO. Verde soma, vermelho não soma. É a informação que a
            pessoa precisa ver sem abrir nada. */}
        {(form.doc_type === "fatura" || isCreditCard(form.payment_method)) && (
          <div>
            <div className="flex items-center gap-1.5 min-h-[1.125rem]">
              <Label>Contabilizar no Total</Label>
              <Ajuda>
                {form.doc_type === "fatura"
                  ? "A fatura é o que soma no total — é ela que fecha com o extrato do banco. As compras do cartão ficam como detalhe. Desligue só se você lança as compras uma a uma."
                  : "Compra no cartão: fica como informativo e não soma, porque o gasto entra quando a fatura for lançada. Ligue se você não vai cadastrar a fatura deste cartão."}
              </Ajuda>
            </div>
            <Select
              value={form.counts_in_total ? "sim" : "nao"}
              onValueChange={(v) => set("counts_in_total", v === "sim")}
            >
              <SelectTrigger
                className={cn(
                  "h-9 mt-1",
                  form.counts_in_total
                    ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                    : "border-red-200 bg-red-50/70 text-red-900",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim, soma no total</SelectItem>
                <SelectItem value="nao">Não, só informativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            onValueChange={(v) => {
              const pm = v === "none" ? "" : (v as ReceiptPaymentMethod);
              // Trocar a forma de pagamento REAJUSTA o "contabilizar": escolher
              // cartão de crédito desliga, sair dele religa. Sem isto o usuário
              // marcaria o cartão e o lançamento continuaria somando em
              // silêncio — que é justamente o buraco que a regra nova fecha.
              // Fatura mantém o dela: lá o padrão é somar.
              setForm((f) => ({
                ...f,
                payment_method: pm,
                counts_in_total:
                  f.doc_type === "fatura"
                    ? f.counts_in_total
                    : !isCreditCard(pm),
              }));
            }}
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

      {/* Cartão: aparece na compra no crédito e na fatura. Na compra ele diz em
          que fatura o gasto vai cair; na fatura, de qual cartão ela é — e é
          esse vínculo que a conciliação vai usar. */}
      {cards.length > 0 &&
        (isCreditCard(form.payment_method) || form.doc_type === "fatura") && (
          <div>
            <div className="flex items-center gap-1.5">
              <Label>Cartão</Label>
              <Ajuda>
                {form.doc_type === "fatura"
                  ? "De qual cartão é esta fatura."
                  : "Em qual cartão a compra vai cair — é assim que ela se liga à fatura depois."}
              </Ajuda>
            </div>
            <Select
              value={form.card_id || "nenhum"}
              onValueChange={(v) => set("card_id", v === "nenhum" ? "" : v)}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Não informado</SelectItem>
                {cards
                  .filter((c) => c.ativo || c.id === form.card_id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {rotuloDoCartao(c)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
            className={cn(
              BOTAO_BARRA_PRIMARIO,
              "inline-flex items-center rounded-md w-auto",
            )}
            onClick={() => {
              onOpenChange(false);
              const base =
                receipt.doc_type === "fatura" ? "/cartoes" : "/notas";
              navigate(`${base}?open=${receipt.id}`);
            }}
          >
            <OpenInNew className={ICONE_BOTAO_BARRA} />
            Gerenciar Itens
          </Button>
        </div>
      )}

      {/* Itens (split): cada um com categoria + centro de custo proprios.
              Com itens, o total/categoria/CC do cabeçalho vem dos itens.
              Só aparece quando allowItems (páginas Notas e Recibos / Faturas). */}
      {allowItems && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{hasItems ? `Itens (${form.items.length})` : "Itens"}</Label>
            <Button
              type="button"
              onClick={addItem}
              className={cn(BOTAO_BARRA, "inline-flex items-center rounded-md")}
            >
              <Plus className={ICONE_BOTAO_BARRA} />
              Adicionar
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
                      <Label className="text-xs text-slate-500">Unit.</Label>
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
    </>
  );

  const extrasDeLeitura = (
    <>
      {/* O que só existe na leitura: dados que o formulário não edita.
              Ficam AQUI, e não numa tela paralela, justamente para não voltar a
              ter dois lugares mostrando o mesmo lançamento. */}
      {/* Lançamento itemizado visto de uma aba que não edita itens
              (Lançamentos usa allowItems=false): sem isto os itens sumiriam da
              leitura, que era justamente o que o diálogo antigo mostrava. */}
      {somenteLeitura &&
      receipt &&
      !allowItems &&
      (receipt.item_count ?? 0) > 0 ? (
        <div className="mt-1">
          <p className="text-sm text-slate-500 mb-2">Itens</p>
          <ReceiptItemsTable receipt={receipt} editable={false} />
        </div>
      ) : null}

      {somenteLeitura && receipt ? (
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm">
          <InfoLeitura rotulo="Fonte">
            <span className="capitalize">{receipt.source}</span>
          </InfoLeitura>
          {receipt.vendor_cnpj ? (
            <InfoLeitura rotulo="CNPJ">{receipt.vendor_cnpj}</InfoLeitura>
          ) : null}
          {autor ? (
            <InfoLeitura rotulo="Lançado por">{autor}</InfoLeitura>
          ) : null}
          {receipt.attachment_key ? (
            <div className="col-span-2">
              <Button
                type="button"
                className={cn(
                  BOTAO_BARRA,
                  "inline-flex items-center rounded-md",
                )}
                onClick={() => setVerAnexo(true)}
              >
                <AttachFile className={ICONE_BOTAO_BARRA} />
                Ver Arquivo
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  const ID_DO_FORM = "form-lancamento";

  if (modo === "pagina") {
    return (
      <>
        <PaginaDeFormulario
          formId={ID_DO_FORM}
          rotuloSalvar={isEdit ? "Salvar" : "Criar"}
          descricao={somenteLeitura ? titleView : isEdit ? titleEdit : titleNew}
          somenteLeitura={somenteLeitura}
          aoEditar={aoEditar}
          aoVoltar={() => onOpenChange(false)}
          salvando={submitting}
        >
          <form
            id={ID_DO_FORM}
            onSubmit={handleSubmit}
            className="flex flex-col gap-3"
          >
            {camposDoFormulario}
            {extrasDeLeitura}
          </form>
        </PaginaDeFormulario>

        <AttachmentViewerDialog
          receipt={receipt ?? null}
          open={verAnexo}
          onOpenChange={setVerAnexo}
        />

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
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[90vh] overflow-y-auto",
          somenteLeitura && "modo-leitura",
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {somenteLeitura ? titleView : isEdit ? titleEdit : titleNew}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <fieldset disabled={somenteLeitura} className="contents">
            {camposDoFormulario}
          </fieldset>
          {extrasDeLeitura}
          <DialogFooter className="mt-2">
            {somenteLeitura ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Fechar
                </Button>
                {/* Um botão só, que troca de rótulo: "Editar" aqui vira
                    "Salvar" na mesma posição depois do clique. Cancelar seria
                    salvar o que já estava lá. */}
                {aoEditar ? (
                  <Button type="button" variant="default" onClick={aoEditar}>
                    <Pencil className="size-4 mr-1.5" />
                    Editar
                  </Button>
                ) : null}
              </>
            ) : (
              <>
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
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>

      <AttachmentViewerDialog
        receipt={receipt ?? null}
        open={verAnexo}
        onOpenChange={setVerAnexo}
      />

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
