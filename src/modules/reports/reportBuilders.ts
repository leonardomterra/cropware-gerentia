import type { FarmCategory, Receipt, ReceiptDirection } from "@/modules/receipts/types";
import { receiptLines } from "@/modules/receipts/utils/receiptLines";
import {
  formatBRL,
  formatDateBR,
  getCategoryLabel,
} from "@/modules/receipts/utils/receiptFormatters";
import { STATUS_LABEL } from "@/modules/receipts/constants";

// ---- Tipos do documento de relatório (renderizado em tela, CSV e impressão) --

export type ReportKind = "resumo" | "categoria" | "centro" | "contas";
export type DirectionFilter = "all" | ReceiptDirection;

export interface ReportColumn {
  label: string;
  /** célula é monetária (number cru → formatado na exibição/CSV). */
  money?: boolean;
  align?: "right";
  /** largura fixa (CSS) p/ alinhar colunas entre tabelas (table-fixed). As
   *  colunas sem width dividem o espaço restante. */
  width?: string;
}
export type ReportCell = string | number;
export interface ReportTable {
  title?: string;
  columns: ReportColumn[];
  rows: ReportCell[][];
  /** linha de total (mesmas colunas). */
  total?: ReportCell[];
}
export interface ReportMeta {
  label: string;
  value: string;
  tone?: "in" | "out" | "muted";
}
export interface ReportDoc {
  title: string;
  periodLabel: string;
  ccLabel: string;
  meta: ReportMeta[];
  tables: ReportTable[];
  /** quando não há nada pra mostrar. */
  empty?: boolean;
}

export interface ReportContext {
  categories: FarmCategory[];
  ccNameById: Map<string, string>;
  periodLabel: string;
  ccLabel: string;
  direction: DirectionFilter;
}

interface RLine {
  date: string | null;
  due_date: string | null;
  direction: ReceiptDirection;
  status: Receipt["status"];
  categoryLabel: string;
  ccName: string;
  value: number;
  vendor: string;
}

// Nome completo — usado no TÍTULO do PDF/relatório impresso.
const REPORT_LABEL: Record<ReportKind, string> = {
  resumo: "Resumo do período",
  categoria: "Detalhado por categoria",
  centro: "Detalhado por centro de custo",
  contas: "Contas a pagar / receber",
};

// Nome curto — usado SÓ no seletor (cabe melhor no mobile). O PDF segue completo.
const REPORT_SHORT_LABEL: Record<ReportKind, string> = {
  resumo: "Resumo",
  categoria: "Por categoria",
  centro: "Por centro de custo",
  contas: "A pagar / receber",
};

export const REPORT_OPTIONS: { value: ReportKind; label: string }[] = (
  Object.keys(REPORT_LABEL) as ReportKind[]
).map((value) => ({ value, label: REPORT_SHORT_LABEL[value] }));

// Expande lançamentos em linhas (itens desmembrados já são excluídos por
// receiptLines), enriquecendo com vendor/vencimento/labels.
function toReportLines(receipts: Receipt[], ctx: ReportContext): RLine[] {
  return receipts.flatMap((r) =>
    receiptLines(r).map((ln) => ({
      date: ln.date,
      due_date: r.due_date,
      direction: ln.direction,
      status: ln.status,
      categoryLabel: getCategoryLabel(ln.category, ctx.categories),
      ccName: ln.cost_center_id
        ? ctx.ccNameById.get(ln.cost_center_id) ?? "Sem centro"
        : "Sem centro",
      value: ln.value,
      vendor: r.vendor || r.description || "—",
    })),
  );
}

