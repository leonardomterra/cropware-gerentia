import { useEffect, useState, type ReactNode } from "react";
import Plus from "~icons/material-symbols-light/add";
import Pencil from "~icons/material-symbols-light/edit-outline";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import Checklist from "~icons/material-symbols-light/checklist";
import Search from "~icons/material-symbols-light/search";
import FilterList from "~icons/material-symbols-light/filter-list";
import X from "~icons/material-symbols-light/close";
import CheckCircle from "~icons/material-symbols-light/check-circle-outline";
import Undo from "~icons/material-symbols-light/undo";
import Archive from "~icons/material-symbols-light/archive-outline";
import SwapHoriz from "~icons/material-symbols-light/swap-horiz";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/ui/utils";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { useAuth } from "@/contexts/AuthContext";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import type { CostCenter } from "@/modules/cost-centers/types";
import { useTasks } from "../hooks/useTasks";
import type { Task, TaskInput, TaskPriority } from "../types";
import { useReceipts, updateReceipt } from "@/modules/receipts/hooks/useReceipts";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import { getCategoryLabel, formatBRLInput, parseBRLInput } from "@/modules/receipts/utils/receiptFormatters";
import { ReceiptFormDialog, type FormState } from "@/modules/receipts/components/ReceiptFormDialog";
import type { Receipt } from "@/modules/receipts/types";

const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Baixa", normal: "Normal", high: "Alta" };
const PRIORITY_CLASS: Record<TaskPriority, string> = {
  low: "text-slate-400",
  normal: "text-slate-400",
  high: "text-amber-600 font-medium",
};

// Altura fixa única p/ TODOS os cards (lembrete e financeiro, ativos e vazios)
// ficarem do mesmo tamanho nas 3 colunas.
const CARD_H = "min-h-[12rem]";
const TASK_CARD_H = CARD_H;
const FIN_CARD_H = CARD_H;

// Botão de ícone "cru" (mesmo visual do ActionIconButton) p/ usar como trigger
// de Popover — evita aninhar dois triggers asChild (Tooltip + Popover).
const ICON_BTN =
  "size-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-slate-300 hover:bg-slate-100 hover:text-slate-700";

type ConvertKind = "a_pagar" | "a_receber" | "concluido";

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function fmtDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  if (!y || !m || !d) return yyyymmdd;
  const curY = todayISO().slice(0, 4);
  return y === curY ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const isPaid = (r: Receipt) => r.status === "pago" || r.status === "recebido";

// Radix Select nao aceita value="" — sentinela p/ "sem centro".
const NO_CC = "__none__";

interface FormStateTask {
  title: string;
  due_date: string;
  priority: TaskPriority;
  notes: string;
  total_value: string;   // mascarado (formatBRLInput), igual ao form de lançamento
  cost_center_id: string;
}

const EMPTY_FORM: FormStateTask = {
  title: "", due_date: "", priority: "normal", notes: "", total_value: "", cost_center_id: NO_CC,
};

