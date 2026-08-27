import { useMemo, useState } from "react";
import Plus from "~icons/ph/plus";
import Repeat from "~icons/ph/arrows-clockwise-fill";
import Search from "~icons/ph/magnifying-glass";
import ChevronDown from "~icons/ph/caret-down";
import ArrowsDownUp from "~icons/ph/arrows-down-up";
import X from "~icons/ph/x";
import { toast } from "sonner";
import { Ajuda } from "@/components/ui/Ajuda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import MoreVertical from "~icons/ph/dots-three-vertical";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import { Obrigatorio } from "@/components/ui/Obrigatorio";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import {
  BOTAO_ACOES,
  BOTAO_BARRA,
  BOTAO_BARRA_PRIMARIO,
  CAMPO_BARRA,
  ICONE_BOTAO_BARRA,
  MENU_DA_BARRA,
  ROTULO_PAINEL_ESCURO,
  SETA_BOTAO_BARRA,
} from "@/lib/ui-tokens";
import { useAuth } from "@/contexts/AuthContext";
import { useRecurring } from "../hooks/useRecurring";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import type { Recurring, RecurringInput } from "../types";
import {
  getCategoryLabel,
  parseBRLInput,
  formatBRLInput,
} from "@/modules/receipts/utils/receiptFormatters";
import {
  AllCentersChip,
  CostCenterChip,
  ccTextColor,
} from "@/modules/cost-centers/ccIcons";
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
function durationFromEndDate(endDate: string | null): {
  duration: string;
  custom: string;
} {
  if (!endDate) return { duration: "indef", custom: "" };
  const [y, m] = endDate.split("-").map(Number);
  const now = new Date();
  const months =
    y * 12 + (m - 1) - (now.getFullYear() * 12 + now.getMonth()) + 1;
  if (months <= 0) return { duration: "indef", custom: "" };
  if (DURATION_PRESETS.includes(String(months)))
    return { duration: String(months), custom: "" };
  return { duration: "custom", custom: String(months) };
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

function fmtDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return d && m && y ? `${d}/${m}/${y}` : yyyymmdd;
}

