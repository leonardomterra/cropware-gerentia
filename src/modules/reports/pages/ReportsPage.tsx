import { useMemo, useState } from "react";
import { toast } from "sonner";
import Download from "~icons/material-symbols-light/download";
import Print from "~icons/material-symbols-light/print-outline";
import ChevronDown from "~icons/material-symbols-light/keyboard-arrow-down";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { TOOLBAR_TRIGGER_CLASS } from "@/components/ui/toolbarTrigger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import {
  CostCenterChip,
  AllCentersChip,
  ccTextColor,
} from "@/modules/cost-centers/ccIcons";
import {
  MonthSwitcher,
  currentYearMonth,
  monthLabel,
  monthRangeISO,
  type YearMonth,
} from "@/modules/receipts/components/MonthSwitcher";
import { useReceipts } from "@/modules/receipts/hooks/useReceipts";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import { useIsMobile } from "@/components/ui/use-mobile";
import { formatBRL } from "@/modules/receipts/utils/receiptFormatters";
import {
  buildReport,
  REPORT_OPTIONS,
  type DirectionFilter,
  type ReportCell,
  type ReportColumn,
  type ReportDoc,
  type ReportKind,
  type ReportTable,
} from "../reportBuilders";
import { downloadReportCsv, openReportPage } from "../reportExport";
import { reportToPdf } from "../reportPdf";
import { attachmentsToPagesHtml } from "../reportAttachments";
import { apiGetArrayBuffer } from "@/utils/api";
import { exportFile } from "@/utils/nativeExport";
import { isNativeCapacitorApp } from "@/utils/platform";

function cellText(v: ReportCell, col: ReportColumn): string {
  if (col.money && typeof v === "number" && Number.isFinite(v)) return formatBRL(v);
  if (col.money && (v === "" || v == null)) return "";
  return String(v ?? "");
}

