import { useState } from "react";
import Plus from "~icons/material-symbols-light/add";
import Pencil from "~icons/material-symbols-light/edit-outline";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import Play from "~icons/material-symbols-light/play-arrow";
import Pause from "~icons/material-symbols-light/pause";
import Repeat from "~icons/material-symbols/autorenew";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { useAuth } from "@/contexts/AuthContext";
import { useRecurring } from "../hooks/useRecurring";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import type { Recurring, RecurringInput } from "../types";
import { getCategoryLabel, parseBRLInput, formatBRLInput } from "@/modules/receipts/utils/receiptFormatters";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import type { CostCenter } from "@/modules/cost-centers/types";

interface FormState {
  name: string;
  direction: "expense" | "income";
  total_value: string;
  day_of_month: string;
  category: string;
  vendor: string;
  cost_center_id: string;
  /** "" = indeterminado | "12"/"24"/"36"/"48" = preset | "custom" */
  duration: string;
  /** nº de meses quando duration === "custom" */
  durationCustom: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  direction: "expense",
  total_value: "",
  day_of_month: "5",
  category: "outros_despesa",
  vendor: "",
  cost_center_id: "",
  duration: "indef",
  durationCustom: "",
};

const DURATION_PRESETS = ["12", "24", "36", "48"];

/** Deriva a duração (meses restantes, a partir do mês corrente) de um end_date.
 *  "indef" = indeterminado. Recompor na gravação preserva o mesmo fim. */
function durationFromEndDate(endDate: string | null): { duration: string; custom: string } {
  if (!endDate) return { duration: "indef", custom: "" };
  const [y, m] = endDate.split("-").map(Number);
  const now = new Date();
  const months = (y * 12 + (m - 1)) - (now.getFullYear() * 12 + now.getMonth()) + 1;
  if (months <= 0) return { duration: "indef", custom: "" };
  if (DURATION_PRESETS.includes(String(months))) return { duration: String(months), custom: "" };
  return { duration: "custom", custom: String(months) };
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return d && m && y ? `${d}/${m}/${y}` : yyyymmdd;
}