export default function RecurringPage() {
  const { user } = useAuth();
  const ccs = user?.costCenters || [];
  const { items, loading, error, create, update, remove } = useRecurring();
  const [formAberto, setFormAberto] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);
  // Ver é a MESMA tela de editar, travada — nunca uma segunda tela, que
  // divergiria da de edição em algum campo no primeiro ajuste.
  const [somenteLeitura, setSomenteLeitura] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Recurring | null>(null);
  const [removing, setRemoving] = useState(false);

  const { categories: allCategories } = useCategories();
  const showCC = ccs.length > 1;

  // Busca, filtros e ordenação — mesmo desenho de Lançamentos e Relatórios: o
  // que se consulta toda hora fica à vista, o resto mora no painel.
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState<"all" | "expense" | "income">("all");
  const [fSituacao, setFSituacao] = useState<"all" | "ativas" | "pausadas">(
    "all",
  );
  const [fCategorias, setFCategorias] = useState<string[]>([]);
  const [fCC, setFCC] = useState<string>("all");
  const [ordem, setOrdem] = useState<
    "nome" | "maior" | "menor" | "dia" | "proxima"
  >("nome");

  // Filtra por direction (expense vs income) e agrupa por group_name
  // preservando ordem (categories ja vem ordenado do hook).
  const groupedCategories = (() => {
    const filtered = allCategories.filter(
      (c) => c.direction === form.direction,
    );
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
    setSomenteLeitura(false);
    setFormAberto(true);
  }

  function openEdit(r: Recurring, leitura = false) {
    setSomenteLeitura(leitura);
    setEditing(r);
    const dur = durationFromEndDate(r.end_date);
    setForm({
      name: r.name,
      direction: r.direction,
      total_value: r.total_value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      day_of_month: String(r.day_of_month),
      category:
        r.category ||
        (r.direction === "income" ? "outros_receita" : "outros_despesa"),
      vendor: r.vendor || "",
      cost_center_id: r.cost_center_id || "",
      duration: dur.duration,
      durationCustom: dur.custom,
    });
    setFormAberto(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Nome obrigatorio");
      return;
    }
    const total = parseBRLInput(form.total_value);
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Valor invalido");
      return;
    }
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
      setFormAberto(false);
      setSomenteLeitura(false);
    }
  }

  async function handleToggleActive(r: Recurring) {
    const ok = await update(r.id, {
      active: !r.active,
    } as Partial<RecurringInput>);
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

  const opcoesCategoria = useMemo(
    () =>
      allCategories.map((c) => ({
        value: c.slug,
        label: c.name,
        group: c.group_name ?? "Outras",
      })),
    [allCategories],
  );

  // Só CAMPOS do painel contam: a busca e o centro estão à vista, e um badge
  // sobre o botão de Filtros apontando para algo que já se vê é ruído.
  const filtrosNoPainel =
    (fTipo !== "all" ? 1 : 0) +
    (fSituacao !== "all" ? 1 : 0) +
    (fCategorias.length > 0 ? 1 : 0);
  const temFiltroAtivo =
    filtrosNoPainel > 0 || busca.trim() !== "" || fCC !== "all";

  const limparFiltros = () => {
    setBusca("");
    setFTipo("all");
    setFSituacao("all");
    setFCategorias([]);
    setFCC("all");
  };

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = items.filter((r) => {
      if (fTipo !== "all" && r.direction !== fTipo) return false;
      if (fSituacao === "ativas" && !r.active) return false;
      if (fSituacao === "pausadas" && r.active) return false;
      if (fCategorias.length > 0 && !fCategorias.includes(r.category ?? ""))
        return false;
      if (fCC !== "all" && r.cost_center_id !== fCC) return false;
      if (!termo) return true;
      // Busca nos três campos que a pessoa lembra de cabeça: como ela chamou a
      // recorrência, de quem é, e o que escreveu na descrição.
      return [r.name, r.vendor, r.description].some((campo) =>
        (campo ?? "").toLowerCase().includes(termo),
      );
    });
    const porNome = (a: Recurring, b: Recurring) =>
      a.name.localeCompare(b.name, "pt-BR");
    // Cópia antes de ordenar: sort() é in-place e `items` vem do hook.
    return [...filtrados].sort((a, b) => {
      switch (ordem) {
        case "maior":
          return b.total_value - a.total_value || porNome(a, b);
        case "menor":
          return a.total_value - b.total_value || porNome(a, b);
        case "dia":
          return a.day_of_month - b.day_of_month || porNome(a, b);
        case "proxima":
          return (
            a.next_run_date.localeCompare(b.next_run_date) || porNome(a, b)
          );
        default:
          return porNome(a, b);
      }
    });
  }, [items, busca, fTipo, fSituacao, fCategorias, fCC, ordem]);

  const active = visiveis.filter((i) => i.active);
  const inactive = visiveis.filter((i) => !i.active);

  // Criar/editar/ver SUBSTITUI a lista, na mesma rota — não é dialog. Ver
  // `PaginaDeFormulario` para o porquê (teclado do iOS, rolagem aninhada,
  // largura útil no celular).
  if (formAberto) {
    return (
      <PaginaDeFormulario
        formId="form-recorrencia"
        rotuloSalvar={editing ? "Salvar" : "Criar Recorrência"}
        descricao={
          somenteLeitura
            ? editing?.name || ""
            : editing
              ? `Editando ${editing.name}`
              : "Nova recorrência"
        }
        somenteLeitura={somenteLeitura}
        aoEditar={somenteLeitura ? () => setSomenteLeitura(false) : undefined}
        aoVoltar={() => {
          setFormAberto(false);
          setSomenteLeitura(false);
        }}
        salvando={saving}
      >
        <form
          id="form-recorrencia"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Nome
              <Obrigatorio />
            </label>
            <Input
              placeholder="Energia, Internet, Salario do Joao..."
              value={form.name}
              onChange={(e) =>
                setForm((s) => ({ ...s, name: e.target.value.toUpperCase() }))
              }
              maxLength={80}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Tipo
              </label>
              <Select
                value={form.direction}
                onValueChange={(v) =>
                  setForm((s) => ({
                    ...s,
                    direction: v as "expense" | "income",
                    category:
                      v === "income" ? "outros_receita" : "outros_despesa",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              {/* A ressalva morava num aviso âmbar no topo da tela, como
                  premissa geral. Mas ela fala de UM campo — este — e no topo
                  custava uma faixa inteira, todo dia, para uma informação que
                  serve uma vez. */}
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                Valor médio (R$)
                <Ajuda>
                  É uma estimativa mensal. Você ajusta o valor real em cada
                  lançamento gerado.
                </Ajuda>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="850,00"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Dia do Mês
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={28}
                value={form.day_of_month}
                onChange={(e) =>
                  setForm((s) => ({ ...s, day_of_month: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Categoria
              </label>
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
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Duração
              </label>
              <Select
                value={form.duration}
                onValueChange={(v) => setForm((s) => ({ ...s, duration: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Meses (1–120)
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  placeholder="Ex.: 18"
                  value={form.durationCustom}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, durationCustom: e.target.value }))
                  }
                />
              </div>
            )}
            {showCC && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Centro de Custo
                </label>
                <Select
                  value={form.cost_center_id || ""}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, cost_center_id: v }))
                  }
                >
                  <SelectTrigger>
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
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Origem
            </label>
            <Input
              placeholder="Cemig, Vivo, Joao Silva..."
              value={form.vendor}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  vendor: e.target.value.toUpperCase(),
                }))
              }
              maxLength={80}
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
        buscaAtiva={Boolean(busca)}
        busca={
          <div className="relative">
            <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, origem ou descrição..."
              className="pl-8 h-9 border-slate-200 shadow-none text-slate-500"
            />
          </div>
        }
        campos={
          showCC
            ? [
                {
                  rotulo: "Centro de Custo",
                  ativo: fCC !== "all",
                  campo: (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className={CAMPO_BARRA}>
                          {fCC !== "all" ? (
                            <CostCenterChip
                              icon={ccs.find((c) => c.id === fCC)?.icon}
                              color={ccs.find((c) => c.id === fCC)?.color}
                              className="size-[18px]"
                            />
                          ) : (
                            <AllCentersChip className="size-[18px]" />
                          )}
                          <span
                            className="flex-1 text-left truncate"
                            style={
                              fCC !== "all"
                                ? {
                                    color: ccTextColor(
                                      ccs.find((c) => c.id === fCC)?.color,
                                    ),
                                  }
                                : undefined
                            }
                          >
                            {fCC === "all"
                              ? "Todos os Centros"
                              : (ccs.find((c) => c.id === fCC)?.name ??
                                "Centro")}
                          </span>
                          <ChevronDown className="size-4 text-slate-500 shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        <DropdownMenuItem
                          onClick={() => setFCC("all")}
                          className={
                            fCC === "all"
                              ? "bg-white/10 font-medium gap-2"
                              : "gap-2"
                          }
                        >
                          <AllCentersChip className="size-6" />
                          <span className="min-w-0 flex-1 truncate">Todos</span>
                        </DropdownMenuItem>
                        {ccs.map((cc) => (
                          <DropdownMenuItem
                            key={cc.id}
                            onClick={() => setFCC(cc.id)}
                            className={
                              fCC === cc.id
                                ? "bg-white/10 font-medium gap-2"
                                : "gap-2"
                            }
                          >
                            <CostCenterChip
                              icon={cc.icon}
                              color={cc.color}
                              className="size-6"
                            />
                            <span
                              className="min-w-0 flex-1 truncate"
                              style={{ color: cc.color ?? undefined }}
                            >
                              {cc.name}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ),
                },
              ]
            : []
        }
        filtrosAtivos={filtrosNoPainel}
        painel={
          <>
            {/* Campos BRANCOS sobre o painel escuro: é a separação mais forte
                que existe, e escurecê-los já foi testado e descartado. */}
            <div className="space-y-1.5">
              <label className={ROTULO_PAINEL_ESCURO}>Tipo</label>
              <Select
                value={fTipo}
                onValueChange={(v) => setFTipo(v as typeof fTipo)}
              >
                <SelectTrigger className="h-9 bg-white text-slate-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className={ROTULO_PAINEL_ESCURO}>Situação</label>
              <Select
                value={fSituacao}
                onValueChange={(v) => setFSituacao(v as typeof fSituacao)}
              >
                <SelectTrigger className="h-9 bg-white text-slate-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ativas e pausadas</SelectItem>
                  <SelectItem value="ativas">Só ativas</SelectItem>
                  <SelectItem value="pausadas">Só pausadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className={ROTULO_PAINEL_ESCURO}>Categoria</label>
              <MultiSearchableSelect
                options={opcoesCategoria}
                value={fCategorias}
                onValueChange={setFCategorias}
                placeholder="Todas as categorias"
                searchPlaceholder="Buscar categoria..."
                multiLabel={(n) => `${n} categorias`}
              />
            </div>
          </>
        }
        acoes={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Rótulo FIXO: mostrar a opção ativa faria o botão mudar de
              largura a cada escolha. A ativa se lê abrindo o menu. */}
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
            <DropdownMenuContent align="start" className={MENU_DA_BARRA}>
              {(
                [
                  ["nome", "Nome (A-Z)"],
                  ["maior", "Maior valor"],
                  ["menor", "Menor valor"],
                  ["dia", "Dia do mês"],
                  ["proxima", "Próxima geração"],
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
          /* A ÚNICA ação de fundo escuro da página, como em Lançamentos: é o
             que separa "criar" das demais, todas em cinza. */
          <Button
            variant="default"
            onClick={openNew}
            className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5")}
          >
            <Plus className="size-[18px] shrink-0" />
            Nova Recorrência
          </Button>
        }
      />

      {/* Contador e "Limpar Filtros" como em Lançamentos: à direita no
          desktop, centralizados no celular. */}
      {!error && !loading && items.length > 0 && (
        <div className="flex items-center justify-center sm:justify-end gap-1 px-1 min-h-[28px]">
          <p className="text-sm text-slate-500">
            {visiveis.length === 0
              ? "Nenhuma recorrência encontrada"
              : `Mostrando ${visiveis.length} ${
                  visiveis.length === 1 ? "Recorrência" : "Recorrências"
                }`}
          </p>
          {temFiltroAtivo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="h-8 px-2 font-normal text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Limpar filtros"
            >
              <X className="size-4 mr-1.5" />
              Limpar Filtros
            </Button>
          )}
        </div>
      )}

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
          <Section
            title="Ativas"
            items={active}
            {...{
              openEdit,
              handleToggleActive,
              handleRemove,
              showCC,
              ccs,
              categories: allCategories,
            }}
          />
          {inactive.length > 0 && (
            <Section
              title="Pausadas"
              items={inactive}
              faded
              {...{
                openEdit,
                handleToggleActive,
                handleRemove,
                showCC,
                ccs,
                categories: allCategories,
              }}
            />
          )}
        </>
      )}

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
  openEdit: (r: Recurring, leitura?: boolean) => void;
  handleToggleActive: (r: Recurring) => void;
  handleRemove: (r: Recurring) => void;
  showCC: boolean;
  ccs: CostCenter[];
  categories: Parameters<typeof getCategoryLabel>[1];
}

/**
 * Card de lista no padrão do Flag Field (§27 do ui-polish-patterns): largura
 * total, três colunas, uma linha por registro.
 *
 * As colunas batem entre cards, então o olho desce a página lendo sempre no
 * mesmo lugar — é isso que a grade de 3 por linha não dava, e é o que importa
 * numa lista que se varre.
 *
 * Tons por POSIÇÃO da linha (900 / 700), um tamanho só (14px). Peso separa só a
 * primeira linha da primeira coluna.
 */
function Section({
  title,
  items,
  faded,
  openEdit,
  handleToggleActive,
  handleRemove,
  showCC,
  ccs,
  categories,
}: SectionProps) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-slate-500">{title}</h2>
      <div className={`space-y-2 ${faded ? "opacity-60" : ""}`}>
        {items.map((r) => {
          const cc = r.cost_center_id
            ? (ccs.find((c) => c.id === r.cost_center_id) ?? null)
            : null;
          const receita = r.direction === "income";
          return (
            /* O CARD NÃO É BOTÃO. Ele já era `role="button"` abrindo a
               visualização, tendo dentro um menu cujo primeiro item é
               exatamente "Ver" — a mesma ação em dois lugares. Isso obrigava um
               `stopPropagation` no menu só para o clique não disparar as duas
               coisas, e transformava qualquer toque no card (inclusive
               selecionar um valor para copiar) numa navegação. O menu cobre
               tudo, em qualquer tamanho de tela. */
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div className="flex items-stretch">
                {/* A faixa carrega a cor do CENTRO DE CUSTO — é o que agrupa
                    visualmente a lista, e casa com o chip logo ao lado. Entra
                    ou sai continua legível sem depender dela: o sinal +/− está
                    na linha do valor, e cor nunca é o único código. Sem centro,
                    a faixa some no tom da borda. */}
                <div
                  aria-hidden
                  className="w-1 shrink-0"
                  style={{ backgroundColor: cc?.color ?? "#e5e5e5" }}
                />
                <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-start gap-4">
                    {/* Quatro colunas, duas linhas cada. As colunas batem entre
                        cards, então o olho desce a página lendo sempre no mesmo
                        lugar. Peso separa só a primeira linha da primeira
                        coluna; o resto é tom por POSIÇÃO (900 em cima, 700
                        embaixo), num tamanho só. */}

                    {/* 1 — o quê */}
                    <div className="min-w-0 flex-[1.2] flex flex-col gap-0.5">
                      <p className="h-5 text-sm font-medium text-slate-900 truncate">
                        {r.name.toUpperCase()}
                      </p>
                      <p className="text-sm leading-5 text-slate-700 truncate">
                        {r.vendor ? `${r.vendor.toUpperCase()} — ` : ""}
                        {getCategoryLabel(r.category, categories)}
                      </p>
                    </div>

                    {/* 2 — quanto, e em que dia. O sinal diz entrada/saída sem
                        depender de cor. */}
                    <div className="min-w-0 flex-[0.8] flex flex-col gap-0.5">
                      <p className="h-5 text-sm text-slate-900 truncate">
                        {receita ? "+" : "−"}
                        {fmtBRL(r.total_value)}
                      </p>
                      <p className="text-sm leading-5 text-slate-700 truncate">
                        dia {r.day_of_month}
                      </p>
                    </div>

                    {/* 3 — até quando */}
                    <div className="min-w-0 flex-1 hidden md:flex flex-col gap-0.5">
                      <p className="h-5 text-sm text-slate-900 truncate">
                        Projetado até {fmtDate(r.next_run_date)}
                      </p>
                      <p className="text-sm leading-5 text-slate-700 truncate">
                        {r.end_date
                          ? `termina ${fmtDate(r.end_date)}`
                          : "sem fim definido"}
                      </p>
                    </div>

                    {/* 4 — centro de custo: chip + nome, do mesmo jeito que a
                        tabela de Lançamentos e os menus mostram. O badge foi
                        testado e descartado — a moldura extra competia com o
                        próprio chip, que já é o selo. */}
                    <div className="shrink-0 self-center hidden sm:flex items-center gap-2 min-w-0">
                      {showCC && cc ? (
                        <>
                          <CostCenterChip
                            icon={cc.icon}
                            color={cc.color}
                            className="size-6 shrink-0"
                          />
                          <span className="text-sm text-slate-600 truncate">
                            {cc.name}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Ações no menu, como no resto do app: três botões soltos
                        sobre o card branco leem como decoração. */}
                    <div className="shrink-0 self-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Ações"
                            title="Ações"
                            className={cn(
                              BOTAO_ACOES,
                              "size-8 inline-flex items-center justify-center",
                            )}
                          >
                            <MoreVertical className="size-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => openEdit(r, true)}>
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEdit(r)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handleToggleActive(r)}
                          >
                            {r.active ? "Pausar" : "Reativar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => handleRemove(r)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
