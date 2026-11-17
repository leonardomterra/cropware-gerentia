import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import MapPin from "~icons/ph/map-pin";
import Flag from "~icons/ph/flag-fill";
import Plus from "~icons/ph/plus";
import Pencil from "~icons/ph/pencil-simple";
import Trash2 from "~icons/ph/trash";
import Checklist from "~icons/ph/list-checks";
import Search from "~icons/ph/magnifying-glass";
import X from "~icons/ph/x";
import ChevronDown from "~icons/ph/caret-down";
import ArrowsDownUp from "~icons/ph/arrows-down-up";
import CheckCircle from "~icons/ph/check-circle";
import Undo from "~icons/ph/arrow-u-up-left";
import Archive from "~icons/ph/archive";
import SwapHoriz from "~icons/ph/arrows-left-right";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BOTAO_BARRA,
  BOTAO_BARRA_PRIMARIO,
  ICONE_BOTAO_BARRA,
  MENU_DA_BARRA,
  MENU_ESCURO,
  ROTULO_PAINEL_ESCURO,
  SETA_BOTAO_BARRA,
} from "@/lib/ui-tokens";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/ui/utils";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { Obrigatorio } from "@/components/ui/Obrigatorio";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { useAuth } from "@/contexts/AuthContext";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import type { CostCenter } from "@/modules/cost-centers/types";
import {
  MarcaDeOrigem,
  origemDoLancamento,
  origemDoLembrete,
} from "../components/MarcaDeOrigem";
import { useTasks } from "../hooks/useTasks";
import type { Task, TaskInput, TaskKind, TaskPriority } from "../types";
import { ROTULO_DO_GRUPO, TIPOS_DE_PENDENCIA, agrupar } from "../agrupar";
import { modulosVisiveis } from "@/lib/modulos";
import { useOpcoesDeVinculo } from "@/modules/field/hooks/useOpcoesDeVinculo";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  useReceipts,
  updateReceipt,
} from "@/modules/receipts/hooks/useReceipts";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import {
  getCategoryLabel,
  formatBRLInput,
  parseBRLInput,
} from "@/modules/receipts/utils/receiptFormatters";
import {
  ReceiptFormDialog,
  type FormState,
} from "@/modules/receipts/components/ReceiptFormDialog";
import type { Receipt } from "@/modules/receipts/types";

/**
 * Horizonte da tela, em dias. TETO de 3 meses: além disso a coluna vira lista
 * de projeção de recorrência, não pendência — e "pendência" é o que exige
 * decisão agora. Sem opção "tudo" pelo mesmo motivo.
 */
type Prazo = "7" | "30" | "90";
const PRAZO_PADRAO: Prazo = "30";

/**
 * O item cabe no horizonte?
 *
 * VENCIDO PASSA SEMPRE, e sem data também. O horizonte corta o FUTURO: esconder
 * uma conta vencida porque o prazo escolhido foi curto seria esconder
 * exatamente o que não pode passar batido. E item sem data não tem como ser
 * comparado — sumir com ele o perderia de vista para sempre.
 */
function dentroDoPrazo(due: string | null | undefined, prazo: Prazo): boolean {
  if (!due) return true;
  const hoje = todayISO();
  if (due <= hoje) return true;
  const limite = new Date(`${hoje}T00:00:00`);
  limite.setDate(limite.getDate() + Number(prazo));
  return due <= limite.toLocaleDateString("en-CA");
}

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
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Texto e cor da linha de prazo. Um helper só para os dois cards — lembrete e
 * financeiro — porque a linha diz a mesma coisa nos dois e duplicada ia
 * divergir na primeira correção.
 *
 * O TEXTO carrega o estado, não só a cor: "17/07" sozinho era o mesmo número
 * quer a data já tivesse passado, quer ainda fosse chegar, e obrigava a pessoa
 * a comparar com a data de hoje de cabeça.
 *
 * Cores: `red-600` é o vermelho MAIS CLARO que passa em 4,5:1 como texto
 * (4,53:1) — o 500 dá 3,76 e reprova. Vencido vai ao 800 para a diferença
 * entre os dois estados sobreviver a uma olhada rápida, e não depender de ler
 * "vence" x "venceu".
 */
