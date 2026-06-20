import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/components/ui/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_LABEL, STATUS_COLOR_SCHEME } from "@/modules/receipts/constants";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import ChevronDown from "~icons/material-symbols-light/keyboard-arrow-down";
import History from "~icons/material-symbols-light/history";
import { api } from "@/utils/api";
import { AllCentersChip, CostCenterChip, ccTextColor } from "@/modules/cost-centers/ccIcons";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import { getCategoryLabel } from "@/modules/receipts/utils/receiptFormatters";
import { MonthSwitcher, monthRangeISO, currentYearMonth, type YearMonth } from "@/modules/receipts/components/MonthSwitcher";
import {
  PeriodSwitcher,
  PeriodModeSelect,
  defaultPeriod,
  periodLabel,
  periodRange,
  type DashPeriod,
} from "../components/PeriodSwitcher";

interface ReceiptItemLite {
  category: string | null;
  cost_center_id: string | null;
  total_value: number;
  promoted_to_receipt_id?: string | null;
}

interface Receipt {
  id: string;
  direction: "expense" | "income";
  status: string;
  total_value: number;
  transaction_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  category: string | null;
  vendor: string | null;
  cost_center_id: string | null;
  is_estimated?: boolean;
  /** false = informativo (não soma nos totais). */
  counts_in_total?: boolean;
  item_count?: number;
  items?: ReceiptItemLite[];
}

interface ReceiptsResponse { receipts: Receipt[] }

/**
 * "Linha" = unidade de agregação. Lançamento COM itens vira 1 linha por item
 * (categoria/CC/valor do item); SEM itens vira 1 linha = o cabeçalho. Assim o
 * dashboard atribui cada parte ao seu CC/categoria (split).
 */
interface DashLine {
  direction: "expense" | "income";
  status: string;
  date: string | null;
  category: string | null;
  cost_center_id: string | null;
  value: number;
}