function byDirection(dir: DirectionFilter) {
  return (l: RLine) => dir === "all" || l.direction === dir;
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const fmtPct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1).replace(".", ",")}%` : "—";

// ---- Builders -------------------------------------------------------------

// Agrupa linhas por uma chave (categoria/centro), ordena desc e calcula %.
function groupRows(
  ls: RLine[],
  key: (l: RLine) => string,
  total: number,
): ReportCell[][] {
  const m = new Map<string, number>();
  for (const l of ls) m.set(key(l), (m.get(key(l)) ?? 0) + l.value);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, v, fmtPct(v, total)] as ReportCell[]);
}

const PCT_COLS = (head: string): ReportColumn[] => [
  { label: head, width: "56%" },
  { label: "Valor", money: true, align: "right", width: "28%" },
  { label: "%", align: "right", width: "16%" },
];

function buildResumo(receipts: Receipt[], ctx: ReportContext): ReportDoc {
  const lines = toReportLines(receipts, ctx);
  const incLines = lines.filter((l) => l.direction === "income");
  const expLines = lines.filter((l) => l.direction === "expense");
  const income = sum(incLines.map((l) => l.value));
  const expense = sum(expLines.map((l) => l.value));

  const tables: ReportTable[] = [];
  const pushGroup = (
    title: string,
    rows: ReportCell[][],
    head: string,
    total: number,
  ) => {
    if (rows.length) {
      tables.push({ title, columns: PCT_COLS(head), rows, total: ["Total", total, ""] });
    }
  };

  // Entradas (por categoria + por centro), depois Saídas — espelha os cards.
  pushGroup("Entradas por categoria", groupRows(incLines, (l) => l.categoryLabel, income), "Categoria", income);
  pushGroup("Entradas por centro de custo", groupRows(incLines, (l) => l.ccName, income), "Centro de custo", income);
  pushGroup("Saídas por categoria", groupRows(expLines, (l) => l.categoryLabel, expense), "Categoria", expense);
  pushGroup("Saídas por centro de custo", groupRows(expLines, (l) => l.ccName, expense), "Centro de custo", expense);

  return {
    title: REPORT_LABEL.resumo,
    periodLabel: ctx.periodLabel,
    ccLabel: ctx.ccLabel,
    meta: [
      { label: "Entradas", value: formatBRL(income), tone: "in" },
      { label: "Saídas", value: formatBRL(expense), tone: "out" },
      { label: "Saldo", value: formatBRL(income - expense) },
      { label: "Lançamentos", value: String(receipts.length), tone: "muted" },
    ],
    tables,
    empty: tables.length === 0,
  };
}

// Detalhado agrupado (por categoria ou por centro), uma tabela por grupo.
function buildGrouped(
  receipts: Receipt[],
  ctx: ReportContext,
  groupBy: "categoria" | "centro",
): ReportDoc {
  const lines = toReportLines(receipts, ctx).filter(byDirection(ctx.direction));
  const keyOf = (l: RLine) => (groupBy === "categoria" ? l.categoryLabel : l.ccName);

  const groups = new Map<string, RLine[]>();
  for (const l of lines) {
    const k = keyOf(l);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l);
  }

  const tables: ReportTable[] = [...groups.entries()]
    .map(([key, ls]) => ({ key, ls, total: sum(ls.map((l) => l.value)) }))
    .sort((a, b) => b.total - a.total)
    .map(({ key, ls, total }) => ({
      title: key,
      columns: [
        { label: "Data", width: "16%" },
        { label: "Origem", width: "38%" },
        { label: groupBy === "categoria" ? "Centro de custo" : "Categoria", width: "26%" },
        { label: "Valor", money: true, align: "right" as const, width: "20%" },
      ],
      rows: ls
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .map((l) => [
          formatDateBR(l.date),
          l.vendor,
          groupBy === "categoria" ? l.ccName : l.categoryLabel,
          l.value,
        ]),
      total: ["", "", "Total", total],
    }));

  return {
    title: groupBy === "categoria" ? REPORT_LABEL.categoria : REPORT_LABEL.centro,
    periodLabel: ctx.periodLabel,
    ccLabel: ctx.ccLabel,
    meta: [
      { label: "Total", value: formatBRL(sum(lines.map((l) => l.value))) },
      { label: "Lançamentos", value: String(lines.length), tone: "muted" },
    ],
    tables,
    empty: tables.length === 0,
  };
}

function buildContas(receipts: Receipt[], ctx: ReportContext): ReportDoc {
  // Nível cabeçalho (status/vencimento são do lançamento, não do item).
  const pagar = receipts
    .filter((r) => r.status === "a_pagar" || r.status === "vencido")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const receber = receipts
    .filter((r) => r.status === "a_receber")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const mk = (rs: Receipt[]): ReportTable["rows"] =>
    rs.map((r) => [
      formatDateBR(r.due_date),
      r.vendor || r.description || "—",
      getCategoryLabel(r.category, ctx.categories),
      STATUS_LABEL[r.status],
      Number(r.total_value) || 0,
    ]);

  const cols: ReportColumn[] = [
    { label: "Vencimento", width: "16%" },
    { label: "Origem", width: "30%" },
    { label: "Categoria", width: "24%" },
    { label: "Status", width: "14%" },
    { label: "Valor", money: true, align: "right", width: "16%" },
  ];
  const totalPagar = sum(pagar.map((r) => Number(r.total_value) || 0));
  const totalReceber = sum(receber.map((r) => Number(r.total_value) || 0));

  const tables: ReportTable[] = [];
  if (pagar.length)
    tables.push({ title: "A pagar", columns: cols, rows: mk(pagar), total: ["", "", "", "Total", totalPagar] });
  if (receber.length)
    tables.push({ title: "A receber", columns: cols, rows: mk(receber), total: ["", "", "", "Total", totalReceber] });

  return {
    title: REPORT_LABEL.contas,
    periodLabel: ctx.periodLabel,
    ccLabel: ctx.ccLabel,
    meta: [
      { label: "A pagar", value: formatBRL(totalPagar), tone: "out" },
      { label: "A receber", value: formatBRL(totalReceber), tone: "in" },
    ],
    tables,
    empty: tables.length === 0,
  };
}

export function buildReport(
  kind: ReportKind,
  allReceipts: Receipt[],
  ctx: ReportContext,
): ReportDoc {
  // Informativos (counts_in_total=false, ex.: faturas) ficam fora dos relatórios
  // — assim não duplicam com as compras avulsas de cartão.
  const receipts = allReceipts.filter((r) => r.counts_in_total !== false);
  switch (kind) {
    case "resumo":
      return buildResumo(receipts, ctx);
    case "categoria":
      return buildGrouped(receipts, ctx, "categoria");
    case "centro":
      return buildGrouped(receipts, ctx, "centro");
    case "contas":
      return buildContas(receipts, ctx);
  }
}