function ReportTableView({ table }: { table: ReportTable }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {table.title && (
        <div className="px-4 py-2.5 border-b border-slate-200 text-sm font-medium text-slate-700">
          {table.title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {table.columns.map((c, i) => (
                <th
                  key={i}
                  className={cn(
                    "py-2.5 px-4 font-medium text-slate-500 text-xs uppercase tracking-wide whitespace-nowrap",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-b-0">
                {row.map((v, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "py-2 px-4 text-slate-700 whitespace-nowrap",
                      table.columns[ci].align === "right" && "text-right tabular-nums",
                    )}
                  >
                    {cellText(v, table.columns[ci])}
                  </td>
                ))}
              </tr>
            ))}
            {table.total && (
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                {table.total.map((v, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "py-2 px-4 font-semibold text-slate-900 whitespace-nowrap",
                      table.columns[ci].align === "right" && "text-right tabular-nums",
                    )}
                  >
                    {cellText(v, table.columns[ci])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Detecta as tabelas de participação (Categoria | Valor | %). */
function isPctTable(t: ReportTable): boolean {
  return t.columns.length === 3 && t.columns[2].label === "%";
}

/** Tabela de transações (tem coluna "Origem" + uma coluna monetária). */
function isTxTable(t: ReportTable): boolean {
  return (
    t.columns.some((c) => c.label === "Origem") &&
    t.columns.some((c) => c.money)
  );
}

/**
 * Versão mobile das tabelas de transação (por categoria/centro, a pagar/receber):
 * cada linha vira um item compacto — Origem + valor em cima, o resto (data,
 * categoria/centro, status) como subtítulo. Não corta nem exige rolar de lado.
 */
function ReportRowsList({ table }: { table: ReportTable }) {
  const iVal = table.columns.findIndex((c) => c.money);
  const iOrigem = table.columns.findIndex((c) => c.label === "Origem");
  const totalValue =
    table.total && iVal >= 0 && typeof table.total[iVal] === "number"
      ? (table.total[iVal] as number)
      : undefined;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {table.title && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <span className="text-sm font-medium text-slate-700">
            {table.title}
          </span>
          {totalValue != null && (
            <span className="text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">
              {formatBRL(totalValue)}
            </span>
          )}
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {table.rows.map((row, i) => {
          const origem = iOrigem >= 0 ? String(row[iOrigem] ?? "") : "";
          const value =
            iVal >= 0 && typeof row[iVal] === "number"
              ? (row[iVal] as number)
              : 0;
          const sub = row
            .map((cell, k) =>
              k === iVal || k === iOrigem ? null : String(cell ?? "").trim(),
            )
            .filter(Boolean)
            .join(" · ");
          return (
            <div key={i} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-slate-800">
                  {origem || "—"}
                </span>
                <span className="text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">
                  {formatBRL(value)}
                </span>
              </div>
              {sub ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Lista com barra de proporção — substitui a tabela apertada nos detalhamentos
 * "por categoria/centro" (Entradas/Saídas). Cada linha: nome + valor por extenso
 * e uma barra fina com o % de participação. Lê bem no mobile e não corta nada.
 */
function ReportPctList({ table }: { table: ReportTable }) {
  const totalValue =
    typeof table.total?.[1] === "number"
      ? (table.total[1] as number)
      : table.rows.reduce(
          (s, r) => s + (typeof r[1] === "number" ? r[1] : 0),
          0,
        );
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {table.title && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <span className="text-sm font-medium text-slate-700">
            {table.title}
          </span>
          {typeof table.total?.[1] === "number" && (
            <span className="text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">
              {formatBRL(table.total[1] as number)}
            </span>
          )}
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {table.rows.map((row, i) => {
          const name = String(row[0] ?? "");
          const value = typeof row[1] === "number" ? row[1] : 0;
          const pctLabel = String(row[2] ?? "");
          const share =
            totalValue > 0 ? Math.min(100, (value / totalValue) * 100) : 0;
          return (
            <div key={i} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-slate-700">{name}</span>
                <span className="text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">
                  {formatBRL(value)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-400"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-base tabular-nums text-slate-500">
                  {pctLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const userCCs = user?.costCenters ?? [];
  const { categories } = useCategories();
  const isMobile = useIsMobile();

  const [kind, setKind] = useState<ReportKind>("resumo");
  const [month, setMonth] = useState<YearMonth>(currentYearMonth);
  const [activeCCId, setActiveCCId] = useState<string>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");

  const range = useMemo(() => monthRangeISO(month), [month]);
  const { receipts, loading, error } = useReceipts({
    from: range.from,
    to: range.to,
    ...(activeCCId !== "all" ? { cost_center_id: activeCCId } : {}),
  });

  const showDirection = kind === "categoria" || kind === "centro";

  const doc: ReportDoc = useMemo(() => {
    const ccNameById = new Map(userCCs.map((c) => [c.id, c.name] as const));
    const ccLabel =
      activeCCId === "all"
        ? "Todos os centros"
        : userCCs.find((c) => c.id === activeCCId)?.name || "Centro";
    return buildReport(kind, receipts, {
      categories,
      ccNameById,
      periodLabel: monthLabel(month),
      ccLabel,
      direction: showDirection ? direction : "all",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, receipts, categories, userCCs, activeCCId, month, direction, showDirection]);

  const csvName = `relatorio_${kind}_${month.year}-${String(month.month).padStart(2, "0")}.csv`;
  const noData = doc.empty;

  const activeCC = userCCs.find((c) => c.id === activeCCId);
  const [printing, setPrinting] = useState(false);

  // Gera o relatório (com/sem anexos). No app nativo (iOS/Android) o WKWebView não
  // abre aba de impressão — então gera um PDF real (pdf-lib) e abre a folha de
  // compartilhamento. No web mantém a página HTML (abre em aba com botão imprimir).
  const runPrint = async (withAttachments: boolean) => {
    const native = isNativeCapacitorApp();
    const docs = withAttachments ? receipts.filter((r) => !!r.attachment_key) : [];
    setPrinting(true);
    const toastId = toast.loading(
      withAttachments && docs.length
        ? `Gerando relatório + ${docs.length} anexo${docs.length === 1 ? "" : "s"}…`
        : "Gerando relatório…",
    );
    try {
      const items = docs.length
        ? await Promise.all(
            docs.map(async (r) => ({
              receipt: r,
              bytes: await apiGetArrayBuffer(`/receipts/${r.id}/attachment`),
            })),
          )
        : [];
      let failed = 0;
      if (native) {
        const res = await reportToPdf(doc, items);
        failed = res.failed;
        const name = `relatorio_${kind}_${month.year}-${String(month.month).padStart(2, "0")}.pdf`;
        await exportFile(name, res.blob, "application/pdf");
      } else {
        const att = items.length
          ? await attachmentsToPagesHtml(items)
          : { html: "", failed: 0 };
        failed = att.failed;
        // Abre em nova aba ou, se o popup for bloqueado, baixa o arquivo.
        await openReportPage(doc, att.html);
      }
      if (failed > 0) {
        toast.warning(`${failed} anexo(s) não puderam ser incluídos.`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch {
      toast.error("Erro ao gerar o relatório.", { id: toastId });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-medium text-slate-900">Relatórios</h1>
      </div>

      {/* Controles — ocupam a largura: filtros flex-1, ações à direita. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Select value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
          <SelectTrigger className="w-full lg:flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <MonthSwitcher
          value={month}
          onChange={setMonth}
          variant="picker"
          className="w-full lg:flex-1"
        />

        {showDirection && (
          <Select value={direction} onValueChange={(v) => setDirection(v as DirectionFilter)}>
            <SelectTrigger className="w-full lg:flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tudo</SelectItem>
              <SelectItem value="expense">Só saídas</SelectItem>
              <SelectItem value="income">Só entradas</SelectItem>
            </SelectContent>
          </Select>
        )}

        {userCCs.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(TOOLBAR_TRIGGER_CLASS, "w-full lg:flex-1")}
              >
                {activeCC ? (
                  <CostCenterChip icon={activeCC.icon} color={activeCC.color} className="size-6" />
                ) : (
                  <AllCentersChip className="size-6" />
                )}
                <span
                  className="flex-1 text-left truncate"
                  style={activeCC ? { color: ccTextColor(activeCC.color) } : undefined}
                >
                  {activeCC ? (
                    activeCC.name
                  ) : (
                    <>
                      <span className="sm:hidden">Centros</span>
                      <span className="hidden sm:inline">Todos os Centros</span>
                    </>
                  )}
                </span>
                <ChevronDown className="size-4 text-slate-500 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              <DropdownMenuItem
                onClick={() => setActiveCCId("all")}
                className={activeCCId === "all" ? "bg-slate-100 font-medium gap-2" : "gap-2"}
              >
                <AllCentersChip className="size-6" />
                <span>Todos os Centros</span>
              </DropdownMenuItem>
              {userCCs.map((cc) => (
                <DropdownMenuItem
                  key={cc.id}
                  onClick={() => setActiveCCId(cc.id)}
                  className={activeCCId === cc.id ? "bg-slate-100 font-medium gap-2" : "gap-2"}
                >
                  <CostCenterChip icon={cc.icon} color={cc.color} className="size-6" />
                  <span style={{ color: ccTextColor(cc.color) }}>{cc.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex gap-2 lg:shrink-0">
          <Button
            variant="outline"
            className="gap-1.5 flex-1 lg:flex-none"
            disabled={noData}
            onClick={() => downloadReportCsv(doc, csvName)}
          >
            <Download className="size-4" />
            <span className="sm:hidden">CSV</span>
            <span className="hidden sm:inline">Baixar CSV</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-1.5 flex-1 lg:flex-none"
                disabled={noData || printing}
              >
                <Print className="size-4" />
                {printing ? (
                  "Gerando…"
                ) : (
                  <>
                    <span className="sm:hidden">Imprimir</span>
                    <span className="hidden sm:inline">Imprimir / PDF</span>
                  </>
                )}
                <ChevronDown className="size-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[11rem] rounded-2xl border-zinc-800 bg-zinc-900 p-1.5 text-white shadow-lg"
            >
              <DropdownMenuItem
                onClick={() => runPrint(false)}
                className="rounded-xl px-3 py-2.5 text-zinc-100 focus:bg-white/10 focus:text-white"
              >
                Sem anexos
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => runPrint(true)}
                className="rounded-xl px-3 py-2.5 text-zinc-100 focus:bg-white/10 focus:text-white"
              >
                Com anexos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {/* KPIs do relatório */}
      {doc.meta.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {doc.meta.map((m, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 min-w-0">
              <p className="text-sm text-slate-500 truncate">{m.label}</p>
              <p
                className={cn(
                  "text-lg font-semibold mt-0.5 tabular-nums truncate",
                  m.tone === "in" && "text-emerald-700",
                  m.tone === "muted" && "text-slate-600",
                  (!m.tone || m.tone === "out") && "text-slate-900",
                )}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabelas */}
      {noData ? (
        loading ? (
          <LoadingState />
        ) : (
          <EmptyStateCard title="Sem dados para este período" />
        )
      ) : (
        <div className="space-y-4">
          {doc.tables.map((t, i) =>
            isPctTable(t) ? (
              <ReportPctList key={i} table={t} />
            ) : isMobile && isTxTable(t) ? (
              <ReportRowsList key={i} table={t} />
            ) : (
              <ReportTableView key={i} table={t} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