export default function RecurringPage() {
  const { user } = useAuth();
  const ccs = user?.costCenters || [];
  const { items, loading, error, create, update, remove } = useRecurring();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Recurring | null>(null);
  const [removing, setRemoving] = useState(false);

  const { categories: allCategories } = useCategories();
  const showCC = ccs.length > 1;

  // Filtra por direction (expense vs income) e agrupa por group_name
  // preservando ordem (categories ja vem ordenado do hook).
  const groupedCategories = (() => {
    const filtered = allCategories.filter((c) => c.direction === form.direction);
    const groups: { name: string; items: typeof filtered }[] = [];
    for (const c of filtered) {
      const g = c.group_name || "Outras";
      const last = groups[groups.length - 1];
      if (last && last.name === g) last.items.push(c);
      else groups.push({ name: g, items: [c] });
    }
    return groups;
  })();

  const categoryOptions = groupedCategories.flatMap((g) =>
    g.items.map((c) => ({ value: c.slug, label: c.name, group: g.name })),
  );

  function openNew() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      cost_center_id: ccs.find((c) => c.is_default)?.id || ccs[0]?.id || "",
    });
    setDialogOpen(true);
  }

  function openEdit(r: Recurring) {
    setEditing(r);
    const dur = durationFromEndDate(r.end_date);
    setForm({
      name: r.name,
      direction: r.direction,
      total_value: r.total_value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      day_of_month: String(r.day_of_month),
      category: r.category || (r.direction === "income" ? "outros_receita" : "outros_despesa"),
      vendor: r.vendor || "",
      cost_center_id: r.cost_center_id || "",
      duration: dur.duration,
      durationCustom: dur.custom,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error("Nome obrigatorio"); return; }
    const total = parseBRLInput(form.total_value);
    if (!Number.isFinite(total) || total <= 0) { toast.error("Valor invalido"); return; }
    const day = Number(form.day_of_month);
    if (!Number.isFinite(day) || day < 1 || day > 28) {
      toast.error("Dia do mes deve estar entre 1 e 28");
      return;
    }
    let durationMonths: number | null = null;
    if (form.duration === "custom") {
      const n = Number(form.durationCustom);
      if (!Number.isFinite(n) || n < 1 || n > 120) {
        toast.error("Duração personalizada deve ser entre 1 e 120 meses");
        return;
      }
      durationMonths = Math.floor(n);
    } else if (form.duration !== "indef") {
      durationMonths = Number(form.duration);
    }
    setSaving(true);
    const payload: RecurringInput = {
      name: form.name.trim().toUpperCase(),
      direction: form.direction,
      total_value: total,
      day_of_month: day,
      category: form.category || null,
      vendor: form.vendor.trim().toUpperCase() || null,
      cost_center_id: form.cost_center_id || null,
      duration_months: durationMonths,
    };
    let ok = false;
    if (editing) {
      ok = await update(editing.id, payload);
    } else {
      const created = await create(payload);
      ok = !!created;
    }
    setSaving(false);
    if (ok) {
      toast.success(editing ? "Recorrência atualizada" : "Recorrência criada");
      setDialogOpen(false);
    }
  }

  async function handleToggleActive(r: Recurring) {
    const ok = await update(r.id, { active: !r.active } as Partial<RecurringInput>);
    if (ok) toast.success(r.active ? "Pausada" : "Reativada");
  }

  function handleRemove(r: Recurring) {
    setPendingRemove(r);
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      const ok = await remove(pendingRemove.id);
      if (ok) toast.success("Removida");
      setPendingRemove(null);
    } finally {
      setRemoving(false);
    }
  }

  const active = items.filter((i) => i.active);
  const inactive = items.filter((i) => !i.active);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-start gap-2">
        <Button variant="outline" onClick={openNew} className="w-full sm:w-auto">
          <Plus className="size-4 mr-1" />
          Nova Recorrência
        </Button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyStateCard
          icon={Repeat}
          title="Nenhuma recorrência ainda"
          description="crie uma pra gerar lançamentos todo mês automaticamente"
        />
      ) : (
        <>
          <Section title="Ativas" items={active} {...{ openEdit, handleToggleActive, handleRemove, showCC, ccs, categories: allCategories }} />
          {inactive.length > 0 && (
            <Section title="Pausadas" items={inactive} faded {...{ openEdit, handleToggleActive, handleRemove, showCC, ccs, categories: allCategories }} />
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Recorrência" : "Nova Recorrência"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Nome</label>
              <Input
                placeholder="Energia, Internet, Salario do Joao..."
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value.toUpperCase() }))}
                maxLength={80}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tipo</label>
                <Select
                  value={form.direction}
                  onValueChange={(v) => setForm((s) => ({
                    ...s,
                    direction: v as "expense" | "income",
                    category: v === "income" ? "outros_receita" : "outros_despesa",
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Valor médio (R$)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="850,00"
                  value={form.total_value}
                  onChange={(e) => setForm((s) => ({ ...s, total_value: formatBRLInput(e.target.value) }))}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Estimativa por mês. Você ajusta o valor real em cada lançamento.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Dia do Mês</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={28}
                  value={form.day_of_month}
                  onChange={(e) => setForm((s) => ({ ...s, day_of_month: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Categoria</label>
                <SearchableSelect
                  options={categoryOptions}
                  value={form.category}
                  onValueChange={(v) => setForm((s) => ({ ...s, category: v }))}
                  placeholder="Selecione..."
                  searchPlaceholder="Buscar categoria..."
                  emptyMessage="Nenhuma categoria."
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Duração</label>
                <Select
                  value={form.duration}
                  onValueChange={(v) => setForm((s) => ({ ...s, duration: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indef">Indeterminado</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                    <SelectItem value="24">24 meses</SelectItem>
                    <SelectItem value="36">36 meses</SelectItem>
                    <SelectItem value="48">48 meses</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.duration === "custom" && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Meses (1–120)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={120}
                    placeholder="Ex.: 18"
                    value={form.durationCustom}
                    onChange={(e) => setForm((s) => ({ ...s, durationCustom: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Origem (Opcional)</label>
              <Input
                placeholder="Cemig, Vivo, Joao Silva..."
                value={form.vendor}
                onChange={(e) => setForm((s) => ({ ...s, vendor: e.target.value.toUpperCase() }))}
                maxLength={80}
              />
            </div>
            {showCC && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Centro de Custo</label>
                <Select
                  value={form.cost_center_id || ""}
                  onValueChange={(v) => setForm((s) => ({ ...s, cost_center_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={pendingRemove !== null}
        onOpenChange={(o) => {
          if (!o) setPendingRemove(null);
        }}
        title="Remover Recorrência"
        description={
          pendingRemove
            ? `Remover "${pendingRemove.name}"? Os lançamentos previstos futuros serão apagados; os já confirmados ou passados continuam.`
            : ""
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        loading={removing}
        loadingLabel="Removendo..."
        onConfirm={confirmRemove}
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  items: Recurring[];
  faded?: boolean;
  openEdit: (r: Recurring) => void;
  handleToggleActive: (r: Recurring) => void;
  handleRemove: (r: Recurring) => void;
  showCC: boolean;
  ccs: CostCenter[];
  categories: Parameters<typeof getCategoryLabel>[1];
}

function Section({ title, items, faded, openEdit, handleToggleActive, handleRemove, showCC, ccs, categories }: SectionProps) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-slate-500">{title}</h2>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${faded ? "opacity-60" : ""}`}>
        {items.map((r) => {
          const cc = r.cost_center_id ? ccs.find((c) => c.id === r.cost_center_id) ?? null : null;
          return (
          <div key={r.id} className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className={`inline-flex items-center justify-center rounded-md shrink-0 size-8 ${r.direction === "income" ? "bg-emerald-100" : "bg-slate-100"}`}>
                <Repeat className={`size-[62%] ${r.direction === "income" ? "text-emerald-700" : "text-slate-600"}`} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900 truncate flex-1 min-w-0">{r.name.toUpperCase()}</h3>
                  <Badge size="compact" colorScheme={r.direction === "income" ? "emerald" : "slate"}>
                    {r.direction === "income" ? "receita" : "despesa"}
                  </Badge>
                </div>
                <div className="text-sm text-slate-700 mt-1">{fmtBRL(r.total_value)} - dia {r.day_of_month}</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {r.vendor && <span>{r.vendor.toUpperCase()} - </span>}
                  {getCategoryLabel(r.category, categories)}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  Projetado até: <span className="font-medium text-slate-700">{fmtDate(r.next_run_date)}</span>
                  {r.end_date && (
                    <span className="text-slate-400"> · termina {fmtDate(r.end_date)}</span>
                  )}
                </div>
              </div>
            </div>
            {showCC && cc && (
              <div className="border-t border-slate-100 -mx-4 px-4 pt-3 flex items-center gap-2.5">
                <CostCenterChip icon={cc.icon} color={cc.color} className="size-8" />
                <span className="font-medium text-slate-900 truncate">{cc.name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 border-t border-slate-100 -mx-4 px-4 pt-3">
              <ActionIconButton icon={Pencil} label="Editar" onClick={() => openEdit(r)} />
              <ActionIconButton
                icon={r.active ? Pause : Play}
                label={r.active ? "Pausar" : "Reativar"}
                onClick={() => handleToggleActive(r)}
              />
              <ActionIconButton
                icon={Trash2}
                label="Remover"
                tone="danger"
                onClick={() => handleRemove(r)}
              />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
