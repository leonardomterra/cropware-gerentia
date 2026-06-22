import { useMemo, useState } from "react";
import { toast } from "sonner";
import Download from "~icons/material-symbols-light/download";
import Print from "~icons/material-symbols-light/print-outline";
import ChevronDown from "~icons/material-symbols-light/keyboard-arrow-down";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
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
import { downloadReportCsv, openReportPage, reportPageHtml } from "../reportExport";
import { attachmentsToPagesHtml } from "../reportAttachments";
import { apiGetArrayBuffer } from "@/utils/api";

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
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-slate-200">
              {table.columns.map((c, i) => (
                <th
                  key={i}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    "py-2.5 px-4 font-medium text-slate-500 text-xs uppercase tracking-wide truncate",
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
                      "py-2 px-4 text-slate-700 truncate",
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
                      "py-2 px-4 font-semibold text-slate-900 truncate",
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

export default function ReportsPage() {
  const { user } = useAuth();
  const userCCs = user?.costCenters ?? [];
  const { categories } = useCategories();

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

  // Com anexos: mesma página do "sem anexos", com os arquivos (PDFs rasterizados
  // + imagens) embutidos como páginas logo após o relatório. A janela é aberta no
  // clique (gesto) e preenchida após montar os anexos.
  const handlePrintWithAttachments = async () => {
    const docs = receipts.filter((r) => !!r.attachment_key);
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Permita pop-ups para gerar o PDF.");
      return;
    }
    win.document.write(
      "<p style='font-family:sans-serif;color:#475569;padding:24px'>Gerando relatório…</p>",
    );
    setPrinting(true);
    const toastId = toast.loading(
      docs.length
        ? `Gerando relatório + ${docs.length} anexo${docs.length === 1 ? "" : "s"}…`
        : "Gerando relatório…",
    );
    try {
      const items = await Promise.all(
        docs.map(async (r) => ({
          receipt: r,
          bytes: await apiGetArrayBuffer(`/receipts/${r.id}/attachment`),
        })),
      );
      const { html: attHtml, failed } = await attachmentsToPagesHtml(items);
      if (win) {
        win.document.open();
        win.document.write(reportPageHtml(doc, attHtml));
        win.document.close();
        win.focus();
      }
      if (failed > 0) {
        toast.warning(`${failed} anexo(s) não puderam ser incluídos.`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch {
      win?.close();
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
                className="h-9 w-full lg:flex-1 inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openReportPage(doc)}>
                Sem anexos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintWithAttachments}>
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
          {doc.tables.map((t, i) => (
            <ReportTableView key={i} table={t} />
          ))}
        </div>
      )}
    </div>
  );
}