function prazoDoCard(due: string | null | undefined, resolvido: boolean) {
  if (!due) return { texto: "sem prazo", classe: "text-slate-400" };
  const vencido = !resolvido && due < todayISO();
  if (resolvido)
    return { texto: `venceu ${fmtDate(due)}`, classe: "text-slate-400" };
  return {
    texto: `${vencido ? "venceu" : "vence"} ${fmtDate(due)}`,
    classe: vencido ? "text-red-800 font-medium" : "text-red-700",
  };
}

function fmtDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  if (!y || !m || !d) return yyyymmdd;
  const curY = todayISO().slice(0, 4);
  return y === curY ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

const isPaid = (r: Receipt) => r.status === "pago" || r.status === "recebido";

// Radix Select nao aceita value="" — sentinela p/ "sem centro".
const NO_CC = "__none__";

interface FormStateTask {
  title: string;
  due_date: string;
  notes: string;
  total_value: string; // mascarado (formatBRLInput), igual ao form de lançamento
  cost_center_id: string;
  // Agenda (fase 3 da unificação).
  due_time: string;
  kind: TaskKind;
  priority: TaskPriority;
  location: string;
  farm_id: string;
  plot_id: string;
}

const EMPTY_FORM: FormStateTask = {
  title: "",
  due_date: "",
  notes: "",
  total_value: "",
  cost_center_id: NO_CC,
  due_time: "",
  kind: "lembrete",
  priority: "normal",
  location: "",
  farm_id: "",
  plot_id: "",
};

