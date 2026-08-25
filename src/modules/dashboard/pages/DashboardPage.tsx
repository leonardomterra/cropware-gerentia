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
  Customized,
  Text as TextoSVG,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/components/ui/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA_PRIMARIO, CAMPO_BARRA } from "@/lib/ui-tokens";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STATUS_LABEL,
  STATUS_COLOR_SCHEME,
} from "@/modules/receipts/constants";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import ChevronDown from "~icons/ph/caret-down";
import { api } from "@/utils/api";
import {
  AllCentersChip,
  CostCenterChip,
  ccChartColor,
  ccTextColor,
} from "@/modules/cost-centers/ccIcons";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import { getCategoryLabel } from "@/modules/receipts/utils/receiptFormatters";
import { toast } from "sonner";
import Download from "~icons/ph/download-simple";
import { reportToPdf } from "@/modules/reports/reportPdf";
import { openReportPage } from "@/modules/reports/reportExport";
import type { ReportDoc } from "@/modules/reports/reportBuilders";
import { ACENTO, FUNDO, NEUTRO } from "@/modules/reports/reportTheme";
import { exportFile } from "@/utils/nativeExport";
import { isNativeCapacitorApp } from "@/utils/platform";
import {
  MonthSwitcher,
  monthRangeISO,
  type YearMonth,
} from "@/modules/receipts/components/MonthSwitcher";
import {
  PeriodSwitcher,
  PeriodModeSelect,
  defaultPeriod,
  periodLabel,
  periodRange,
  type DashPeriod,
} from "../components/PeriodSwitcher";

/**
 * Paleta da rosca de categorias no PDF. Sequência quente→fria em vez de tons de
 * uma cor só: com 5 fatias, uma escala monocromática vira cinza indistinguível
 * quando o relatório é impresso em preto e branco, e aqui a ordem do ranking já
 * carrega a informação.
 */
const PALETA_ROSCA = [
  ACENTO.saida,
  ACENTO.alerta,
  ACENTO.indigo,
  ACENTO.teal,
  ACENTO.roxo,
  NEUTRO[400],
];

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

interface ReceiptsResponse {
  receipts: Receipt[];
}

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
  /** previsto (projeção de recorrência) — fora do realizado, só em pendências. */
  is_estimated: boolean;
}

