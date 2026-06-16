import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
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
  if (r.items && r.items.length > 0) {
    return r.items.map((it) => ({
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

function fmtBRLfull(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
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

export default function DashboardPage() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const firstName = user?.fullName.split(" ")[0] || "fazendeiro";
  const ccs = user?.costCenters || [];
  const showCCFilter = ccs.length > 1;

  const [activeCC, setActiveCC] = useState<string>("all");
  const [period, setPeriod] = useState<DashPeriod>(defaultPeriod);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
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

  // Expande em linhas (split por item) e filtra por CC na LINHA - assim uma
  // nota dividida contribui so a porção do CC ativo.
  const lines = useMemo(() => {
    const all = receipts.flatMap(linesOf);
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

  // Serie de 6 meses.
  const chartData = useMemo(() => {
    const months =
      period.mode === "month"
        ? sixMonthsEnding(period.month)
        : monthsBetween(range.from, range.to);
    const acc: Record<string, { mes: string; entradas: number; saidas: number }> = {};
    for (const m of months) acc[m.key] = { mes: m.label, entradas: 0, saidas: 0 };
    for (const l of lines) {
      if (!l.date) continue;
      const k = l.date.slice(0, 7);
      if (!acc[k]) continue;
      if (l.direction === "income") acc[k].entradas += l.value;
      else acc[k].saidas += l.value;
    }
    return months.map((m) => acc[m.key]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, period, fromKey, toKey]);

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
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          <PeriodModeSelect value={period} onChange={setPeriod} />
          {period.mode === "month" && (
            <MonthSwitcher
              value={period.month}
              onChange={(month) => setPeriod({ ...period, month })}
              variant="picker"
              className="w-[185px]"
            />
          )}
          {showCCFilter && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 w-[210px] inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
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
        {/* Regra de cor: verde = entra (Entradas, A receber, Saldo+);
            vermelho = sai/alerta (Saídas, Vencido, Saldo-);
            neutro escuro = compromisso futuro (A pagar). */}
        <KpiCard label={period.mode === "month" ? "Entradas (mês)" : "Entradas"} value={monthKpis.income} color="text-emerald-600" loading={loading} />
        <KpiCard label={period.mode === "month" ? "Saídas (mês)" : "Saídas"} value={monthKpis.expense} color="text-rose-600" loading={loading} />
        <KpiCard label={period.mode === "month" ? "Saldo (mês)" : "Saldo"} value={monthKpis.balance} color={monthKpis.balance >= 0 ? "text-emerald-600" : "text-rose-600"} loading={loading} />
        <KpiCard label="A pagar" value={pending.aPagar} color="text-slate-800" loading={loading} />
        <KpiCard label="A receber" value={pending.aReceber} color="text-emerald-600" loading={loading} />
        <KpiCard label="Vencido" value={pending.vencido} color="text-rose-600" loading={loading} />
      </div>

      {/* Gráfico minimalista: 6 meses terminando no selecionado. O mês
          selecionado (último) fica com barras cheias; os anteriores esmaecem
          como contexto. Sem grade/eixo Y/legenda do recharts — valores no
          tooltip, legenda em dots discretos no título. */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-slate-500">
            Entradas × Saídas
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-600" />
              Entradas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-600" />
              Saídas
            </span>
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
              <Bar dataKey="entradas" name="Entradas" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill="#059669"
                    fillOpacity={period.mode !== "month" || i === chartData.length - 1 ? 1 : 0.25}
                  />
                ))}
              </Bar>
              <Bar dataKey="saidas" name="Saídas" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill="#e11d48"
                    fillOpacity={period.mode !== "month" || i === chartData.length - 1 ? 1 : 0.25}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top categorias de despesa */}
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
                  <span className="text-sm text-slate-700 w-32 shrink-0">{getCategoryLabel(c.cat, categories)}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded">
                    <div className="h-3 rounded bg-slate-400" style={{ width: `${pct}%` }} />
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
    </div>
  );
}

function KpiCard({ label, value, color, loading }: { label: string; value: number; color: string; loading: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-500 truncate">{label}</p>
      <p className={`text-base font-medium mt-1 tabular-nums ${color}`}>
        {loading ? "..." : fmtBRLfull(value)}
      </p>
    </div>
  );
}