export default function PendenciasPage() {
  const { user, isViewer, isMaster } = useAuth();
  const { tasks, loading, create, update, remove, toggleDone } = useTasks();
  // Fazenda/talhão do compromisso — só com o módulo Field visível.
  const fieldVisivel = modulosVisiveis(user?.modules, isMaster).includes(
    "field",
  );
  const vinculo = useOpcoesDeVinculo(fieldVisivel);
  const nomeDaFazenda = new Map(vinculo.fazendas.map((f) => [f.id, f.name]));
  const nomeDoTalhao = new Map(vinculo.talhoes.map((t) => [t.id, t.name]));
  const ondeFica = (t: Task) =>
    [
      t.plot_id ? nomeDoTalhao.get(t.plot_id) : null,
      t.farm_id ? nomeDaFazenda.get(t.farm_id) : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;
  const {
    receipts,
    loading: finLoading,
    refetch: refetchFin,
  } = useReceipts({ status: ["a_pagar", "a_receber", "vencido"] });
  // allCategories (e nao `categories`): aqui so resolvemos ROTULO de
  // lancamento ja gravado, que pode apontar pra categoria desativada.
  const { allCategories: categories } = useCategories();

  const ccById = new Map(
    (user?.costCenters ?? []).map((c) => [c.id, c] as const),
  );

  // Cópia local do financeiro: ao "pagar", o item continua na lista (disabled)
  // até ser tirado — por isso não re-buscamos após as ações.
  const [fin, setFin] = useState<Receipt[]>([]);
  useEffect(() => {
    setFin(receipts);
  }, [receipts]);

  const [query, setQuery] = useState("");
  const [hideDone, setHideDone] = useState(false);
  // Horizonte em dias. O padrão é 30 porque a tela mostrava TUDO — e uma
  // recorrência projeta meses à frente, enchendo a coluna de coisas que não são
  // problema de hoje.
  const [prazo, setPrazo] = useState<Prazo>("30");
  const [ordem, setOrdem] = useState<
    "vencimento" | "maior" | "menor" | "origem"
  >("vencimento");

  const [formAberto, setFormAberto] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<FormStateTask>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Task | null>(null);
  const [removing, setRemoving] = useState(false);
  const [finConfirm, setFinConfirm] = useState<{
    r: Receipt;
    action: "pay" | "archive";
  } | null>(null);
  // Conversão lembrete -> lançamento (abre o form pré-preenchido).
  const [convert, setConvert] = useState<{
    task: Task;
    seed: Partial<FormState>;
  } | null>(null);

  const activeFilters = (hideDone ? 1 : 0) + (prazo !== PRAZO_PADRAO ? 1 : 0);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormAberto(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      due_date: t.due_date || "",
      notes: t.notes || "",
      // Centavos -> mascara, do mesmo jeito que o form de lançamento semeia.
      total_value: t.total_value
        ? formatBRLInput(String(Math.round(t.total_value * 100)))
        : "",
      cost_center_id: t.cost_center_id || NO_CC,
      due_time: t.due_time ? t.due_time.slice(0, 5) : "",
      kind: t.kind ?? "lembrete",
      priority: t.priority ?? "normal",
      location: t.location || "",
      farm_id: t.farm_id || "",
      plot_id: t.plot_id || "",
    });
    setFormAberto(true);
  }

  // `?abrir=<id>` — o Calendário manda para cá com o lembrete a abrir.
  const [params, setParams] = useSearchParams();
  const abrirId = params.get("abrir");
  useEffect(() => {
    if (!abrirId || loading) return;
    const t = tasks.find((x) => x.id === abrirId);
    if (t) openEdit(t);
    setParams((p) => {
      p.delete("abrir");
      return p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId, loading, tasks]);

  async function handleSubmit() {
    const title = form.title.trim();
    if (!title) {
      toast.error("Escreva o que resolver");
      return;
    }
    setSaving(true);
    const v = parseBRLInput(form.total_value);
    const payload: TaskInput = {
      title: title.toUpperCase(),
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
      total_value: Number.isFinite(v) && v > 0 ? v : null,
      cost_center_id:
        form.cost_center_id === NO_CC ? null : form.cost_center_id,
      due_time: form.due_time || null,
      kind: form.kind,
      priority: form.priority,
      location: form.location.trim() || null,
      // Sem o Field visível, não mexe no vínculo (o servidor mantém o que há).
      ...(fieldVisivel
        ? { farm_id: form.farm_id || null, plot_id: form.plot_id || null }
        : {}),
    };
    const ok = editing
      ? await update(editing.id, payload)
      : !!(await create(payload));
    setSaving(false);
    if (ok) {
      toast.success(editing ? "Lembrete atualizado" : "Lembrete criado");
      setFormAberto(false);
    } else toast.error("Não consegui salvar");
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      const ok = await remove(pendingRemove.id);
      if (ok) toast.success("Removido");
      setPendingRemove(null);
    } finally {
      setRemoving(false);
    }
  }

  // Converter lembrete -> lançamento: semeia o form (título vira origem, data
  // vira vencimento, valor e centro passam adiante) e abre pré-preenchido.
  function openConvert(t: Task, kind: ConvertKind) {
    const base: Partial<FormState> = { vendor: t.title.toUpperCase() };
    if (t.total_value)
      base.total_value = formatBRLInput(
        String(Math.round(t.total_value * 100)),
      );
    if (t.cost_center_id) base.cost_center_id = t.cost_center_id;
    let seed: Partial<FormState>;
    if (kind === "a_pagar")
      seed = {
        ...base,
        direction: "expense",
        status: "a_pagar",
        due_date: t.due_date ?? "",
      };
    else if (kind === "a_receber")
      seed = {
        ...base,
        direction: "income",
        status: "a_receber",
        due_date: t.due_date ?? "",
      };
    else
      seed = {
        ...base,
        direction: "expense",
        status: "pago",
        transaction_date: t.due_date ?? todayISO(),
        paid_date: t.due_date ?? todayISO(),
      };
    setConvert({ task: t, seed });
  }

  async function onConvertSaved() {
    const t = convert?.task;
    setConvert(null);
    if (t && !t.done) await toggleDone(t); // vira lançamento => o lembrete se resolve
    await refetchFin(); // traz o novo lançamento pra coluna
    toast.success("Convertido em lançamento");
  }

  // --- financeiro: pagar / desfazer / tirar (otimista, sem refetch) ---
  async function applyFinStatus(r: Receipt, paid: boolean) {
    const status = paid
      ? r.direction === "income"
        ? "recebido"
        : "pago"
      : r.direction === "income"
        ? "a_receber"
        : "a_pagar";
    const paid_date = paid ? todayISO() : null;
    setFin((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status, paid_date } : x)),
    );
    try {
      await updateReceipt(r.id, { status, paid_date });
    } catch {
      toast.error("Não consegui atualizar");
      setFin((prev) => prev.map((x) => (x.id === r.id ? r : x))); // reverte
    }
  }
  function doArchive(r: Receipt) {
    setFin((prev) => prev.filter((x) => x.id !== r.id));
  }

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
    dentroDoPrazo(t.due_date, prazo);
  const finMatch = (r: Receipt) =>
    (!q ||
      [r.vendor, r.description, r.category].some((s) =>
        (s || "").toLowerCase().includes(q),
      )) &&
    (!hideDone || !isPaid(r)) &&
    dentroDoPrazo(r.due_date, prazo);
  // RESOLVIDO SEMPRE POR ÚLTIMO, qualquer que seja a ordenação escolhida: um
  // item já pago no topo da coluna é ruído — a coluna existe para mostrar o que
  // falta. A escolha do menu decide só o desempate entre os pendentes.
  const desempate = (
    venc: string | null | undefined,
    valor: number,
    nome: string,
  ) => ({ venc: venc || "9999-99-99", valor, nome: nome.toLowerCase() });

  const compararPor = (
    x: ReturnType<typeof desempate>,
    y: ReturnType<typeof desempate>,
  ) => {
    switch (ordem) {
      case "maior":
        return y.valor - x.valor;
      case "menor":
        return x.valor - y.valor;
      case "origem":
        return x.nome.localeCompare(y.nome, "pt-BR");
      default:
        return x.venc < y.venc ? -1 : x.venc > y.venc ? 1 : 0;
    }
  };

  const byResolvedThenDue = (a: Receipt, b: Receipt) => {
    const ra = isPaid(a) ? 1 : 0,
      rb = isPaid(b) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return compararPor(
      desempate(
        a.due_date,
        Number(a.total_value) || 0,
        a.vendor || a.description || "",
      ),
      desempate(
        b.due_date,
        Number(b.total_value) || 0,
        b.vendor || b.description || "",
      ),
    );
  };
  const byDoneThenDue = (a: Task, b: Task) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return compararPor(
      desempate(a.due_date, Number(a.total_value) || 0, a.title || ""),
      desempate(b.due_date, Number(b.total_value) || 0, b.title || ""),
    );
  };

  // Cópia antes de ordenar: sort() é in-place e as listas vêm dos hooks.
  const visibleTasks = [...tasks].filter(taskMatch).sort(byDoneThenDue);
  const aPagar = fin
    .filter((r) => r.direction === "expense" && finMatch(r))
    .sort(byResolvedThenDue);
  const aReceber = fin
    .filter((r) => r.direction === "income" && finMatch(r))
    .sort(byResolvedThenDue);
  const totalVisivel = visibleTasks.length + aPagar.length + aReceber.length;
  const temFiltroAtivo = activeFilters > 0 || query.trim() !== "";
  const limparFiltros = () => {
    setQuery("");
    setHideDone(false);
    setPrazo(PRAZO_PADRAO);
  };

  const ccs = user?.costCenters ?? [];

  const renderFin = (r: Receipt) => (
    <FinancialCard
      key={r.id}
      r={r}
      cc={r.cost_center_id ? (ccById.get(r.cost_center_id) ?? null) : null}
      categoryLabel={getCategoryLabel(r.category, categories)}
      onResolve={() => setFinConfirm({ r, action: "pay" })}
      onUndo={() => void applyFinStatus(r, false)}
      onArchive={() => setFinConfirm({ r, action: "archive" })}
    />
  );

  // Criar/editar SUBSTITUI o quadro, na mesma rota — não é dialog. Ver
  // `PaginaDeFormulario` e docs/PADRAO-DE-PAGINA.md §6.
  if (formAberto) {
    return (
      <PaginaDeFormulario
        formId="form-lembrete"
        rotuloSalvar={editing ? "Salvar" : "Criar Lembrete"}
        descricao={editing ? `Editando ${editing.title}` : "Novo lembrete"}
        aoVoltar={() => setFormAberto(false)}
        salvando={saving}
      >
        <form
          id="form-lembrete"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              O que resolver
              <Obrigatorio />
            </label>
            <Input
              placeholder="Ex.: pagar o contador"
              value={form.title}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  title: e.target.value.toUpperCase(),
                }))
              }
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Data
              </label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm((s) => ({ ...s, due_date: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Valor R$
              </label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={form.total_value}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    total_value: formatBRLInput(e.target.value),
                  }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Hora
              </label>
              <Input
                type="time"
                value={form.due_time}
                onChange={(e) =>
                  setForm((s) => ({ ...s, due_time: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Tipo
              </label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, kind: v as TaskKind }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_DE_PENDENCIA).map(([v, rotulo]) => (
                    <SelectItem key={v} value={v}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Prioridade
              </label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, priority: v as TaskPriority }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Local
              </label>
              <Input
                placeholder="Endereço ou online"
                value={form.location}
                onChange={(e) =>
                  setForm((s) => ({ ...s, location: e.target.value }))
                }
                maxLength={200}
              />
            </div>
          </div>
          {fieldVisivel && vinculo.fazendas.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Fazenda
                </label>
                <SearchableSelect
                  options={[
                    { value: "", label: "Sem fazenda" },
                    ...vinculo.fazendas.map((f) => ({
                      value: f.id,
                      label: f.name,
                    })),
                  ]}
                  value={form.farm_id}
                  onValueChange={(v) =>
                    setForm((s) => ({
                      ...s,
                      farm_id: v,
                      plot_id: v === s.farm_id ? s.plot_id : "",
                    }))
                  }
                  searchPlaceholder="Buscar fazenda..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Talhão
                </label>
                <SearchableSelect
                  options={[
                    { value: "", label: "Fazenda inteira" },
                    ...vinculo.talhoes
                      .filter((t) => t.farm_id === form.farm_id)
                      .map((t) => ({ value: t.id, label: t.name })),
                  ]}
                  value={form.plot_id}
                  onValueChange={(v) => setForm((s) => ({ ...s, plot_id: v }))}
                  searchPlaceholder="Buscar talhão..."
                  disabled={!form.farm_id}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ccs.length > 1 && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Centro de Custo
                </label>
                <Select
                  value={form.cost_center_id}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, cost_center_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CC}>Sem centro</SelectItem>
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
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Observação
            </label>
            <Textarea
              placeholder="Detalhes..."
              value={form.notes}
              onChange={(e) =>
                setForm((s) => ({ ...s, notes: e.target.value }))
              }
              maxLength={1000}
              rows={3}
            />
          </div>
        </form>
      </PaginaDeFormulario>
    );
  }

  return (
    <div className="space-y-4">
      {/* A barra é a mesma do app inteiro; o layout e a regra do celular moram
          na BarraDeTela. Ver components/ui/BarraDeTela.tsx e §2 do padrão. */}
      <BarraDeTela
        buscaAtiva={Boolean(query)}
        busca={
          <div className="relative">
            <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por lembrete, origem ou descrição..."
              className="pl-8 h-9 border-slate-200 shadow-none text-slate-500"
            />
          </div>
        }
        filtrosAtivos={activeFilters}
        painel={
          <>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer select-none">
              <Checkbox
                checked={hideDone}
                onCheckedChange={(v) => setHideDone(!!v)}
              />
              Ocultar resolvidos
            </label>
            <div className="space-y-1.5">
              <label className={ROTULO_PAINEL_ESCURO}>Prazo</label>
              <Select value={prazo} onValueChange={(v) => setPrazo(v as Prazo)}>
                <SelectTrigger className="h-9 bg-white text-slate-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Próxima semana</SelectItem>
                  <SelectItem value="30">Próximo mês</SelectItem>
                  <SelectItem value="90">Próximos 3 meses</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-white/60">Vencidos aparecem sempre.</p>
            </div>
          </>
        }
        acoes={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Rótulo FIXO: mostrar a opção ativa faria o botão mudar de
                largura a cada escolha. */}
              <button
                type="button"
                className={cn(
                  BOTAO_BARRA,
                  "inline-flex items-center rounded-md",
                )}
              >
                <ArrowsDownUp className={ICONE_BOTAO_BARRA} />
                Ordenar
                <ChevronDown className={SETA_BOTAO_BARRA} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={MENU_DA_BARRA}>
              {(
                [
                  ["vencimento", "Vencimento"],
                  ["maior", "Maior valor"],
                  ["menor", "Menor valor"],
                  ["origem", "Origem (A-Z)"],
                ] as const
              ).map(([valor, rotulo]) => (
                <DropdownMenuItem
                  key={valor}
                  onClick={() => setOrdem(valor)}
                  className={
                    ordem === valor ? "bg-white/10 font-medium" : undefined
                  }
                >
                  {rotulo}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        acaoPrincipal={
          /* Convidado não cadastra. */
          !isViewer ? (
            <Button
              variant="default"
              onClick={openNew}
              className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5")}
            >
              <Plus className="size-[18px] shrink-0" />
              Novo Lembrete
            </Button>
          ) : undefined
        }
      />

      {/* Contador e "Limpar Filtros": à direita no desktop, centralizados no
          celular. Altura reservada porque o "Limpar" aparece e some. */}
      <div className="flex items-center justify-center sm:justify-end gap-1 px-1 min-h-[28px]">
        <p className="text-sm text-slate-500">
          {totalVisivel === 0
            ? "Nenhuma pendência encontrada"
            : `Mostrando ${totalVisivel} ${
                totalVisivel === 1 ? "Pendência" : "Pendências"
              }`}
        </p>
        {temFiltroAtivo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={limparFiltros}
            className="h-8 px-2 font-normal text-red-700 hover:text-red-800 hover:bg-red-50"
            title="Limpar filtros"
          >
            <X className="size-4 mr-1.5" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* 3 colunas no desktop; empilha no mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Column title="Lembretes" count={visibleTasks.length}>
          {loading ? (
            <LoadingState />
          ) : visibleTasks.length === 0 ? (
            <EmptyCol
              minH={TASK_CARD_H}
              icon={<Checklist className="size-8 text-slate-300" />}
              text="Nenhum lembrete"
            />
          ) : (
            // Na ordem por vencimento, a coluna vem em grupos (Atrasados, Hoje,
            // Próximos 7 dias...). Nas outras ordens o agrupamento brigaria
            // com o critério escolhido, então fica a lista corrida.
            (ordem === "vencimento"
              ? agrupar(visibleTasks, todayISO())
              : [{ grupo: null, itens: visibleTasks }]
            ).map(({ grupo, itens }) => (
              <div key={grupo ?? "todos"} className="space-y-2">
                {grupo && (
                  <h3
                    className={cn(
                      "text-xs font-medium uppercase tracking-wide pt-1",
                      grupo === "atrasados" ? "text-red-700" : "text-slate-400",
                    )}
                  >
                    {ROTULO_DO_GRUPO[grupo]} · {itens.length}
                  </h3>
                )}
                {itens.map((t) => (
                  <TaskCard
                    key={t.id}
                    t={t}
                    cc={
                      t.cost_center_id
                        ? (ccById.get(t.cost_center_id) ?? null)
                        : null
                    }
                    onde={ondeFica(t)}
                    onToggleDone={() => void toggleDone(t)}
                    onEdit={() => openEdit(t)}
                    onRemove={() => setPendingRemove(t)}
                    onConvert={(kind) => openConvert(t, kind)}
                  />
                ))}
              </div>
            ))
          )}
        </Column>

        <Column title="Pagar" count={aPagar.length}>
          {finLoading ? (
            <LoadingState />
          ) : aPagar.length === 0 ? (
            <EmptyCol minH={FIN_CARD_H} text="Nada a pagar" />
          ) : (
            aPagar.map(renderFin)
          )}
        </Column>

        <Column title="Receber" count={aReceber.length}>
          {finLoading ? (
            <LoadingState />
          ) : aReceber.length === 0 ? (
            <EmptyCol minH={FIN_CARD_H} text="Nada a receber" />
          ) : (
            aReceber.map(renderFin)
          )}
        </Column>
      </div>

      {/* Dialog criar/editar lembrete */}

      {/* Form de lançamento pré-preenchido (conversão de lembrete) */}
      <ReceiptFormDialog
        open={convert !== null}
        onOpenChange={(o) => {
          if (!o) setConvert(null);
        }}
        seed={convert?.seed ?? null}
        allowItems={false}
        onSaved={onConvertSaved}
        titleNew="Converter em Lançamento"
      />

      {/* Confirmar exclusão/remoção de lembrete */}
      <ConfirmActionDialog
        open={pendingRemove !== null}
        onOpenChange={(o) => {
          if (!o) setPendingRemove(null);
        }}
        title={pendingRemove?.done ? "Tirar da Lista" : "Excluir Lembrete"}
        description={
          pendingRemove ? `Remover "${pendingRemove.title.toUpperCase()}"?` : ""
        }
        confirmLabel={pendingRemove?.done ? "Tirar" : "Excluir"}
        cancelLabel="Cancelar"
        loading={removing}
        loadingLabel="Removendo..."
        onConfirm={confirmRemove}
      />

      {/* Confirmar ação financeira (pagar/receber ou tirar da lista) */}
      <ConfirmActionDialog
        open={finConfirm !== null}
        onOpenChange={(o) => {
          if (!o) setFinConfirm(null);
        }}
        title={
          !finConfirm
            ? ""
            : finConfirm.action === "pay"
              ? finConfirm.r.direction === "income"
                ? "Marcar como Recebido"
                : "Marcar como Pago"
              : "Tirar da Lista"
        }
        description={
          !finConfirm
            ? ""
            : finConfirm.action === "pay"
              ? `${(finConfirm.r.vendor || finConfirm.r.description || "Lançamento").toUpperCase()} — ${fmtBRL(finConfirm.r.total_value)}. Confirmar?`
              : "Some desta lista. O lançamento continua registrado (e pago) no sistema."
        }
        confirmLabel={
          !finConfirm
            ? "Confirmar"
            : finConfirm.action === "pay"
              ? "Confirmar"
              : "Tirar"
        }
        cancelLabel="Cancelar"
        onConfirm={runFinConfirm}
      />
    </div>
  );
}

// ---------- sub-componentes ----------

function Column({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
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

function EmptyCol({
  minH,
  icon,
  text,
}: {
  minH: string;
  icon?: ReactNode;
  text: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 p-3 text-center",
        minH,
      )}
    >
      {icon}
      <span className="text-sm text-slate-400">{text}</span>
    </div>
  );
}

function ConvertMenuItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-2.5 py-2 rounded-md text-sm text-slate-100 hover:bg-white/10 text-left"
    >
      {label}
    </button>
  );
}

// Card de lembrete no mesmo padrão dos financeiros. Ativo: Converter / Editar /
// Excluir. Resolvido (= virou lançamento): disabled + Reativar / Tirar.
//
// "Concluir" avulso SÓ quando não há valor. A decisão de 15/07 era "todo
// lembrete é financeiro, resolver é converter em lançamento" — e continua
// valendo para o lembrete COM valor. Desde a fase 3 da unificação (16/11) a
// pendência também guarda agenda (reunião, visita...), que não tem dinheiro a
// registrar: obrigar a converter isso em lançamento não faria sentido.
function TaskCard({
  t,
  cc,
  onde,
  onToggleDone,
  onEdit,
  onRemove,
  onConvert,
}: {
  t: Task;
  cc: CostCenter | null;
  /** "Talhão · Fazenda" (agenda do Field), quando houver. */
  onde: string | null;
  onToggleDone: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onConvert: (kind: ConvertKind) => void;
}) {
  const [convOpen, setConvOpen] = useState(false);
  // Valor é opcional (lembrete nasce de "anota: X"): sem valor, cinza.
  const hasValue = t.total_value !== null && t.total_value > 0;
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-2",
        TASK_CARD_H,
        t.done && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MarcaDeOrigem origem={origemDoLembrete(t.source)} />
        <span
          className={`font-medium truncate flex-1 min-w-0 ${t.done ? "line-through text-slate-400" : "text-slate-900"}`}
        >
          {t.title.toUpperCase()}
        </span>
        {t.priority === "high" && !t.done && (
          <Flag
            className="size-4 shrink-0 text-red-700"
            aria-label="Prioridade alta"
          />
        )}
      </div>
      {(t.kind && t.kind !== "lembrete") || onde || t.location ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 min-w-0">
          {t.kind && t.kind !== "lembrete" && (
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {TIPOS_DE_PENDENCIA[t.kind]}
            </span>
          )}
          {(onde || t.location) && (
            <span className="inline-flex items-center gap-1 truncate min-w-0">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {[onde, t.location].filter(Boolean).join(" · ")}
              </span>
            </span>
          )}
        </div>
      ) : null}
      {/* Compromisso de agenda (reunião, visita...) sem valor: as linhas de
          dinheiro só diriam "R$ 0,00 · Sem centro". */}
      {(hasValue || t.kind === "lembrete" || !t.kind) && (
        <>
          <div
            className={cn(
              "font-medium",
              hasValue && !t.done ? "text-slate-900" : "text-slate-400",
            )}
          >
            {fmtBRL(t.total_value ?? 0)}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
            {cc && (
              <CostCenterChip
                icon={cc.icon}
                color={cc.color}
                className="size-5 shrink-0"
              />
            )}
            <span className={cn("truncate", !cc && "text-slate-400")}>
              {cc ? cc.name : "Sem centro"}
            </span>
          </div>
        </>
      )}
      <div className={cn("text-sm", prazoDoCard(t.due_date, t.done).classe)}>
        {prazoDoCard(t.due_date, t.done).texto}
        {t.due_date && t.due_time ? ` às ${t.due_time.slice(0, 5)}` : ""}
      </div>
      <div className="flex items-center gap-1 border-t border-slate-100 -mx-3 px-3 pt-2 mt-auto">
        {t.done ? (
          <>
            <ActionIconButton
              icon={Undo}
              label="Reativar"
              onClick={onToggleDone}
            />
            <ActionIconButton
              icon={Archive}
              label="Tirar da lista"
              tone="danger"
              onClick={onRemove}
            />
          </>
        ) : (
          <>
            {!hasValue && (
              <ActionIconButton
                icon={CheckCircle}
                label="Concluir"
                onClick={onToggleDone}
              />
            )}
            <Popover open={convOpen} onOpenChange={setConvOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Converter em lançamento"
                  aria-label="Converter em lançamento"
                  className={ICON_BTN}
                >
                  <SwapHoriz className="size-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                /* Mesmo vidro dos outros menus (`MENU_ESCURO`): este era o
                   último painel do app com o escuro sólido escrito à mão. */
                className={cn(MENU_ESCURO, "p-1 w-56")}
              >
                <ConvertMenuItem
                  label="Conta a Pagar"
                  onClick={() => {
                    setConvOpen(false);
                    onConvert("a_pagar");
                  }}
                />
                <ConvertMenuItem
                  label="Conta a Receber"
                  onClick={() => {
                    setConvOpen(false);
                    onConvert("a_receber");
                  }}
                />
                <ConvertMenuItem
                  label="Lançamento Concluído"
                  onClick={() => {
                    setConvOpen(false);
                    onConvert("concluido");
                  }}
                />
              </PopoverContent>
            </Popover>
            <ActionIconButton icon={Pencil} label="Editar" onClick={onEdit} />
            <ActionIconButton
              icon={Trash2}
              label="Excluir"
              tone="danger"
              onClick={onRemove}
            />
          </>
        )}
      </div>
    </div>
  );
}

function FinancialCard({
  r,
  cc,
  categoryLabel,
  onResolve,
  onUndo,
  onArchive,
}: {
  r: Receipt;
  cc: CostCenter | null;
  categoryLabel: string;
  onResolve: () => void;
  onUndo: () => void;
  onArchive: () => void;
}) {
  const resolved = isPaid(r);
  const resolveLabel =
    r.direction === "income" ? "Marcar como recebido" : "Marcar como pago";
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-2",
        FIN_CARD_H,
        resolved && "opacity-60",
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <MarcaDeOrigem origem={origemDoLancamento(r.source, r.is_estimated)} />
        <div
          className={`font-medium truncate ${resolved ? "line-through text-slate-500" : "text-slate-900"}`}
        >
          {(r.vendor || r.description || "Lançamento").toUpperCase()}
        </div>
      </div>
      <div
        className={`font-medium ${resolved ? "text-slate-500" : "text-slate-900"}`}
      >
        {fmtBRL(r.total_value)}
      </div>
      <div className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
        {cc && (
          <CostCenterChip
            icon={cc.icon}
            color={cc.color}
            className="size-5 shrink-0"
          />
        )}
        <span className="truncate">
          {cc ? cc.name : "Sem centro"}
          {categoryLabel !== "—" ? ` - ${categoryLabel}` : ""}
        </span>
      </div>
      <div className={cn("text-sm", prazoDoCard(r.due_date, resolved).classe)}>
        {prazoDoCard(r.due_date, resolved).texto}
      </div>
      <div className="flex items-center gap-1 border-t border-slate-100 -mx-3 px-3 pt-2 mt-auto">
        {resolved ? (
          <>
            <ActionIconButton
              icon={Undo}
              label="Voltar a pendente"
              onClick={onUndo}
            />
            <ActionIconButton
              icon={Archive}
              label="Tirar da lista"
              tone="danger"
              onClick={onArchive}
            />
          </>
        ) : (
          <ActionIconButton
            icon={CheckCircle}
            label={resolveLabel}
            onClick={onResolve}
          />
        )}
      </div>
    </div>
  );
}