function linesOf(r: Receipt): DashLine[] {
  const date = r.paid_date || r.transaction_date || null;
  const est = r.is_estimated === true;
  // Itens desmembrados viraram lançamento próprio: fora das linhas (evita dobra).
  const activeItems = (r.items ?? []).filter(
    (it) => !it.promoted_to_receipt_id,
  );
  if (activeItems.length > 0) {
    return activeItems.map((it) => ({
      direction: r.direction,
      status: r.status,
      date,
      category: it.category,
      cost_center_id: it.cost_center_id,
      value: Number(it.total_value) || 0,
      is_estimated: est,
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
      is_estimated: est,
    },
  ];
}

/** Casa o lançamento com o CC selecionado. Itemizado tem CC nulo no header,
 *  então também casa se QUALQUER item ativo for daquele centro. */
function receiptMatchesCC(r: Receipt, cc: string): boolean {
  if (cc === "all") return true;
  if (r.cost_center_id === cc) return true;
  return (r.items ?? []).some(
    (it) => !it.promoted_to_receipt_id && it.cost_center_id === cc,
  );
}

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// Cores de entrada/saída alinhadas à paleta dos centros de custo (CC_COLORS):
// preenchimentos (barras/legenda) nos tons 400; texto num tom legível da mesma família.
/* Cores do gráfico Entradas × Saídas.
 *
 * Tons claros por escolha visual (testados escuros em 19/08 e revertidos): a
 * barra convive com opacidade 0,3 nos meses fora do foco, e com base escura o
 * conjunto pesava demais para um gráfico de fundo.
 *
 * Barra não é texto — a régua de 4,5:1 vale para o rótulo, não para o
 * preenchimento —, e o número exato está no tooltip e nos KPIs acima. */
/** Barra fora de foco: mês previsto, ou (no modo mês) um mês que não é o
 *  selecionado. Uma função só porque as duas séries precisam da MESMA regra —
 *  duplicada, uma delas divergiria no primeiro ajuste. */
function esmaecida(d: { previsto?: boolean; sel?: boolean }, modo?: string) {
  if (d.previsto) return true;
  if (modo !== "month") return false;
  return !d.sel;
}

/** Rodapé da moldura: cantos de baixo arredondados para acompanhar a moldura,
 *  cantos de cima retos para encostar no divisor. <rect rx> arredonda os quatro
 *  de uma vez — daí o path. */
function caminhoDeRodape(
  x: number,
  y: number,
  largura: number,
  altura: number,
  raio: number,
) {
  const r = Math.max(0, Math.min(raio, largura / 2, altura));
  return [
    `M${x},${y}`,
    `H${x + largura}`,
    `V${y + altura - r}`,
    r && `A${r},${r} 0 0 1 ${x + largura - r},${y + altura}`,
    `H${x + r}`,
    r && `A${r},${r} 0 0 1 ${x},${y + altura - r}`,
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Fundo da faixa do mês na moldura em foco. É o MESMO vidro do mês ativo no
 *  seletor de meses (`bg-slate-900/65`): os dois falam de "mês selecionado", e
 *  cores
 *  diferentes fariam parecer que falam de coisas diferentes. Em `fill` +
 *  `fillOpacity` em vez do #686868 já composto para continuar certo se o fundo
 *  do card mudar. */
const FOCO_FUNDO = "#171717"; // slate-900 do app
const FOCO_OPACIDADE = 0.65;

/** Altura da faixa do mês, abaixo da base das barras. O rótulo é centrado nela
 *  (`tickSize=0` + `tickMargin` na metade, e `verticalAnchor="middle"`), em vez
 *  de pendurado no deslocamento padrão do recharts: aquele encostava o texto no
 *  fundo da faixa — 8px em cima, ~1px embaixo. Centrado, a folga não depende de
 *  adivinhar a altura da fonte. */
const RODAPE_ALTURA = 34;

type GeometriaDoEixo = {
  escala: (v: string) => number | undefined;
  largura: number;
  topo: number;
  altura: number;
};

/**
 * Geometria da faixa de cada mês, tirada do estado interno do recharts que o
 * <Customized> recebe: `scale(mes)` dá o início da faixa e `bandwidth()` a
 * largura. Sem isso seria chute — ReferenceArea num eixo de categoria fecha com
 * largura zero.
 *
 * Retorna null se o formato interno mudar numa atualização do recharts: quem
 * chama some em silêncio, em vez de derrubar o gráfico inteiro.
 */
function geometriaDoEixo(props: unknown): GeometriaDoEixo | null {
  const p = props as {
    xAxisMap?: Record<
      string,
      { scale?: (v: string) => number | undefined; bandSize?: number }
    >;
    offset?: { top?: number; height?: number };
  };
  const eixo = p.xAxisMap?.[0];
  const off = p.offset;
  if (!eixo?.scale || off?.top == null || !off.height) return null;
  const escala = eixo.scale as ((v: string) => number | undefined) & {
    bandwidth?: () => number;
  };
  const largura = escala.bandwidth?.() ?? eixo.bandSize ?? 0;
  if (!largura) return null;
  return { escala, largura, topo: off.top, altura: off.height };
}

// Tom 300 nas duas séries, o mesmo da rosca de gastos por centro — o dashboard
// inteiro fica num nível só de saturação.
//
// O vermelho fica no MESMO degrau que o verde: um degrau mais escuro puxaria o
// olho só para as saídas. E vale só para o gráfico — nos KPIs e nos valores em
// Lançamentos, despesa segue neutra e o vermelho fica para ALERTA (Vencido,
// saldo negativo). Aqui a cor não classifica "ruim", só separa duas séries.
const COLOR_IN = "#6ee7b7"; // emerald-300
const COLOR_OUT = "#fca5a5"; // red-300

/**
 * Opacidade dos meses fora de foco. Subiu de 0,3 para 0,4 junto com a ida das
 * cores de 400 para 300: sobre branco, 0,4 de um 300 dá quase exatamente o
 * mesmo tom que 0,3 de um 400 dava. Ou seja, só o mês em foco clareou — os
 * meses recuados ficaram onde estavam, que era onde deviam estar.
 */
const OPACIDADE_FORA_DE_FOCO = 0.4;

function fmtBRLfull(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" (sem timezone). */
function fmtDateBR(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

/**
 * "YYYY-MM-DD" -> "DD/MM". Sem ano de propósito, mesmo nos vencimentos que caem
 * no ano seguinte: quem diz o ano é o "em N dias" ao lado, e o ano repetido
 * poluía a coluna inteira para desfazer uma dúvida que ninguém tem.
 */
function fmtDiaMes(d: string): string {
  const [, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 6 meses terminando no mês selecionado (inclusive). */
function sixMonthsEnding({
  year,
  month,
}: YearMonth): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    out.push({ key: monthKey(d), label: MONTH_LABELS[d.getMonth()] });
  }
  return out;
}

/** Meses de from..to (inclusive). Cruzando ano, label ganha o ano ("Dez 25"). */
function monthsBetween(
  from: YearMonth,
  to: YearMonth,
): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const crossYear = from.year !== to.year;
  let y = from.year;
  let m = from.month;
  while (y < to.year || (y === to.year && m <= to.month)) {
    const d = new Date(y, m - 1, 1);
    out.push({
      key: monthKey(d),
      label: crossYear
        ? `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}`
        : MONTH_LABELS[m - 1],
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
function futureMonths(
  { year, month }: YearMonth,
  n: number,
): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(year, month - 1 + i, 1);
    out.push({ key: monthKey(d), label: MONTH_LABELS[d.getMonth()] });
  }
  return out;
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

/** Dias entre hoje e uma data ISO (positivo = futuro). */
function daysUntil(iso: string): number {
  const t = todayISO();
  const a = new Date(t + "T00:00:00");
  const b = new Date(iso.slice(0, 10) + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function dueLabel(days: number): string {
  if (days < 0)
    return `${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"} atrás`;
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  // allCategories (e nao `categories`): aqui so resolvemos ROTULO de
  // lancamento ja gravado, que pode apontar pra categoria desativada.
  const { allCategories: categories } = useCategories();
  const ccs = user?.costCenters || [];
  const showCCFilter = ccs.length > 1;

  const [activeCC, setActiveCC] = useState<string>("all");
  const [period, setPeriod] = useState<DashPeriod>(defaultPeriod);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [openItems, setOpenItems] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = periodRange(period);
  const ymKey = (m: YearMonth) =>
    `${m.year}-${String(m.month).padStart(2, "0")}`;
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
        if (!cancel)
          setError(e instanceof Error ? e.message : "Erro ao carregar dados");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
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
    return () => {
      cancel = true;
    };
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
    let income = 0,
      expense = 0;
    for (const l of lines) {
      if (!inRange(l.date)) continue;
      if (l.is_estimated) continue; // previsto não entra no realizado
      if (l.direction === "income") income += l.value;
      else expense += l.value;
    }
    return { income, expense, balance: income - expense };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, fromKey, toKey]);

  // Pendentes (a_pagar / a_receber / vencido) DO PERÍODO selecionado (mesmo
  // recorte das Entradas/Saídas — não soma contas de meses anteriores). INCLUI
  // previsto (são obrigações projetadas do período).
  const pending = useMemo(() => {
    let aPagar = 0,
      aReceber = 0,
      vencido = 0;
    for (const l of lines) {
      if (!inRange(l.date)) continue;
      if (l.status === "a_pagar") aPagar += l.value;
      else if (l.status === "a_receber") aReceber += l.value;
      else if (l.status === "vencido") vencido += l.value;
    }
    return { aPagar, aReceber, vencido };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, fromKey, toKey]);

  // Série do gráfico: realizado (passado + atual) + PREVISTO (meses futuros, só
  // no modo Mês), alimentado pelos itens em aberto (recorrências projetadas etc.).
  const chartData = useMemo(() => {
    const isMonth = period.mode === "month";
    const selKey = isMonth
      ? monthKey(new Date(period.month.year, period.month.month - 1, 1))
      : "";
    const realMonths = isMonth
      ? sixMonthsEnding(period.month)
      : monthsBetween(range.from, range.to);
    const futMonths = isMonth ? futureMonths(period.month, 3) : [];
    type Row = {
      mes: string;
      mesNum: string;
      // Chave YYYY-MM: o rótulo ("Jul") não diz o ano, e o clique no gráfico
      // precisa dos dois para trocar o mês em análise.
      chave: string;
      entradas: number;
      saidas: number;
      previsto: boolean;
      sel: boolean;
    };
    const acc: Record<string, Row> = {};
    const order: string[] = [];
    for (const m of realMonths) {
      acc[m.key] = {
        mes: m.label,
        mesNum: m.key.slice(5),
        chave: m.key,
        entradas: 0,
        saidas: 0,
        previsto: false,
        sel: m.key === selKey,
      };
      order.push(m.key);
    }
    for (const m of futMonths) {
      acc[m.key] = {
        mes: m.label,
        mesNum: m.key.slice(5),
        chave: m.key,
        entradas: 0,
        saidas: 0,
        previsto: true,
        sel: false,
      };
      order.push(m.key);
    }
    for (const l of lines) {
      if (!l.date) continue;
      if (l.is_estimated) continue; // realizado não inclui previsto
      const k = l.date.slice(0, 7);
      if (!acc[k] || acc[k].previsto) continue;
      if (l.direction === "income") acc[k].entradas += l.value;
      else acc[k].saidas += l.value;
    }
    if (isMonth) {
      for (const r of openItems) {
        if (r.counts_in_total === false) continue;
        if (!receiptMatchesCC(r, activeCC)) continue;
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

  /**
   * Clicar num mês do gráfico passa a análise para aquele mês — a mesma coisa
   * que clicar nele na régua acima. O gráfico vira a segunda face do mesmo
   * controle, e já era ali que o usuário estava olhando quando decidia trocar.
   *
   * Só no modo Mês: nos outros não existe "mês selecionado" para mudar, e um
   * clique que jogasse o dashboard inteiro de Ano para Mês seria uma virada
   * grande demais para acontecer sem aviso.
   */
  const selecionarMes = (chave: string) => {
    if (period.mode !== "month") return;
    const [ano, mes] = chave.split("-").map(Number);
    if (!ano || !mes) return;
    if (ano === period.month.year && mes === period.month.month) return;
    setPeriod({ ...period, month: { year: ano, month: mes } });
  };

  // Rótulos do eixo X: no mobile a régua fica estreita, então mostramos TODOS os
  // meses mas com rótulo numérico (01, 02, …) — cabe sem o auto-skip irregular do
  // recharts. No desktop mantém os nomes (Jan, Fev, …) com o comportamento padrão.
  const isMobile = useIsMobile();
  // Prévia de um lançamento ao clicar numa linha de "Próximos Vencimentos".
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  // (D) Comparativo com o mês anterior — só no modo Mês (passado está no fetch).
  const lastMonthKpis = useMemo(() => {
    if (period.mode !== "month") return null;
    const prevKey = monthKey(
      new Date(period.month.year, period.month.month - 2, 1),
    );
    let income = 0,
      expense = 0;
    for (const l of lines) {
      if (!l.date || l.date.slice(0, 7) !== prevKey) continue;
      if (l.is_estimated) continue;
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
      if (l.is_estimated) continue;
      const id = l.cost_center_id || "none";
      byCC[id] = (byCC[id] || 0) + l.value;
    }
    return Object.entries(byCC)
      .map(([id, total]) => {
        const cc = ccs.find((c) => c.id === id);
        return {
          id,
          name: cc?.name || "Sem centro",
          // Um tom acima da cor do centro (400 -> 300): na rosca a área é
          // grande e o 400 pesava. O chip do CC continua no 400 — a cor de
          // identidade não muda, só o uso dela aqui.
          //
          // Sem cor definida no centro de custo, cai no cinza DO APP. Era o
          // slate-400 azulado do Tailwind (resto da paleta antiga), e no
          // gráfico ele destoava de todos os outros cinzas da tela.
          color: ccChartColor(cc?.color || "#a3a3a3"),
          total,
        };
      })
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, fromKey, toKey, ccs]);

  // (B) Próximos Vencimentos — itens em aberto com vencimento de hoje em diante.
  const dueSoon = useMemo(() => {
    const today = todayISO();
    return openItems
      .filter((r) => {
        if (r.counts_in_total === false) return false;
        if (!receiptMatchesCC(r, activeCC)) return false;
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
      if (l.is_estimated) continue;
      const cat = l.category || "outros_despesa";
      byCat[cat] = (byCat[cat] || 0) + l.value;
    }
    return Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, total]) => ({ cat, total }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, fromKey, toKey]);

  const [exportingPdf, setExportingPdf] = useState(false);

  // Monta o mesmo ReportDoc dos Relatórios a partir do dashboard, reusando o PDF
  // vetorial já testado (reportToPdf no nativo / openReportPage no web).
  const buildDashboardDoc = (): ReportDoc => {
    const ccLabel =
      activeCC === "all"
        ? "Todos os Centros"
        : ccs.find((c) => c.id === activeCC)?.name || "Centro";
    const catTotal = topCategories.reduce((s, c) => s + c.total, 0);
    const pct = (v: number) =>
      catTotal > 0
        ? `${((v / catTotal) * 100).toFixed(1).replace(".", ",")}%`
        : "—";

    const tables: ReportDoc["tables"] = [
      {
        title: "Pendências",
        columns: [
          { label: "Situação", width: "60%" },
          { label: "Valor", money: true, align: "right", width: "40%" },
        ],
        rows: [
          ["A pagar", pending.aPagar],
          ["A receber", pending.aReceber],
          ["Vencido", pending.vencido],
        ],
      },
      {
        title: "Entradas × Saídas por mês",
        // O MESMO gráfico da tela, agora no papel. A tabela continua logo
        // abaixo: a figura mostra a forma do ano, os números ficam com ela.
        chart: {
          tipo: "barras",
          series: [
            { nome: "Entradas", cor: FUNDO.entrada },
            { nome: "Saídas", cor: FUNDO.saida },
          ],
          grupos: chartData.map((d) => ({
            rotulo: d.mes,
            valores: [d.entradas, d.saidas],
            esmaecido: d.previsto,
            // Mesma moldura da tela: o mês em foco ganha a faixa escura, e o
            // relatório mostra qual período está sendo lido sem depender do
            // subtítulo lá em cima.
            ativo: d.sel,
          })),
        },
        columns: [
          { label: "Mês", width: "40%" },
          { label: "Entradas", money: true, align: "right", width: "30%" },
          { label: "Saídas", money: true, align: "right", width: "30%" },
        ],
        rows: chartData.map((d) => [
          d.previsto ? `${d.mes} (prev.)` : d.mes,
          d.entradas,
          d.saidas,
        ]),
      },
    ];
    if (topCategories.length) {
      tables.push({
        title: "Onde mais saiu (categorias)",
        // Rosca, como na tela. As cores acompanham a ordem do ranking, do tom
        // mais forte ao mais claro, para a maior fatia se impor sozinha.
        chart: {
          tipo: "rosca",
          fatias: topCategories.map((c, i) => ({
            rotulo: getCategoryLabel(c.cat, categories),
            valor: c.total,
            cor: PALETA_ROSCA[i % PALETA_ROSCA.length],
          })),
        },
        columns: [
          { label: "Categoria", width: "56%" },
          { label: "Valor", money: true, align: "right", width: "28%" },
          { label: "%", align: "right", width: "16%" },
        ],
        rows: topCategories.map((c) => [
          getCategoryLabel(c.cat, categories),
          c.total,
          pct(c.total),
        ]),
        total: ["Total", catTotal, ""],
      });
    }
    if (ccSpend.length) {
      tables.push({
        title: "Gastos por centro",
        columns: [
          { label: "Centro", width: "70%" },
          { label: "Valor", money: true, align: "right", width: "30%" },
        ],
        rows: ccSpend.map((c) => [c.name, c.total]),
        total: ["Total", ccSpend.reduce((s, c) => s + c.total, 0)],
      });
    }

    return {
      title: "Dashboard",
      periodLabel: periodLabel(period),
      ccLabel,
      meta: [
        {
          label: "Entradas",
          value: fmtBRLfull(monthKpis.income),
          tone: "in",
        },
        {
          label: "Saídas",
          value: fmtBRLfull(monthKpis.expense),
          tone: "out",
        },
        {
          label: "Saldo",
          value: fmtBRLfull(monthKpis.balance),
          tone: monthKpis.balance >= 0 ? "in" : "out",
        },
      ],
      tables,
    };
  };

  // Exporta o dashboard em PDF — mesmo fluxo dos Relatórios.
  const handleExportPdf = async () => {
    setExportingPdf(true);
    const toastId = toast.loading("Gerando PDF…");
    try {
      const doc = buildDashboardDoc();
      if (isNativeCapacitorApp()) {
        const { blob } = await reportToPdf(doc);
        await exportFile(
          `dashboard_${todayISO()}.pdf`,
          blob,
          "application/pdf",
        );
      } else {
        await openReportPage(doc);
      }
      toast.dismiss(toastId);
    } catch {
      toast.error("Erro ao gerar o PDF.", { id: toastId });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* DOIS conjuntos de metade cada: à esquerda "quando" (período + mês),
          à direita "o quê" (centro + exportar).
          Antes eram três colunas de largura igual, e o botão do mês media pelo
          próprio rótulo — sobrava um vão no meio da barra, dentro da célula
          dele. Aqui o vão não existe: em cada metade o CAMPO estica
          (`flex-1 min-w-0`, então conteúdo longo não o alarga) e o botão fica
          com a largura que precisa. */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        <div className="flex basis-full sm:basis-0 sm:flex-1 min-w-0 items-center gap-2">
          <PeriodModeSelect
            value={period}
            onChange={setPeriod}
            className="flex-1 min-w-0"
          />
          {period.mode === "month" && (
            <MonthSwitcher
              value={period.month}
              onChange={(month) => setPeriod({ ...period, month })}
              variant="picker"
            />
          )}
        </div>

        <div className="flex basis-full sm:basis-0 sm:flex-1 min-w-0 items-center gap-2">
          {showCCFilter && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(CAMPO_BARRA, "flex-1 min-w-0")}
                >
                  {activeCC !== "all" ? (
                    <CostCenterChip
                      icon={ccs.find((c) => c.id === activeCC)?.icon}
                      color={ccs.find((c) => c.id === activeCC)?.color}
                      className="size-[18px]"
                    />
                  ) : (
                    <AllCentersChip className="size-[18px]" />
                  )}
                  <span
                    className="flex-1 text-left truncate"
                    style={
                      activeCC !== "all"
                        ? {
                            color: ccTextColor(
                              ccs.find((c) => c.id === activeCC)?.color,
                            ),
                          }
                        : undefined
                    }
                  >
                    {activeCC === "all"
                      ? "Todos os Centros"
                      : ccs.find((c) => c.id === activeCC)?.name || "Centro"}
                  </span>
                  <ChevronDown className="size-4 text-slate-500 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem
                  onClick={() => setActiveCC("all")}
                  className={
                    activeCC === "all"
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
                    onClick={() => setActiveCC(cc.id)}
                    className={
                      activeCC === cc.id
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
          )}

          <Button
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto shrink-0")}
          >
            <Download className="size-[18px]" />
            {exportingPdf ? "Gerando…" : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* Controles do modo selecionado (régua de meses / semestre / ano / datas).
          O seletor de modo em si fica na barra de topo, ao lado dos centros. */}
      <PeriodSwitcher value={period} onChange={setPeriod} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {/* KPIs do mês + pendências: uma linha só, mesmo padrão de card. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Paleta alinhada aos valores em Lançamentos: entrada/receita =
            emerald-700; despesa = slate-900 (neutra, sem vermelho). Vermelho
            fica só p/ ALERTA (Vencido, Saldo negativo); amber = A pagar. */}
        <KpiCard
          label={period.mode === "month" ? "Entradas (mês)" : "Entradas"}
          value={monthKpis.income}
          color="text-emerald-700"
          loading={loading}
          delta={
            lastMonthKpis
              ? mkDelta(monthKpis.income, lastMonthKpis.income, true)
              : null
          }
        />
        <KpiCard
          label={period.mode === "month" ? "Saídas (mês)" : "Saídas"}
          value={monthKpis.expense}
          color="text-slate-900"
          loading={loading}
          delta={
            lastMonthKpis
              ? mkDelta(monthKpis.expense, lastMonthKpis.expense, false)
              : null
          }
        />
        <KpiCard
          label={period.mode === "month" ? "Saldo (mês)" : "Saldo"}
          value={monthKpis.balance}
          color={monthKpis.balance >= 0 ? "text-emerald-700" : "text-red-600"}
          loading={loading}
          delta={
            lastMonthKpis
              ? mkDelta(monthKpis.balance, lastMonthKpis.balance, true)
              : null
          }
        />
        <KpiCard
          label={period.mode === "month" ? "A pagar (mês)" : "A pagar"}
          value={pending.aPagar}
          // Cinza: "a pagar" é despesa, e no app despesa é neutra — o vermelho
          // fica só para ALERTA (Vencido, saldo negativo). Chegou a ser âmbar
          // (que lia como pendência e reprovava no contraste, 3,19:1) e azul
          // (a convenção de "agendado"); o neutro ganhou no olho.
          color="text-slate-900"
          loading={loading}
        />
        <KpiCard
          label={period.mode === "month" ? "A receber (mês)" : "A receber"}
          value={pending.aReceber}
          color="text-emerald-700"
          loading={loading}
        />
        <KpiCard
          label="Vencido"
          value={pending.vencido}
          color="text-red-600"
          loading={loading}
        />
      </div>

      {/* Gráfico minimalista: 6 meses terminando no selecionado. O mês
          selecionado (último) fica com barras cheias; os anteriores esmaecem
          como contexto. Sem grade/eixo Y/legenda do recharts — valores no
          tooltip, legenda em dots discretos no título. */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="mb-4 space-y-2">
          <h2 className="text-sm font-medium text-slate-500">
            Entradas × Saídas
          </h2>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: COLOR_IN }}
              />
              Entradas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: COLOR_OUT }}
              />
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
        <div
          className={cn("h-56", period.mode === "month" && "cursor-pointer")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
              barGap={4}
            >
              {/* MOLDURA do mês em foco — envolve as barras E o rótulo do mês.
                  Antes o mês selecionado se distinguia só pela opacidade das
                  barras, o que some num print em preto e branco e é difícil de
                  achar quando o mês tem valores pequenos.

                  `Customized` recebe o estado interno do gráfico (xAxisMap e
                  offset), que é de onde sai a geometria da FAIXA: `scale(mes)`
                  dá o início e `bandwidth()` a largura. Sem isso seria chute —
                  ReferenceArea num eixo de categoria fecha com largura zero.

                  Falha em silêncio (retorna null) se o formato interno mudar
                  numa atualização do recharts: some a moldura, não o gráfico. */}
              <Customized
                component={(props: unknown) => {
                  const geo = geometriaDoEixo(props);
                  if (!geo) return <g />;
                  const { escala, largura, topo, altura } = geo;
                  const base = topo + altura;

                  const folga = Math.min(6, largura / 4);
                  return (
                    <g>
                      {chartData.map((d) => {
                        const x = escala(d.mes);
                        if (x == null) return null;
                        const esq = x + folga / 2;
                        const largMoldura = largura - folga;
                        const alturaMoldura = altura + RODAPE_ALTURA;

                        // Fora de foco: só o contorno, sem fundo, com um
                        // divisor separando as barras do nome do mês.
                        if (!d.sel) {
                          return (
                            <g key={d.mes}>
                              <rect
                                x={esq}
                                y={topo}
                                width={largMoldura}
                                height={alturaMoldura}
                                rx={8}
                                fill="none"
                                stroke="#f5f5f5"
                                strokeWidth={1}
                              />
                              <line
                                x1={esq}
                                y1={base}
                                x2={esq + largMoldura}
                                y2={base}
                                stroke="#f5f5f5"
                                strokeWidth={1}
                              />
                            </g>
                          );
                        }

                        // Em foco: sem fundo atrás das barras — o branco do
                        // card já é o fundo —, e o vidro escuro só na faixa do
                        // mês. O contorno vem DEPOIS do rodapé, senão o rodapé
                        // comeria a metade de dentro da linha de baixo.
                        return (
                          <g key={d.mes}>
                            <path
                              d={caminhoDeRodape(
                                esq,
                                base,
                                largMoldura,
                                RODAPE_ALTURA,
                                8,
                              )}
                              fill={FOCO_FUNDO}
                              fillOpacity={FOCO_OPACIDADE}
                            />
                            <rect
                              x={esq}
                              y={topo}
                              width={largMoldura}
                              height={alturaMoldura}
                              rx={8}
                              fill="none"
                              // Mesma borda do card (slate-200). O mês em foco é
                              // um bloco dentro do card, não um card por cima
                              // dele — uma borda mais escura o descolava.
                              stroke="#e5e5e5"
                              strokeWidth={1}
                            />
                          </g>
                        );
                      })}
                    </g>
                  );
                }}
              />
              <XAxis
                dataKey="mes"
                stroke="#a3a3a3"
                fontSize={14}
                tickLine={false}
                axisLine={false}
                // +6 de sobra para o contorno da moldura não ser cortado pelo
                // limite do svg.
                height={RODAPE_ALTURA + 6}
                tickSize={0}
                tickMargin={RODAPE_ALTURA / 2}
                interval={isMobile ? 0 : undefined}
                /* Rótulo desenhado à mão só por causa da cor: o do mês em foco
                   cai dentro do bloco escuro, e no cinza padrão ficaria em
                   1,7:1 — sumia, que foi o problema de duas rodadas atrás.
                   Como o tick já é custom, o recorte do mobile (número no lugar
                   do nome) vem junto, no lugar do tickFormatter. */
                tick={(props: unknown) => {
                  const { x, y, payload } = props as {
                    x: number;
                    y: number;
                    payload: { value: string; index: number };
                  };
                  const d = chartData[payload.index];
                  return (
                    <TextoSVG
                      x={x}
                      y={y}
                      textAnchor="middle"
                      verticalAnchor="middle"
                      fontSize={14}
                      fill={d?.sel ? "#ffffff" : "#a3a3a3"}
                    >
                      {isMobile ? (d?.mesNum ?? "") : payload.value}
                    </TextoSVG>
                  );
                }}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                contentStyle={{
                  background: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: 6,
                  fontSize: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
                formatter={(value: number) => fmtBRLfull(value)}
              />
              <Bar dataKey="entradas" name="Entradas" maxBarSize={28}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={COLOR_IN}
                    fillOpacity={
                      esmaecida(d, period.mode) ? OPACIDADE_FORA_DE_FOCO : 1
                    }
                  />
                ))}
              </Bar>
              <Bar dataKey="saidas" name="Saídas" maxBarSize={28}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={COLOR_OUT}
                    fillOpacity={
                      esmaecida(d, period.mode) ? OPACIDADE_FORA_DE_FOCO : 1
                    }
                  />
                ))}
              </Bar>
              {/* ALVOS DE CLIQUE — um por mês, cobrindo a moldura inteira
                  (barras + faixa do nome). Vêm depois das <Bar> de propósito:
                  precisam ficar por cima, senão o clique numa barra alta
                  pararia nela.

                  O onClick do próprio <BarChart> não serve: ele só considera o
                  retângulo de plotagem (`inRange`, no recharts), então a faixa
                  do nome do mês — que a moldura mostra como parte do mês —
                  ficaria morta justamente onde a pessoa mira.

                  A largura aqui é a banda INTEIRA, sem a folga da moldura: área
                  de clique menor que o alvo visual deixaria faixas mortas entre
                  os meses. */}
              <Customized
                component={(props: unknown) => {
                  if (period.mode !== "month") return <g />;
                  const geo = geometriaDoEixo(props);
                  if (!geo) return <g />;
                  return (
                    <g>
                      {chartData.map((d) => {
                        const x = geo.escala(d.mes);
                        if (x == null) return null;
                        return (
                          <rect
                            key={d.chave}
                            x={x}
                            y={geo.topo}
                            width={geo.largura}
                            height={geo.altura + RODAPE_ALTURA}
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                            onClick={() => selecionarMes(d.chave)}
                          />
                        );
                      })}
                    </g>
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdowns: por categoria (esq) + por centro de custo (dir) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Onde mais saiu — por categoria */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-medium text-slate-500 mb-3">
            Onde Mais Saiu — {periodLabel(period)}
          </h2>
          {topCategories.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sem despesas neste período.
            </p>
          ) : (
            <ul className="space-y-2">
              {topCategories.map((c) => {
                const max = topCategories[0].total;
                const pct = max
                  ? Math.max(4, Math.round((c.total / max) * 100))
                  : 0;
                return (
                  <li key={c.cat} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 truncate flex-1 min-w-0 sm:flex-none sm:w-32 sm:shrink-0">
                      {getCategoryLabel(c.cat, categories)}
                    </span>
                    {/* Barra no slate-300 sobre trilho slate-100: dois degraus
                        de diferença. Clarear mais uma casa colaria a barra no
                        trilho e a comparação de tamanhos — que é a única coisa
                        que este card faz — se perderia. */}
                    <div className="hidden sm:block flex-1 h-3 bg-slate-100 rounded-sm">
                      <div
                        className="h-3 rounded-sm bg-slate-300"
                        style={{ width: `${pct}%` }}
                      />
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
            <h2 className="text-sm font-medium text-slate-500 mb-3">
              Gastos por Centro — {periodLabel(period)}
            </h2>
            {ccSpend.length === 0 ? (
              <p className="text-sm text-slate-500">
                Sem despesas neste período.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ccSpend}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={42}
                        outerRadius={66}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {ccSpend.map((c) => (
                          <Cell key={c.id} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => fmtBRLfull(v)}
                        contentStyle={{
                          background: "white",
                          border: "1px solid #e5e5e5",
                          borderRadius: 6,
                          fontSize: 14,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="w-full sm:flex-1 space-y-1.5 min-w-0">
                  {(() => {
                    const total = ccSpend.reduce((s, x) => s + x.total, 0);
                    return ccSpend.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-slate-700 truncate flex-1 min-w-0">
                          {c.name}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {total ? Math.round((c.total / total) * 100) : 0}%
                        </span>
                        <span className="text-slate-700 tabular-nums w-20 text-right">
                          {fmtBRLfull(c.total)}
                        </span>
                      </li>
                    ));
                  })()}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* (B) Próximos Vencimentos — contas a pagar/receber de hoje em diante */}
      {dueSoon.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-medium text-slate-500 mb-3">
            Próximos Vencimentos
          </h2>
          <ul className="divide-y divide-slate-100">
            {dueSoon.map((r) => {
              const days = daysUntil(r.due_date!);
              const cc = ccs.find((c) => c.id === r.cost_center_id);
              const income = r.direction === "income";
              return (
                <li
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewReceipt(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPreviewReceipt(r);
                    }
                  }}
                  className="flex items-center gap-3 py-2 text-sm cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                >
                  {/* Data primeiro, relativo como apoio: "em 118 dias" não
                      diz quando, e a data sozinha obriga a contar. Largura fixa
                      para as descrições ficarem alinhadas. */}
                  <span
                    className={`w-40 shrink-0 whitespace-nowrap tabular-nums ${days <= 2 ? "text-red-600" : "text-slate-500"}`}
                  >
                    {fmtDiaMes(r.due_date!)} — {dueLabel(days)}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-slate-700">
                    {r.vendor
                      ? r.vendor.toUpperCase()
                      : r.category
                        ? getCategoryLabel(r.category, categories)
                        : income
                          ? "A receber"
                          : "A pagar"}
                    {cc && showCCFilter ? (
                      <span className="text-slate-500"> — {cc.name}</span>
                    ) : null}
                    {r.is_estimated ? (
                      <span className="text-slate-500"> — Previsto</span>
                    ) : null}
                  </span>
                  <span
                    className={`tabular-nums shrink-0 ${income ? "text-emerald-700" : "text-slate-900"}`}
                  >
                    {income ? "+" : "−"}
                    {fmtBRLfull(Number(r.total_value))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Prévia do lançamento (Próximos Vencimentos) — só leitura. */}
      <Dialog
        open={!!previewReceipt}
        onOpenChange={(o) => !o && setPreviewReceipt(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Lançamento</DialogTitle>
          </DialogHeader>
          {previewReceipt &&
            (() => {
              const r = previewReceipt;
              const cc = ccs.find((c) => c.id === r.cost_center_id);
              const income = r.direction === "income";
              const statusKey = r.status as keyof typeof STATUS_LABEL;
              return (
                <dl className="text-sm">
                  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                    <dt className="text-slate-500">Tipo</dt>
                    <dd className="text-slate-900">
                      {income ? "Entrada (receita)" : "Saída (despesa)"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      <Badge
                        colorScheme={STATUS_COLOR_SCHEME[statusKey] ?? "slate"}
                      >
                        {STATUS_LABEL[statusKey] ?? r.status}
                      </Badge>
                      {r.is_estimated ? (
                        <span className="text-slate-500 ml-2">Previsto</span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                    <dt className="text-slate-500">Valor</dt>
                    <dd
                      className={`font-medium tabular-nums ${income ? "text-emerald-700" : "text-slate-900"}`}
                    >
                      {income ? "+" : "−"}
                      {fmtBRLfull(Number(r.total_value))}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                    <dt className="text-slate-500">Origem</dt>
                    <dd className="text-slate-900 break-words">
                      {r.vendor ? r.vendor.toUpperCase() : "—"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                    <dt className="text-slate-500">Categoria</dt>
                    <dd className="text-slate-900">
                      {getCategoryLabel(r.category, categories)}
                    </dd>
                  </div>
                  {showCCFilter && (
                    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                      <dt className="text-slate-500">Centro de custo</dt>
                      <dd className="text-slate-900">{cc?.name ?? "—"}</dd>
                    </div>
                  )}
                  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100">
                    <dt className="text-slate-500">Transação</dt>
                    <dd className="text-slate-900 tabular-nums">
                      {fmtDateBR(r.transaction_date)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-3 py-2">
                    <dt className="text-slate-500">Vencimento</dt>
                    <dd className="text-slate-900 tabular-nums">
                      {fmtDateBR(r.due_date)}
                    </dd>
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

interface Delta {
  pct: number | null;
  up: boolean;
  good: boolean;
}

/** Variação vs mês anterior. higherIsGood: entradas/saldo=true, saídas=false. */
function mkDelta(
  cur: number,
  last: number,
  higherIsGood: boolean,
): Delta | null {
  if (last === 0 && cur === 0) return null;
  const up = cur > last;
  const good = higherIsGood ? cur >= last : cur <= last;
  const pct =
    last !== 0 ? Math.round(Math.abs((cur - last) / last) * 100) : null;
  return { pct, up, good };
}

function KpiCard({
  label,
  value,
  color,
  loading,
  delta,
}: {
  label: string;
  value: number;
  color: string;
  loading: boolean;
  delta?: Delta | null;
}) {
  // `delta === undefined`: card que nunca compara (A pagar / A receber /
  // Vencido). `delta === null`: card que compara, mas não neste período (fora
  // do modo Mês). Só o primeiro caso dispensa o espaço reservado abaixo.
  const temComparativo = delta !== undefined;
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-500 truncate">{label}</p>
      <p className={`text-base font-medium mt-1 tabular-nums ${color}`}>
        {loading ? "..." : fmtBRLfull(value)}
      </p>
      {temComparativo ? (
        // Altura RESERVADA (2 linhas de text-sm = 40px), ocupada ou não.
        // Trocar de mês dispara um carregamento, e sem a reserva o comparativo
        // sumia e voltava: como o grid iguala a altura da linha, a fileira
        // inteira de cards encolhia e crescia a cada troca. A reserva também
        // cobre o mês sem base de comparação (mês anterior zerado, pct null),
        // que dava o mesmo pulo entre dois meses já carregados.
        <div className="mt-1 h-10 text-sm tabular-nums">
          {!loading && delta && delta.pct !== null ? (
            <p
              // emerald-600 dá 3,77:1 no branco; o 700 dá 5,48:1.
              className={delta.good ? "text-emerald-700" : "text-red-600"}
            >
              <span className="whitespace-nowrap">
                {delta.up ? "▲" : "▼"} {delta.pct}%
              </span>{" "}
              <span className="block text-slate-500">vs mês passado</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