export default function PendenciasPage() {
  const { user } = useAuth();
  const { tasks, loading, create, update, remove, toggleDone } = useTasks();
  const { receipts, loading: finLoading, refetch: refetchFin } = useReceipts({ status: ["a_pagar", "a_receber", "vencido"] });
  const { categories } = useCategories();

  const ccById = new Map((user?.costCenters ?? []).map((c) => [c.id, c] as const));

  // Cópia local do financeiro: ao "pagar", o item continua na lista (disabled)
  // até ser tirado — por isso não re-buscamos após as ações.
  const [fin, setFin] = useState<Receipt[]>([]);
  useEffect(() => { setFin(receipts); }, [receipts]);

  const [query, setQuery] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<FormStateTask>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Task | null>(null);
  const [removing, setRemoving] = useState(false);
  const [finConfirm, setFinConfirm] = useState<{ r: Receipt; action: "pay" | "archive" } | null>(null);
  // Conversão lembrete -> lançamento (abre o form pré-preenchido).
  const [convert, setConvert] = useState<{ task: Task; seed: Partial<FormState> } | null>(null);

  const activeFilters = (hideDone ? 1 : 0) + (priorityFilter !== "all" ? 1 : 0);

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); }
  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      due_date: t.due_date || "",
      priority: t.priority,
      notes: t.notes || "",
      // Centavos -> mascara, do mesmo jeito que o form de lançamento semeia.
      total_value: t.total_value ? formatBRLInput(String(Math.round(t.total_value * 100))) : "",
      cost_center_id: t.cost_center_id || NO_CC,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const title = form.title.trim();
    if (!title) { toast.error("Escreva o que resolver"); return; }
    setSaving(true);
    const v = parseBRLInput(form.total_value);
    const payload: TaskInput = {
      title: title.toUpperCase(),
      due_date: form.due_date || null,
      priority: form.priority,
      notes: form.notes.trim() || null,
      total_value: Number.isFinite(v) && v > 0 ? v : null,
      cost_center_id: form.cost_center_id === NO_CC ? null : form.cost_center_id,
    };
    const ok = editing ? await update(editing.id, payload) : !!(await create(payload));
    setSaving(false);
    if (ok) { toast.success(editing ? "Lembrete atualizado" : "Lembrete criado"); setDialogOpen(false); }
    else toast.error("Não consegui salvar");
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      const ok = await remove(pendingRemove.id);
      if (ok) toast.success("Removido");
      setPendingRemove(null);
    } finally { setRemoving(false); }
  }

  // Converter lembrete -> lançamento: semeia o form (título vira origem, data
  // vira vencimento, valor e centro passam adiante) e abre pré-preenchido.
  function openConvert(t: Task, kind: ConvertKind) {
    const base: Partial<FormState> = { vendor: t.title.toUpperCase() };
    if (t.total_value) base.total_value = formatBRLInput(String(Math.round(t.total_value * 100)));
    if (t.cost_center_id) base.cost_center_id = t.cost_center_id;
    let seed: Partial<FormState>;
    if (kind === "a_pagar") seed = { ...base, direction: "expense", status: "a_pagar", due_date: t.due_date ?? "" };
    else if (kind === "a_receber") seed = { ...base, direction: "income", status: "a_receber", due_date: t.due_date ?? "" };
    else seed = { ...base, direction: "expense", status: "pago", transaction_date: t.due_date ?? todayISO(), paid_date: t.due_date ?? todayISO() };
    setConvert({ task: t, seed });
  }

  async function onConvertSaved() {
    const t = convert?.task;
    setConvert(null);
    if (t && !t.done) await toggleDone(t); // vira lançamento => o lembrete se resolve
    await refetchFin();                     // traz o novo lançamento pra coluna
    toast.success("Convertido em lançamento");
  }

  // --- financeiro: pagar / desfazer / tirar (otimista, sem refetch) ---
  async function applyFinStatus(r: Receipt, paid: boolean) {
    const status = paid ? (r.direction === "income" ? "recebido" : "pago") : (r.direction === "income" ? "a_receber" : "a_pagar");
    const paid_date = paid ? todayISO() : null;
    setFin((prev) => prev.map((x) => (x.id === r.id ? { ...x, status, paid_date } : x)));
    try {
      await updateReceipt(r.id, { status, paid_date });
    } catch {
      toast.error("Não consegui atualizar");
      setFin((prev) => prev.map((x) => (x.id === r.id ? r : x))); // reverte
    }
  }
  function doArchive(r: Receipt) { setFin((prev) => prev.filter((x) => x.id !== r.id)); }

  function runFinConfirm() {
    if (!finConfirm) return;
    const { r, action } = finConfirm;
    if (action === "pay") void applyFinStatus(r, true);
    else doArchive(r);
    setFinConfirm(null);
  }

  // --- filtros (client-side) ---
  const q = query.trim().toLowerCase();
  const taskMatch = (t: Task) =>
    (!q || t.title.toLowerCase().includes(q)) &&
    (!hideDone || !t.done) &&
    (priorityFilter === "all" || t.priority === priorityFilter);
  const finMatch = (r: Receipt) =>
    (!q || [r.vendor, r.description, r.category].some((s) => (s || "").toLowerCase().includes(q))) &&
    (!hideDone || !isPaid(r));
  const byResolvedThenDue = (a: Receipt, b: Receipt) => {
    const ra = isPaid(a) ? 1 : 0, rb = isPaid(b) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return (a.due_date || "9999") < (b.due_date || "9999") ? -1 : 1;
  };
  const byDoneThenDue = (a: Task, b: Task) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.due_date || "9999") < (b.due_date || "9999") ? -1 : 1;
  };

  const visibleTasks = tasks.filter(taskMatch).sort(byDoneThenDue);
  const aPagar = fin.filter((r) => r.direction === "expense" && finMatch(r)).sort(byResolvedThenDue);
  const aReceber = fin.filter((r) => r.direction === "income" && finMatch(r)).sort(byResolvedThenDue);

  const ccs = user?.costCenters ?? [];

  const renderFin = (r: Receipt) => (
    <FinancialCard
      key={r.id}
      r={r}
      cc={r.cost_center_id ? ccById.get(r.cost_center_id) ?? null : null}
      categoryLabel={getCategoryLabel(r.category, categories)}
      onResolve={() => setFinConfirm({ r, action: "pay" })}
      onUndo={() => void applyFinStatus(r, false)}
      onArchive={() => setFinConfirm({ r, action: "archive" })}
    />
  );

  return (
    <div className="space-y-4">
      {/* Barra: novo lembrete + busca + filtros (estilo Lançamentos) */}
      <header className="space-y-2">
        {/* Linha 1: busca + filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="relative">
            <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por lembrete, origem ou descrição..."
              className="pl-8 h-9 bg-white border-slate-200 shadow-none text-slate-500"
            />
          </div>
        </div>
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-9 w-full sm:w-auto shrink-0 inline-flex items-center justify-start gap-1.5 px-3 rounded-md border border-zinc-200 bg-zinc-100 text-base md:text-sm text-slate-900 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
            >
              <FilterList className="size-4 shrink-0" />
              Filtrar
              {activeFilters > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center size-5 rounded-full bg-zinc-800 text-white text-xs tabular-nums">
                  {activeFilters}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="p-3 space-y-3 bg-zinc-900 text-zinc-100 border-zinc-800 rounded-xl shadow-lg">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox checked={hideDone} onCheckedChange={(v) => setHideDone(!!v)} />
              Ocultar resolvidos
            </label>
            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Prioridade (lembretes)</span>
              <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as "all" | TaskPriority)}>
                <SelectTrigger className="h-9 bg-white text-slate-500"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="high">{PRIORITY_LABEL.high}</SelectItem>
                  <SelectItem value="normal">{PRIORITY_LABEL.normal}</SelectItem>
                  <SelectItem value="low">{PRIORITY_LABEL.low}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setHideDone(false); setPriorityFilter("all"); }}
                className="w-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100 h-8"
              >
                <X className="size-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </PopoverContent>
        </Popover>
        </div>
        {/* Linha 2: novo lembrete */}
        <Button variant="outline" onClick={openNew} className="w-full sm:w-auto">
          <Plus className="size-4 mr-1" />
          Novo Lembrete
        </Button>
      </header>

      {/* 3 colunas no desktop; empilha no mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Column title="Lembretes" count={visibleTasks.length}>
          {loading ? (
            <LoadingState />
          ) : visibleTasks.length === 0 ? (
            <EmptyCol minH={TASK_CARD_H} icon={<Checklist className="size-8 text-slate-300" />} text="Nenhum lembrete" />
          ) : (
            visibleTasks.map((t) => (
              <TaskCard
                key={t.id}
                t={t}
                cc={t.cost_center_id ? ccById.get(t.cost_center_id) ?? null : null}
                onToggleDone={() => void toggleDone(t)}
                onEdit={() => openEdit(t)}
                onRemove={() => setPendingRemove(t)}
                onConvert={(kind) => openConvert(t, kind)}
              />
            ))
          )}
        </Column>

        <Column title="Pagar" count={aPagar.length}>
          {finLoading ? <LoadingState /> : aPagar.length === 0 ? (
            <EmptyCol minH={FIN_CARD_H} text="Nada a pagar" />
          ) : aPagar.map(renderFin)}
        </Column>

        <Column title="Receber" count={aReceber.length}>
          {finLoading ? <LoadingState /> : aReceber.length === 0 ? (
            <EmptyCol minH={FIN_CARD_H} text="Nada a receber" />
          ) : aReceber.map(renderFin)}
        </Column>
      </div>

      {/* Dialog criar/editar lembrete */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Lembrete" : "Novo Lembrete"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">O que resolver</label>
              <Input
                placeholder="Ex.: pagar o contador"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value.toUpperCase() }))}
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Data (opcional)</label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((s) => ({ ...s, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Valor R$ (opcional)</label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.total_value}
                  onChange={(e) => setForm((s) => ({ ...s, total_value: formatBRLInput(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ccs.length > 1 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Centro de Custo (opcional)</label>
                  <Select value={form.cost_center_id} onValueChange={(v) => setForm((s) => ({ ...s, cost_center_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CC}>Sem centro</SelectItem>
                      {ccs.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.name}{cc.is_default ? " (Padrão)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Prioridade</label>
                <Select value={form.priority} onValueChange={(v) => setForm((s) => ({ ...s, priority: v as TaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{PRIORITY_LABEL.low}</SelectItem>
                    <SelectItem value="normal">{PRIORITY_LABEL.normal}</SelectItem>
                    <SelectItem value="high">{PRIORITY_LABEL.high}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Observação (opcional)</label>
              <Textarea
                placeholder="Detalhes..."
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                maxLength={1000}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form de lançamento pré-preenchido (conversão de lembrete) */}
      <ReceiptFormDialog
        open={convert !== null}
        onOpenChange={(o) => { if (!o) setConvert(null); }}
        seed={convert?.seed ?? null}
        allowItems={false}
        onSaved={onConvertSaved}
        titleNew="Converter em Lançamento"
      />

      {/* Confirmar exclusão/remoção de lembrete */}
      <ConfirmActionDialog
        open={pendingRemove !== null}
        onOpenChange={(o) => { if (!o) setPendingRemove(null); }}
        title={pendingRemove?.done ? "Tirar da Lista" : "Excluir Lembrete"}
        description={pendingRemove ? `Remover "${pendingRemove.title.toUpperCase()}"?` : ""}
        confirmLabel={pendingRemove?.done ? "Tirar" : "Excluir"}
        cancelLabel="Cancelar"
        loading={removing}
        loadingLabel="Removendo..."
        onConfirm={confirmRemove}
      />

      {/* Confirmar ação financeira (pagar/receber ou tirar da lista) */}
      <ConfirmActionDialog
        open={finConfirm !== null}
        onOpenChange={(o) => { if (!o) setFinConfirm(null); }}
        title={
          !finConfirm ? "" : finConfirm.action === "pay"
            ? (finConfirm.r.direction === "income" ? "Marcar como Recebido" : "Marcar como Pago")
            : "Tirar da Lista"
        }
        description={
          !finConfirm ? "" : finConfirm.action === "pay"
            ? `${(finConfirm.r.vendor || finConfirm.r.description || "Lançamento").toUpperCase()} — ${fmtBRL(finConfirm.r.total_value)}. Confirmar?`
            : "Some desta lista. O lançamento continua registrado (e pago) no sistema."
        }
        confirmLabel={!finConfirm ? "Confirmar" : finConfirm.action === "pay" ? "Confirmar" : "Tirar"}
        cancelLabel="Cancelar"
        onConfirm={runFinConfirm}
      />
    </div>
  );
}

// ---------- sub-componentes ----------

function Column({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-slate-500">{title}</h2>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EmptyCol({ minH, icon, text }: { minH: string; icon?: ReactNode; text: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 p-3 text-center", minH)}>
      {icon}
      <span className="text-sm text-slate-400">{text}</span>
    </div>
  );
}

function ConvertMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-2.5 py-2 rounded-md text-sm text-zinc-100 hover:bg-white/10 text-left"
    >
      {label}
    </button>
  );
}

// Card de lembrete no mesmo padrão dos financeiros. Ativo: Converter / Editar /
// Excluir. Resolvido (= virou lançamento): disabled + Reativar / Tirar.
//
// NÃO tem "Concluir" avulso: todo lembrete é financeiro, então resolver um é
// convertê-lo em lançamento — um "concluir" que não gera lançamento só some com
// o compromisso sem registrar o dinheiro (decisão 15/07).
function TaskCard({ t, cc, onToggleDone, onEdit, onRemove, onConvert }: {
  t: Task; cc: CostCenter | null;
  onToggleDone: () => void; onEdit: () => void; onRemove: () => void; onConvert: (kind: ConvertKind) => void;
}) {
  const [convOpen, setConvOpen] = useState(false);
  const overdue = !!t.due_date && !t.done && t.due_date < todayISO();
  // Valor é opcional (lembrete nasce de "anota: X"): sem valor, cinza.
  const hasValue = t.total_value !== null && t.total_value > 0;
  return (
    <div className={cn("bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-2", TASK_CARD_H, t.done && "opacity-60")}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-medium truncate flex-1 min-w-0 ${t.done ? "line-through text-slate-400" : "text-slate-900"}`}>
          {t.title.toUpperCase()}
        </span>
        {t.priority !== "normal" && (
          <span className={cn("text-xs shrink-0", PRIORITY_CLASS[t.priority])}>{PRIORITY_LABEL[t.priority]}</span>
        )}
      </div>
      <div className={cn("font-medium", hasValue && !t.done ? "text-slate-900" : "text-slate-400")}>
        {fmtBRL(t.total_value ?? 0)}
      </div>
      <div className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
        {cc && <CostCenterChip icon={cc.icon} color={cc.color} className="size-5 shrink-0" />}
        <span className={cn("truncate", !cc && "text-slate-400")}>{cc ? cc.name : "Sem centro"}</span>
      </div>
      <div className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-slate-400"}`}>
        {t.due_date ? fmtDate(t.due_date) : "sem data"}
      </div>
      <div className="flex items-center gap-1 border-t border-slate-100 -mx-3 px-3 pt-2 mt-auto">
        {t.done ? (
          <>
            <ActionIconButton icon={Undo} label="Reativar" onClick={onToggleDone} />
            <ActionIconButton icon={Archive} label="Tirar da lista" tone="danger" onClick={onRemove} />
          </>
        ) : (
          <>
            <Popover open={convOpen} onOpenChange={setConvOpen}>
              <PopoverTrigger asChild>
                <button type="button" title="Converter em lançamento" aria-label="Converter em lançamento" className={ICON_BTN}>
                  <SwapHoriz className="size-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="p-1 w-56 bg-zinc-900 text-zinc-100 border-zinc-800 rounded-xl shadow-lg">
                <ConvertMenuItem label="Conta a pagar" onClick={() => { setConvOpen(false); onConvert("a_pagar"); }} />
                <ConvertMenuItem label="Conta a receber" onClick={() => { setConvOpen(false); onConvert("a_receber"); }} />
                <ConvertMenuItem label="Lançamento concluído" onClick={() => { setConvOpen(false); onConvert("concluido"); }} />
              </PopoverContent>
            </Popover>
            <ActionIconButton icon={Pencil} label="Editar" onClick={onEdit} />
            <ActionIconButton icon={Trash2} label="Excluir" tone="danger" onClick={onRemove} />
          </>
        )}
      </div>
    </div>
  );
}

function FinancialCard({ r, cc, categoryLabel, onResolve, onUndo, onArchive }: {
  r: Receipt; cc: CostCenter | null; categoryLabel: string;
  onResolve: () => void; onUndo: () => void; onArchive: () => void;
}) {
  const resolved = isPaid(r);
  const overdue = !resolved && !!r.due_date && r.due_date < todayISO();
  const resolveLabel = r.direction === "income" ? "Marcar como recebido" : "Marcar como pago";
  return (
    <div className={cn("bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-2", FIN_CARD_H, resolved && "opacity-60")}>
      <div className={`font-medium truncate ${resolved ? "line-through text-slate-500" : "text-slate-900"}`}>
        {(r.vendor || r.description || "Lançamento").toUpperCase()}
      </div>
      <div className={`font-medium ${resolved ? "text-slate-500" : "text-slate-900"}`}>{fmtBRL(r.total_value)}</div>
      <div className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
        {cc && <CostCenterChip icon={cc.icon} color={cc.color} className="size-5 shrink-0" />}
        <span className="truncate">{cc ? cc.name : "Sem centro"}{categoryLabel !== "—" ? ` - ${categoryLabel}` : ""}</span>
      </div>
      <div className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-slate-400"}`}>
        {r.due_date ? `vence ${fmtDate(r.due_date)}` : "sem vencimento"}
      </div>
      <div className="flex items-center gap-1 border-t border-slate-100 -mx-3 px-3 pt-2 mt-auto">
        {resolved ? (
          <>
            <ActionIconButton icon={Undo} label="Voltar a pendente" onClick={onUndo} />
            <ActionIconButton icon={Archive} label="Tirar da lista" tone="danger" onClick={onArchive} />
          </>
        ) : (
          <ActionIconButton icon={CheckCircle} label={resolveLabel} onClick={onResolve} />
        )}
      </div>
    </div>
  );
}