function linesOf(r: Receipt): DashLine[] {
  const date = r.paid_date || r.transaction_date || null;
  // Itens desmembrados viraram lançamento próprio: fora das linhas (evita dobra).
  const activeItems = (r.items ?? []).filter((it) => !it.promoted_to_receipt_id);
  if (activeItems.length > 0) {
    return activeItems.map((it) => ({
      direction: r.direction,
      status: r.status,
      date,
      category: it.category,
      cost_center_id: it.cost_center_id,
      value: Number(it.total_value) || 0,
    }));
  }
  return [
    {
      direction: r.direction,
      status: r.status,
      date,
      category: r.category,
      cost_center_id: r.cost_center_id,
      value: Number(r.total_value) || 0,
    },
  ];
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Cores de entrada/saída alinhadas à paleta dos centros de custo (CC_COLORS):
// preenchimentos (barras/legenda) nos tons 400; texto num tom legível da mesma família.
const COLOR_IN = "#34D399";  // emerald-400
const COLOR_OUT = "#A1A1AA"; // zinc-400 (gráfico Entradas×Saídas)

function fmtBRLfull(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" (sem timezone). */
function fmtDateBR(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 6 meses terminando no mês selecionado (inclusive). */
function sixMonthsEnding({ year, month }: YearMonth): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    out.push({ key: monthKey(d), label: MONTH_LABELS[d.getMonth()] });
  }
  return out;
}

/** Meses de from..to (inclusive). Cruzando ano, label ganha o ano ("Dez 25"). */
function monthsBetween(from: YearMonth, to: YearMonth): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const crossYear = from.year !== to.year;
  let y = from.year;
  let m = from.month;
  while (y < to.year || (y === to.year && m <= to.month)) {
    const d = new Date(y, m - 1, 1);
    out.push({
      key: monthKey(d),
      label: crossYear ? `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}` : MONTH_LABELS[m - 1],
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** N meses APÓS o selecionado (pra projeção/previsto). */
function futureMonths({ year, month }: YearMonth, n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(year, month - 1 + i, 1);
    out.push({ key: monthKey(d), label: MONTH_LABELS[d.getMonth()] });
  }
  return out;
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Dias entre hoje e uma data ISO (positivo = futuro). */
function daysUntil(iso: string): number {
  const t = todayISO();
  const a = new Date(t + "T00:00:00");
  const b = new Date(iso.slice(0, 10) + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"} atrás`;
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const firstName = user?.fullName.split(" ")[0] || "fazendeiro";
  const ccs = user?.costCenters || [];
  const showCCFilter = ccs.length > 1;

  const [activeCC, setActiveCC] = useState<string>("all");
  const [period, setPeriod] = useState<DashPeriod>(defaultPeriod);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [openItems, setOpenItems] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = periodRange(period);
  // Atalho "voltar ao atual": só no modo Mês, quando não está no mês corrente.
  const curMonth = currentYearMonth();
  const showBackToCurrent =
    period.mode === "month" &&
    !(period.month.year === curMonth.year && period.month.month === curMonth.month);
  const ymKey = (m: YearMonth) => `${m.year}-${String(m.month).padStart(2, "0")}`;
  const fromKey = ymKey(range.from);
  const toKey = ymKey(range.to);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Modo mensal busca 6 meses terminando no mês (contexto do gráfico);
        // os demais modos buscam exatamente o intervalo do período.
        const r = periodRange(period);
        const chartStart =
          period.mode === "month"
            ? new Date(r.from.year, r.from.month - 1 - 5, 1)
            : new Date(r.from.year, r.from.month - 1, 1);
        const from = `${chartStart.getFullYear()}-${String(chartStart.getMonth() + 1).padStart(2, "0")}-01`;
        const to = monthRangeISO(r.to).to;
        const resp = await api<ReceiptsResponse>(
          `/receipts?from=${from}&to=${to}&limit=1000`,
          { method: "GET" },
        );
        if (!cancel) setReceipts(resp.receipts || []);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Erro ao carregar dados");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [period]);

  // Itens em aberto (a pagar/receber), independente do período — alimentam a
  // projeção (meses futuros) e os "próximos vencimentos".
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const resp = await api<ReceiptsResponse>(
          `/receipts?status=a_pagar,a_receber&limit=500`,
          { method: "GET" },
        );
        if (!cancel) setOpenItems(resp.receipts || []);
      } catch {
        /* silencioso: os widgets de projeção/vencimento só não aparecem */
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Expande em linhas (split por item) e filtra por CC na LINHA - assim uma
  // nota dividida contribui so a porção do CC ativo.
  const lines = useMemo(() => {
    // Informativos (counts_in_total=false, ex.: faturas) não entram nas somas.
    const all = receipts
      .filter((r) => r.counts_in_total !== false)
      .flatMap(linesOf);
    return activeCC === "all"
      ? all
      : all.filter((l) => l.cost_center_id === activeCC);
  }, [receipts, activeCC]);

  // KPIs do período selecionado (mês/semestre/ano/custom = intervalo de meses).
  const inRange = (date: string | null) => {
    if (!date) return false;
    const k = date.slice(0, 7);
    return k >= fromKey && k <= toKey;
  };
  const monthKpis = useMemo(() => {
    let income = 0, expense = 0;
    for (const l of lines) {
      if (!inRange(l.date)) continue;
      if (l.direction === "income") income += l.value;
      else expense += l.value;
    }
    return { income, expense, balance: income - expense };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, fromKey, toKey]);

  // Pendentes (a_pagar / a_receber / vencido), agregado em todo o range.
  const pending = useMemo(() => {
    let aPagar = 0, aReceber = 0, vencido = 0;
    for (const l of lines) {
      if (l.status === "a_pagar") aPagar += l.value;
      else if (l.status === "a_receber") aReceber += l.value;
      else if (l.status === "vencido") vencido += l.value;
    }
    return { aPagar, aReceber, vencido };
  }, [lines]);

  // Série do gráfico: realizado (passado + atual) + PREVISTO (meses futuros, só
  // no modo Mês), alimentado pelos itens em aberto (recorrências projetadas etc.).
  const chartData = useMemo(() => {
    const isMonth = period.mode === "month";
    const selKey = isMonth ? monthKey(new Date(period.month.year, period.month.month - 1, 1)) : "";
    const realMonths = isMonth ? sixMonthsEnding(period.month) : monthsBetween(range.from, range.to);
    const futMonths = isMonth ? futureMonths(period.month, 3) : [];
    type Row = { mes: string; mesNum: string; entradas: number; saidas: number; previsto: boolean; sel: boolean };
    const acc: Record<string, Row> = {};
    const order: string[] = [];
    for (const m of realMonths) {
      acc[m.key] = { mes: m.label, mesNum: m.key.slice(5), entradas: 0, saidas: 0, previsto: false, sel: m.key === selKey };
      order.push(m.key);
    }
    for (const m of futMonths) {
      acc[m.key] = { mes: m.label, mesNum: m.key.slice(5), entradas: 0, saidas: 0, previsto: true, sel: false };
      order.push(m.key);
    }
    for (const l of lines) {
      if (!l.date) continue;
      const k = l.date.slice(0, 7);
      if (!acc[k] || acc[k].previsto) continue;
      if (l.direction === "income") acc[k].entradas += l.value;
      else acc[k].saidas += l.value;
    }
    if (isMonth) {
      for (const r of openItems) {
        if (r.counts_in_total === false) continue;
        if (activeCC !== "all" && r.cost_center_id !== activeCC) continue;
        const d = r.transaction_date || r.due_date;
        if (!d) continue;
        const k = d.slice(0, 7);
        if (!acc[k] || !acc[k].previsto) continue;
        const v = Number(r.total_value) || 0;
        if (r.direction === "income") acc[k].entradas += v;
        else acc[k].saidas += v;
      }
    }
    return order.map((k) => acc[k]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, openItems, period, activeCC, fromKey, toKey]);

  // Rótulos do eixo X: no mobile a régua fica estreita, então mostramos TODOS os
  // meses mas com rótulo numérico (01, 02, …) — cabe sem o auto-skip irregular do
  // recharts. No desktop mantém os nomes (Jan, Fev, …) com o comportamento padrão.
  const isMobile = useIsMobile();
  // Prévia de um lançamento ao clicar numa linha de "Próximos vencimentos".
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  // (D) Comparativo com o mês anterior — só no modo Mês (passado está no fetch).
  const lastMonthKpis = useMemo(() => {
    if (period.mode !== "month") return null;
    const prevKey = monthKey(new Date(period.month.year, period.month.month - 2, 1));
    let income = 0, expense = 0;
    for (const l of lines) {
      if (!l.date || l.date.slice(0, 7) !== prevKey) continue;
      if (l.direction === "income") income += l.value;
      else expense += l.value;
    }
    return { income, expense, balance: income - expense };
  }, [lines, period]);

  // (C) Gastos por Centro de Custo no período (todas as despesas, sem filtro de CC).
  const ccSpend = useMemo(() => {
    const all = receipts
      .filter((r) => r.counts_in_total !== false)
      .flatMap(linesOf);
    const byCC: Record<string, number> = {};
    for (const l of all) {
      if (l.direction !== "expense" || !inRange(l.date)) continue;
      const id = l.cost_center_id || "none";
      byCC[id] = (byCC[id] || 0) + l.value;
    }
    return Object.entries(byCC)
      .map(([id, total]) => {
        const cc = ccs.find((c) => c.id === id);
        return { id, name: cc?.name || "Sem centro", color: cc?.color || "#94a3b8", total };
      })
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, fromKey, toKey, ccs]);

  // (B) Próximos vencimentos — itens em aberto com vencimento de hoje em diante.
  const dueSoon = useMemo(() => {
    const today = todayISO();
    return openItems
      .filter((r) => {
        if (r.counts_in_total === false) return false;
        if (activeCC !== "all" && r.cost_center_id !== activeCC) return false;
        return r.due_date && r.due_date.slice(0, 10) >= today;
      })
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 6);
  }, [openItems, activeCC]);

  // Top 5 categorias de despesa do período (cada item na SUA categoria).
  const topCategories = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const l of lines) {
      if (l.direction !== "expense") continue;
      if (!inRange(l.date)) continue;
      const cat = l.category || "outros_despesa";
      byCat[cat] = (byCat[cat] || 0) + l.value;
    }
    return Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, total]) => ({ cat, total }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, fromKey, toKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-base font-medium text-slate-900">Olá, {firstName}.</h1>
          <p className="text-sm text-slate-500 mt-0.5 inline-flex items-center gap-1.5">
            <span>{periodLabel(period)}</span>
            {showBackToCurrent && (
              <button
                type="button"
                onClick={() => setPeriod({ ...period, month: curMonth })}
                title="Voltar ao mês atual"
                aria-label="Voltar ao mês atual"
                className="text-slate-500 hover:text-slate-700 transition-colors"
              >
                <History className="size-[18px]" />
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap sm:justify-end">
          <PeriodModeSelect value={period} onChange={setPeriod} className="w-full sm:w-[180px]" />
          {period.mode === "month" && (
            <MonthSwitcher
              value={period.month}
              onChange={(month) => setPeriod({ ...period, month })}
              variant="picker"
              className="w-full sm:w-[185px]"
            />
          )}
          {showCCFilter && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 w-full sm:w-[210px] inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                >
                  {activeCC !== "all" ? (
                    <CostCenterChip
                      icon={ccs.find((c) => c.id === activeCC)?.icon}
                      color={ccs.find((c) => c.id === activeCC)?.color}
                      className="size-6"
                    />
                  ) : (
                    <AllCentersChip className="size-6" />
                  )}
                  <span
                    className="flex-1 text-left truncate"
                    style={activeCC !== "all" ? { color: ccTextColor(ccs.find((c) => c.id === activeCC)?.color) } : undefined}
                  >
                    {activeCC === "all"
                      ? "Todos os Centros"
                      : ccs.find((c) => c.id === activeCC)?.name || "Centro"}
                  </span>
                  <ChevronDown className="size-4 text-slate-500 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem
                  onClick={() => setActiveCC("all")}
                  className={activeCC === "all" ? "bg-slate-100 font-medium gap-2" : "gap-2"}
                >
                  <AllCentersChip className="size-6" />
                  <span>Todos os Centros</span>
                </DropdownMenuItem>
                {ccs.map((cc) => (
                  <DropdownMenuItem
                    key={cc.id}
                    onClick={() => setActiveCC(cc.id)}
                    className={activeCC === cc.id ? "bg-slate-100 font-medium gap-2" : "gap-2"}
                  >
                    <CostCenterChip icon={cc.icon} color={cc.color} className="size-6" />
                    <span style={{ color: ccTextColor(cc.color) }}>{cc.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

        </div>
      </div>

      {/* Controles do modo selecionado (régua de meses / semestre / ano / datas).
          O seletor de modo em si fica na barra de topo, ao lado dos centros. */}
      <PeriodSwitcher value={period} onChange={setPeriod} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>
      )}

      {/* KPIs do mês + pendências: uma linha só, mesmo padrão de card. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Paleta alinhada aos valores em Lançamentos: entrada/receita =
            emerald-700; despesa = slate-900 (neutra, sem vermelho). Vermelho
            fica só p/ ALERTA (Vencido, Saldo negativo); amber = A pagar. */}
        <KpiCard label={period.mode === "month" ? "Entradas (mês)" : "Entradas"} value={monthKpis.income} color="text-emerald-700" loading={loading} delta={lastMonthKpis ? mkDelta(monthKpis.income, lastMonthKpis.income, true) : null} />
        <KpiCard label={period.mode === "month" ? "Saídas (mês)" : "Saídas"} value={monthKpis.expense} color="text-slate-900" loading={loading} delta={lastMonthKpis ? mkDelta(monthKpis.expense, lastMonthKpis.expense, false) : null} />
        <KpiCard label={period.mode === "month" ? "Saldo (mês)" : "Saldo"} value={monthKpis.balance} color={monthKpis.balance >= 0 ? "text-emerald-700" : "text-red-600"} loading={loading} delta={lastMonthKpis ? mkDelta(monthKpis.balance, lastMonthKpis.balance, true) : null} />
        <KpiCard label="A pagar" value={pending.aPagar} color="text-amber-600" loading={loading} />
        <KpiCard label="A receber" value={pending.aReceber} color="text-emerald-700" loading={loading} />
        <KpiCard label="Vencido" value={pending.vencido} color="text-red-600" loading={loading} />
      </div>

      {/* Gráfico minimalista: 6 meses terminando no selecionado. O mês
          selecionado (último) fica com barras cheias; os anteriores esmaecem
          como contexto. Sem grade/eixo Y/legenda do recharts — valores no
          tooltip, legenda em dots discretos no título. */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="mb-4 space-y-2">
          <h2 className="text-xs font-medium text-slate-500">
            Entradas × Saídas
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#34D399]" />
              Entradas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-slate-400" />
              Saídas
            </span>
            {period.mode === "month" && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-slate-300" />
                Previsto
              </span>
            )}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
              barGap={4}
            >
              <XAxis
                dataKey="mes"
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval={isMobile ? 0 : undefined}
                tickFormatter={
                  isMobile
                    ? (_value: string, index: number) =>
                        chartData[index]?.mesNum ?? ""
                    : undefined
                }
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                contentStyle={{
                  background: "white",
                  border: "1px solid #e4e4e7",
                  borderRadius: 6,
                  fontSize: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
                formatter={(value: number) => fmtBRLfull(value)}
              />
              <Bar dataKey="entradas" name="Entradas" maxBarSize={28}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={COLOR_IN}
                    fillOpacity={d.previsto ? 0.4 : period.mode !== "month" ? 1 : d.sel ? 1 : 0.3}
                  />
                ))}
              </Bar>
              <Bar dataKey="saidas" name="Saídas" maxBarSize={28}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={COLOR_OUT}
                    fillOpacity={d.previsto ? 0.4 : period.mode !== "month" ? 1 : d.sel ? 1 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdowns: por categoria (esq) + por centro de custo (dir) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Onde mais saiu — por categoria */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-xs font-medium text-slate-500 mb-3">
            Onde Mais Saiu — {periodLabel(period)}
          </h2>
          {topCategories.length === 0 ? (
            <p className="text-sm text-slate-500">Sem despesas neste período.</p>
          ) : (
            <ul className="space-y-2">
              {topCategories.map((c) => {
                const max = topCategories[0].total;
                const pct = max ? Math.max(4, Math.round((c.total / max) * 100)) : 0;
                return (
                  <li key={c.cat} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 truncate flex-1 min-w-0 sm:flex-none sm:w-32 sm:shrink-0">{getCategoryLabel(c.cat, categories)}</span>
                    <div className="hidden sm:block flex-1 h-3 bg-slate-100 rounded-sm">
                      <div className="h-3 rounded-sm bg-slate-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm text-slate-700 w-24 text-right tabular-nums">
                      {fmtBRLfull(c.total)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Gastos por Centro de Custo — donut (só com mais de um centro) */}
        {showCCFilter && (
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h2 className="text-xs font-medium text-slate-500 mb-3">
              Gastos por Centro — {periodLabel(period)}
            </h2>
            {ccSpend.length === 0 ? (
              <p className="text-sm text-slate-500">Sem despesas neste período.</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ccSpend} dataKey="total" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2} stroke="none">
                        {ccSpend.map((c) => <Cell key={c.id} fill={c.color} />)}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => fmtBRLfull(v)}
                        contentStyle={{ background: "white", border: "1px solid #e4e4e7", borderRadius: 6, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="w-full sm:flex-1 space-y-1.5 min-w-0">
                  {(() => {
                    const total = ccSpend.reduce((s, x) => s + x.total, 0);
                    return ccSpend.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm">
                        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-slate-700 truncate flex-1 min-w-0">{c.name}</span>
                        <span className="text-slate-400 tabular-nums">{total ? Math.round((c.total / total) * 100) : 0}%</span>
                        <span className="text-slate-700 tabular-nums w-20 text-right">{fmtBRLfull(c.total)}</span>
                      </li>
                    ));
                  })()}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* (B) Próximos vencimentos — contas a pagar/receber de hoje em diante */}
      {dueSoon.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-xs font-medium text-slate-500 mb-3">Próximos vencimentos</h2>
          <ul className="divide-y divide-slate-100">
            {dueSoon.map((r) => {
              const days = daysUntil(r.due_date!);
              const cc = ccs.find((c) => c.id === r.cost_center_id);
              const income = r.direction === "income";
              return (
                <li
                  key={r.id}
                  onClick={() => setPreviewReceipt(r)}
                  className="flex items-center gap-3 py-2 text-sm cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
                >
                  <span className={`w-24 shrink-0 ${days <= 2 ? "text-red-600" : "text-slate-500"}`}>{dueLabel(days)}</span>
                  <span className="flex-1 min-w-0 truncate text-slate-700">
                    {r.vendor || (r.category ? getCategoryLabel(r.category, categories) : (income ? "A receber" : "A pagar"))}
                    {cc && showCCFilter ? <span className="text-slate-400"> — {cc.name}</span> : null}
                    {r.is_estimated ? <span className="text-slate-400"> — Previsto</span> : null}
                  </span>
                  <span className={`tabular-nums shrink-0 ${income ? "text-emerald-700" : "text-slate-900"}`}>
                    {income ? "+" : ""}{fmtBRLfull(Number(r.total_value))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Prévia do lançamento (Próximos vencimentos) — só leitura. */}
      <Dialog open={!!previewReceipt} onOpenChange={(o) => !o && setPreviewReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Lançamento</DialogTitle>
          </DialogHeader>
          {previewReceipt && (() => {
            const r = previewReceipt;
            const cc = ccs.find((c) => c.id === r.cost_center_id);
            const income = r.direction === "income";
            const statusKey = r.status as keyof typeof STATUS_LABEL;
            return (
              <dl className="text-sm">
                <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Tipo</dt>
                  <dd className="text-slate-900">{income ? "Entrada (receita)" : "Saída (despesa)"}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <Badge colorScheme={STATUS_COLOR_SCHEME[statusKey]}>
                      {STATUS_LABEL[statusKey] ?? r.status}
                    </Badge>
                    {r.is_estimated ? <span className="text-slate-400 ml-2">Previsto</span> : null}
                  </dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Valor</dt>
                  <dd className={`font-medium tabular-nums ${income ? "text-emerald-700" : "text-slate-900"}`}>
                    {income ? "+" : ""}{fmtBRLfull(Number(r.total_value))}
                  </dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Origem</dt>
                  <dd className="text-slate-900 break-words">{r.vendor || "—"}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Categoria</dt>
                  <dd className="text-slate-900">{getCategoryLabel(r.category, categories)}</dd>
                </div>
                {showCCFilter && (
                  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                    <dt className="text-slate-500">Centro de custo</dt>
                    <dd className="text-slate-900">{cc?.name ?? "—"}</dd>
                  </div>
                )}
                <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                  <dt className="text-slate-500">Transação</dt>
                  <dd className="text-slate-900 tabular-nums">{fmtDateBR(r.transaction_date)}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-3 py-2">
                  <dt className="text-slate-500">Vencimento</dt>
                  <dd className="text-slate-900 tabular-nums">{fmtDateBR(r.due_date)}</dd>
                </div>
              </dl>
            );
          })()}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Delta { pct: number | null; up: boolean; good: boolean }

/** Variação vs mês anterior. higherIsGood: entradas/saldo=true, saídas=false. */
function mkDelta(cur: number, last: number, higherIsGood: boolean): Delta | null {
  if (last === 0 && cur === 0) return null;
  const up = cur > last;
  const good = higherIsGood ? cur >= last : cur <= last;
  const pct = last !== 0 ? Math.round(Math.abs((cur - last) / last) * 100) : null;
  return { pct, up, good };
}

function KpiCard({ label, value, color, loading, delta }: {
  label: string; value: number; color: string; loading: boolean; delta?: Delta | null;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-500 truncate">{label}</p>
      <p className={`text-base font-medium mt-1 tabular-nums ${color}`}>
        {loading ? "..." : fmtBRLfull(value)}
      </p>
      {!loading && delta && delta.pct !== null ? (
        <p className={`text-xs mt-1 tabular-nums ${delta.good ? "text-emerald-600" : "text-red-600"}`}>
          {delta.up ? "▲" : "▼"} {delta.pct}% <span className="text-slate-400">vs mês passado</span>
        </p>
      ) : null}
    </div>
  );
}
