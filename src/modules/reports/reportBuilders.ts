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

const REPORT_LABEL: Record<ReportKind, string> = {
  resumo: "Resumo do período",
  categoria: "Detalhado por categoria",
  centro: "Detalhado por centro de custo",
  contas: "Contas a pagar / receber",
};

export const REPORT_OPTIONS: { value: ReportKind; label: string }[] = (
  Object.keys(REPORT_LABEL) as ReportKind[]
).map((value) => ({ value, label: REPORT_LABEL[value] }));

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

function buildResumo(receipts: Receipt[], ctx: ReportContext): ReportDoc {
  const lines = toReportLines(receipts, ctx);
  const income = sum(lines.filter((l) => l.direction === "income").map((l) => l.value));
  const expense = sum(lines.filter((l) => l.direction === "expense").map((l) => l.value));

  // Saídas por categoria
  const expLines = lines.filter((l) => l.direction === "expense");
  const byCat = new Map<string, number>();
  for (const l of expLines) byCat.set(l.categoryLabel, (byCat.get(l.categoryLabel) ?? 0) + l.value);
  const catRows = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => [cat, val, fmtPct(val, expense)] as ReportCell[]);

  // Saídas por centro de custo
  const byCc = new Map<string, number>();
  for (const l of expLines) byCc.set(l.ccName, (byCc.get(l.ccName) ?? 0) + l.value);
  const ccRows = [...byCc.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cc, val]) => [cc, val, fmtPct(val, expense)] as ReportCell[]);

  const tables: ReportTable[] = [];
  if (catRows.length) {
    tables.push({
      title: "Saídas por categoria",
      columns: [{ label: "Categoria" }, { label: "Valor", money: true, align: "right" }, { label: "%", align: "right" }],
      rows: catRows,
      total: ["Total", expense, ""],
    });
  }
  if (ccRows.length) {
    tables.push({
      title: "Saídas por centro de custo",
      columns: [{ label: "Centro de custo" }, { label: "Valor", money: true, align: "right" }, { label: "%", align: "right" }],
      rows: ccRows,
      total: ["Total", expense, ""],
    });
  }

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
        { label: "Data" },
        { label: "Origem" },
        { label: groupBy === "categoria" ? "Centro de custo" : "Categoria" },
        { label: "Valor", money: true, align: "right" as const },
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
    { label: "Vencimento" },
    { label: "Origem" },
    { label: "Categoria" },
    { label: "Status" },
    { label: "Valor", money: true, align: "right" },
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
  receipts: Receipt[],
  ctx: ReportContext,
): ReportDoc {
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
