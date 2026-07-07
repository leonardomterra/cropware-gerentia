import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import ArrowDownNarrowWide from "~icons/material-symbols-light/arrow-downward";
import ArrowUpNarrowWide from "~icons/material-symbols-light/arrow-upward";
import Camera from "~icons/material-symbols-light/photo-camera-outline";
import Download from "~icons/material-symbols-light/download";
import ChevronDown from "~icons/material-symbols-light/keyboard-arrow-down";
import ClockArrowDown from "~icons/material-symbols-light/vertical-align-bottom";
import ClockArrowUp from "~icons/material-symbols-light/vertical-align-top";
import FileText from "~icons/material-symbols-light/description-outline";
import Loader2 from "~icons/svg-spinners/ring-resize";
import Plus from "~icons/material-symbols-light/add";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import Print from "~icons/material-symbols-light/print-outline";
import { cn } from "@/components/ui/utils";
import { apiGetArrayBuffer } from "@/utils/api";
import { mergeAttachmentsToPdf, pdfViewerHtml } from "../utils/mergeAttachmentsPdf";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/components/ui/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { AllCentersChip, CostCenterChip, ccTextColor } from "@/modules/cost-centers/ccIcons";
import { TOOLBAR_TRIGGER_CLASS } from "@/components/ui/toolbarTrigger";
import { ReceiptFiltersBar } from "./ReceiptFiltersBar";
import { ReceiptsTable } from "./ReceiptsTable";
import { ReceiptsCards } from "./ReceiptsCards";
import { ReceiptFormDialog } from "./ReceiptFormDialog";
import { ReceiptCaptureDialog } from "./ReceiptCaptureDialog";
import { ReceiptViewDialog } from "./ReceiptViewDialog";
import { AttachmentViewerDialog } from "./AttachmentViewerDialog";
import {
  MonthSwitcher,
  currentYearMonth,
  monthRangeISO,
  type YearMonth,
} from "./MonthSwitcher";
import { deleteReceipt, useReceipts } from "../hooks/useReceipts";
import type { ScanResult } from "../hooks/useReceiptScanner";
import type {
  ItemRow,
  Receipt,
  ReceiptDirection,
  ReceiptDocType,
  ReceiptFilters,
  ReceiptPaymentMethod,
  ReceiptStatus,
} from "../types";
import { formatBRL, todayISO } from "../utils/receiptFormatters";
import { STATUSES_BY_DIRECTION } from "../constants";
import { downloadCsv, rowsToCsv } from "@/utils/csv";
import { exportFile } from "@/utils/nativeExport";
import { isNativeCapacitorApp } from "@/utils/platform";
import { receiptLines } from "../utils/receiptLines";

interface PrefillFromScan {
  values: {
    direction?: ReceiptDirection;
    doc_type?: ReceiptDocType;
    status?: ReceiptStatus;
    total_value?: string;
    vendor?: string;
    category?: string;
    description?: string;
    payment_method?: ReceiptPaymentMethod | "";
    transaction_date?: string;
    invoice_number?: string;
    items?: ItemRow[];
  };
  attachment_key: string;
  attachment_mime: string;
  ai_confidence?: number | null;
  ai_raw?: unknown;
}

export interface ReceiptsListPageProps {
  /** Filtro client-side (ex.: só faturas, ou só itemizados). Default: tudo.
   *  IMPORTANTE: passar uma referência estável (constante de módulo). */
  docFilter?: (r: Receipt) => boolean;
  /** create/edit usa o editor de itens (páginas Notas e Recibos / Faturas). */
  itemized?: boolean;
  /** doc_type semeado ao criar (ex.: "fatura"). */
  defaultDocType?: ReceiptDocType;
  /** Mostra o botão "Capturar Recibo". Default true. */
  showCapture?: boolean;
  /** Mostra o botão de criar lançamento. Default true. */
  showCreate?: boolean;
  /** Só a ação "Ver detalhes" nas linhas (sem editar/excluir/descrição). */
  viewOnly?: boolean;
  /** Rótulo do botão de criar. Default "Novo Lançamento". */
  createLabel?: string;
  /** Rótulo curto do botão de criar (mobile). Default "Novo". */
  createLabelShort?: string;
  /** Texto quando não há registros. */
  emptyLabel?: string;
  /** Substantivo da contagem ("Mostrando N ___"). Default lançamento(s). */
  countNoun?: { one: string; many: string };
  /** Títulos do dialog de criar/editar (por aba). */
  titleNew?: string;
  titleEdit?: string;
}

// Numero -> string p/ os inputs do form (vírgula decimal). "" se nulo/invalido.
function numToInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(n).replace(".", ",");
}

function scanToPrefill(scan: ScanResult): PrefillFromScan {
  const e = scan.extracted;
  const direction: ReceiptDirection = e?.direction ?? "expense";
  const defaultStatus = STATUSES_BY_DIRECTION[direction][0];

  // Itens da IA: só itemiza com 2+ itens válidos (1 item = header-only).
  const mappedItems: ItemRow[] = (e?.line_items ?? [])
    .filter((li) => li && Number.isFinite(li.total_value))
    .map((li) => ({
      key: crypto.randomUUID(),
      description: li.description ?? "",
      quantity: numToInput(li.quantity),
      unit_value: numToInput(li.unit_value),
      total_value: numToInput(li.total_value),
      category: li.category ?? "",
      cost_center_id: "",
    }));
  const items: ItemRow[] = mappedItems.length >= 2 ? mappedItems : [];

  return {
    attachment_key: scan.attachment_key,
    attachment_mime: scan.attachment_mime,
    ai_confidence: e?.confidence ?? null,
    ai_raw: e,
    values: {
      direction,
      doc_type: e?.doc_type ?? "cupom",
      status: defaultStatus,
      total_value:
        e?.total_value != null
          ? String(e.total_value).replace(".", ",")
          : "",
      vendor: e?.vendor ?? "",
      category: e?.category ?? "",
      description: e?.description ?? "",
      payment_method: e?.payment_method ?? "",
      transaction_date: e?.transaction_date ?? todayISO(),
      invoice_number: e?.invoice_number ?? "",
      items,
    },
  };
}

export function ReceiptsListPage({
  docFilter,
  itemized = false,
  defaultDocType,
  showCapture = true,
  showCreate = true,
  viewOnly = false,
  createLabel = "Novo Lançamento",
  createLabelShort = "Novo",
  emptyLabel = "Sem lançamentos",
  countNoun = { one: "lançamento", many: "lançamentos" },
  titleNew,
  titleEdit,
}: ReceiptsListPageProps) {
  const { user } = useAuth();
  const userCCs = user?.costCenters ?? [];
  const showTabs = userCCs.length > 1;

  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [month, setMonth] = useState<YearMonth>(currentYearMonth);
  const [activeCCId, setActiveCCId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "recent" | "old" | "value_desc" | "value_asc"
  >("recent");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<Receipt | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<Receipt | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editing, setEditing] = useState<Receipt | null>(null);
  const [prefill, setPrefill] = useState<PrefillFromScan | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Mês é o escopo primário de data: define from/to (transaction_date).
  const monthRange = useMemo(() => monthRangeISO(month), [month]);
  const effectiveFilters: ReceiptFilters = {
    ...filters,
    ...(activeCCId !== "all" ? { cost_center_id: activeCCId } : {}),
    from: monthRange.from,
    to: monthRange.to,
  };

  const { receipts: allReceipts, loading, error, refetch } =
    useReceipts(effectiveFilters);
  const isMobile = useIsMobile();

  // Filtro client-side por doc_type/itens (páginas dedicadas).
  const receipts = useMemo(
    () => (docFilter ? allReceipts.filter(docFilter) : allReceipts),
    [allReceipts, docFilter],
  );

  // Refetch = ja tinha dados em tela e esta recarregando (troca de mes/filtro).
  const isRefetching = loading && receipts.length > 0;

  // Sort client-side. Default 'recent' usa paid_date || transaction_date.
  const sortedReceipts = useMemo(() => {
    const arr = [...receipts];
    const dateOf = (r: Receipt) => r.paid_date || r.transaction_date || "";
    switch (sortBy) {
      case "recent":
        return arr.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
      case "old":
        return arr.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
      case "value_desc":
        return arr.sort((a, b) => Number(b.total_value) - Number(a.total_value));
      case "value_asc":
        return arr.sort((a, b) => Number(a.total_value) - Number(b.total_value));
      default:
        return arr;
    }
  }, [receipts, sortBy]);

  // Lançamento itemizado criado a partir de scan multi-item precisa do editor
  // de itens mesmo em Lançamentos (allowItems=false por padrão).
  const formAllowItems =
    itemized || (!editing && (prefill?.values.items?.length ?? 0) >= 2);

  const openCreate = () => {
    setEditing(null);
    setPrefill(null);
    setFormOpen(true);
  };

  const openEdit = (r: Receipt) => {
    setEditing(r);
    setPrefill(null);
    setFormOpen(true);
  };

  // Em viewOnly (aba Anexos) o "olho" abre direto o arquivo; senão, os detalhes.
  const openView = (r: Receipt) =>
    viewOnly ? setViewingAttachment(r) : setViewing(r);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = receipts.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        receipts.forEach((r) => next.delete(r.id));
      } else {
        receipts.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const [printing, setPrinting] = useState(false);
  // Junta os anexos selecionados (PDFs + imagens) num PDF único e abre numa nova
  // aba pra visualizar/imprimir/salvar. A janela é aberta no clique (gesto do
  // usuário) pra escapar do bloqueador de pop-up; o conteúdo entra após o merge.
  const handlePrintSelected = async () => {
    const chosen = sortedReceipts.filter(
      (r) => selectedIds.has(r.id) && r.attachment_key,
    );
    if (chosen.length === 0) {
      toast.error("Nenhum anexo selecionado.");
      return;
    }
    const native = isNativeCapacitorApp();
    // Web: abre a aba já no gesto do clique (escapa do bloqueador de pop-up); o
    // conteúdo entra após o merge. No nativo não há aba — compartilha o PDF.
    const win = native ? null : window.open("", "_blank");
    if (win) {
      win.document.write(
        "<p style='font-family:sans-serif;color:#475569;padding:24px'>Gerando PDF…</p>",
      );
    }
    setPrinting(true);
    const toastId = toast.loading(
      `Gerando PDF de ${chosen.length} anexo${chosen.length === 1 ? "" : "s"}…`,
    );
    try {
      const items = await Promise.all(
        chosen.map(async (r) => {
          const bytes = await apiGetArrayBuffer(`/receipts/${r.id}/attachment`);
          return { receipt: r, bytes };
        }),
      );
      const { blob, failed } = await mergeAttachmentsToPdf(items);
      const filename = `anexos_${month.year}-${String(month.month).padStart(2, "0")}.pdf`;
      if (native) {
        // iOS/Android: grava e abre a folha de compartilhamento.
        await exportFile(filename, blob, "application/pdf");
      } else {
        const url = URL.createObjectURL(blob);
        if (win) {
          win.document.open();
          win.document.write(pdfViewerHtml(url, filename));
          win.document.close();
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
        }
        // Libera o blob depois (a aba/iframe já carregou) — evita vazamento.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      if (failed > 0) {
        toast.warning(
          `${failed} arquivo(s) não puderam ser incluídos.`,
          { id: toastId },
        );
      } else {
        toast.success("PDF gerado.", { id: toastId });
      }
    } catch {
      win?.close();
      toast.error("Erro ao gerar o PDF.", { id: toastId });
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, activeCCId]);

  // Deep-link "?open=<id>" (vindo do "Gerenciar itens" em Lançamentos): abre
  // direto o dialog de edição do lançamento quando ele estiver carregado.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    const found = receipts.find((r) => r.id === openId);
    if (!found) return;
    setEditing(found);
    setPrefill(null);
    setFormOpen(true);
    searchParams.delete("open");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, receipts]);

  const handleScanComplete = (scan: ScanResult) => {
    setEditing(null);
    setPrefill(scanToPrefill(scan));
    setFormOpen(true);
  };

  const handleExportCsv = () => {
    if (receipts.length === 0) return;
    const ccName = (id: string | null) =>
      id ? (userCCs.find((c) => c.id === id)?.name || "") : "";
    const headers = [
      "data", "tipo", "valor", "categoria", "centro de custo", "item",
      "origem", "documento", "pagamento", "status", "vencimento",
      "pago em", "descricao", "observacoes", "contabilizado",
    ];
    const rows: string[][] = [];
    for (const r of receipts) {
      for (const ln of receiptLines(r)) {
        rows.push([
          ln.date || "",
          r.direction === "income" ? "receita" : "despesa",
          ln.value.toFixed(2).replace(".", ","),
          ln.category || "",
          ccName(ln.cost_center_id),
          ln.item_description || "",
          r.vendor || "",
          r.invoice_number || "",
          r.payment_method || "",
          r.status,
          r.due_date || "",
          r.paid_date || "",
          r.description || "",
          r.notes || "",
          r.counts_in_total === false ? "nao" : "sim",
        ]);
      }
    }
    const csv = rowsToCsv(headers, rows);
    const today = todayISO();
    const tag = activeCCId !== "all" ? `_${(userCCs.find((c) => c.id === activeCCId)?.name || "cc").replace(/\s+/g, "-").toLowerCase()}` : "";
    downloadCsv(`lancamentos${tag}_${today}.csv`, csv);
    toast.success(`${rows.length} linha(s) exportada(s)`);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteReceipt(pendingDelete.id);
      setPendingDelete(null);
      await refetch();
      toast.success("Lançamento excluído");
    } catch (err) {
      console.error("[ReceiptsListPage] delete failed:", err);
      toast.error("Erro ao excluir. Tente de novo.");
    } finally {
      setDeleting(false);
    }
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteReceipt(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      setBulkOpen(false);
      clearSelection();
      await refetch();
      if (failed === 0) {
        toast.success(`${ids.length} ${ids.length === 1 ? "lançamento excluído" : "lançamentos excluídos"}`);
      } else {
        toast.error(`${failed} de ${ids.length} não foram excluídos. Tente de novo.`);
      }
    } catch (err) {
      console.error("[ReceiptsListPage] bulk delete failed:", err);
      toast.error("Erro ao excluir. Tente de novo.");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-3">
        <ReceiptFiltersBar value={filters} onChange={setFilters} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 lg:flex lg:flex-wrap lg:items-center">
        {showCreate && (
          <Button variant="outline" onClick={openCreate} className="gap-1.5 flex-1 min-w-0 lg:min-w-[150px]">
            <Plus className="size-4 shrink-0" />
            <span className="flex-1 text-left truncate sm:hidden">{createLabelShort}</span>
            <span className="flex-1 text-left truncate hidden sm:inline">{createLabel}</span>
          </Button>
        )}
        {showCapture && (
          <Button
            variant="outline"
            onClick={() => setCaptureOpen(true)}
            className="gap-1.5 flex-1 min-w-0 lg:min-w-[150px]"
          >
            <Camera className="size-4 shrink-0" />
            <span className="flex-1 text-left truncate sm:hidden">Capturar</span>
            <span className="flex-1 text-left truncate hidden sm:inline">Capturar Recibo</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={receipts.length === 0}
              className="gap-1.5 flex-1 min-w-0 lg:min-w-[150px]"
            >
              <Download className="size-4 text-slate-500 shrink-0" />
              <span className="flex-1 text-left truncate">Exportar</span>
              <ChevronDown className="size-4 text-slate-500 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[11rem] rounded-2xl border-zinc-800 bg-zinc-900 p-1.5 text-white shadow-lg"
          >
            <DropdownMenuItem
              onClick={handleExportCsv}
              className="gap-2 rounded-xl px-3 py-2.5 text-zinc-100 focus:bg-white/10 focus:text-white"
              title="Lançamentos filtrados em CSV (abre no Excel)"
            >
              <FileText className="size-4 text-zinc-400" />
              CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {showTabs && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(TOOLBAR_TRIGGER_CLASS, "flex-1 min-w-0 lg:min-w-[150px]")}
              >
                {activeCCId !== "all" ? (
                  <CostCenterChip
                    icon={userCCs.find((c) => c.id === activeCCId)?.icon}
                    color={userCCs.find((c) => c.id === activeCCId)?.color}
                    className="size-6"
                  />
                ) : (
                  <AllCentersChip className="size-6" />
                )}
                <span
                  className="flex-1 text-left truncate"
                  style={activeCCId !== "all" ? { color: ccTextColor(userCCs.find((c) => c.id === activeCCId)?.color) } : undefined}
                >
                  {activeCCId === "all" ? (
                    <>
                      <span className="sm:hidden">Centros</span>
                      <span className="hidden sm:inline">Todos os Centros</span>
                    </>
                  ) : (
                    userCCs.find((c) => c.id === activeCCId)?.name || "Centro"
                  )}
                </span>
                <ChevronDown className="size-4 text-slate-500 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(TOOLBAR_TRIGGER_CLASS, "flex-1")}
            >
              {sortBy === "recent" && <ClockArrowDown className="size-4 shrink-0" />}
              {sortBy === "old" && <ClockArrowUp className="size-4 shrink-0" />}
              {sortBy === "value_desc" && <ArrowDownNarrowWide className="size-4 shrink-0" />}
              {sortBy === "value_asc" && <ArrowUpNarrowWide className="size-4 shrink-0" />}
              <span className="flex-1 text-left truncate">
                {sortBy === "recent" && "Recentes"}
                {sortBy === "old" && "Antigos"}
                {sortBy === "value_desc" && "Maior valor"}
                {sortBy === "value_asc" && "Menor valor"}
              </span>
              <ChevronDown className="size-4 text-slate-500 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem
              onClick={() => setSortBy("recent")}
              className={sortBy === "recent" ? "bg-slate-100 font-medium gap-2" : "gap-2"}
            >
              <ClockArrowDown className="size-4" />
              Mais recentes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("old")}
              className={sortBy === "old" ? "bg-slate-100 font-medium gap-2" : "gap-2"}
            >
              <ClockArrowUp className="size-4" />
              Mais antigos
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("value_desc")}
              className={sortBy === "value_desc" ? "bg-slate-100 font-medium gap-2" : "gap-2"}
            >
              <ArrowDownNarrowWide className="size-4" />
              Maior valor
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("value_asc")}
              className={sortBy === "value_asc" ? "bg-slate-100 font-medium gap-2" : "gap-2"}
            >
              <ArrowUpNarrowWide className="size-4" />
              Menor valor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <MonthSwitcher
          value={month}
          onChange={setMonth}
          variant="picker"
          className="flex-1 min-w-0 lg:min-w-[150px]"
        />
      </div>

      {!error && (
        <div className="flex items-center justify-between mb-2 px-1 min-h-[28px]">
          <p className="text-sm text-slate-500 inline-flex items-center gap-2">
            {loading && receipts.length === 0
              ? "Carregando…"
              : receipts.length === 0
                ? emptyLabel
                : `Mostrando ${receipts.length} ${receipts.length === 1 ? countNoun.one : countNoun.many}`}
            {isRefetching ? <Loader2 className="size-3 text-slate-400" /> : null}
          </p>
          {selectedIds.size > 0 ? (
            <div className="inline-flex items-center gap-2 text-sm">
              <span className="text-slate-700">
                {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
              </span>
              {viewOnly ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrintSelected}
                  disabled={printing}
                  className="h-7 text-slate-700"
                >
                  <Print className="size-4 mr-1" />
                  {printing ? "Gerando…" : "Imprimir"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkOpen(true)}
                  className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="size-4 mr-1" />
                  Excluir
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={clearSelection}
                className="h-7 text-slate-600"
              >
                Limpar
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <MonthSwitcher
        value={month}
        onChange={setMonth}
        variant="chips"
        className="mb-3"
      />

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div
          className={cn(
            "transition-opacity duration-200",
            loading && "opacity-50 pointer-events-none",
          )}
        >
          {isMobile ? (
            <ReceiptsCards
              receipts={sortedReceipts}
              onView={openView}
              onEdit={openEdit}
              onDelete={(r) => setPendingDelete(r)}
              viewOnly={viewOnly}
              emptyLabel={emptyLabel}
            />
          ) : (
            <ReceiptsTable
              receipts={sortedReceipts}
              onView={openView}
              onEdit={openEdit}
              onDelete={(r) => setPendingDelete(r)}
              selectedIds={selectedIds}
              onToggleOne={toggleOne}
              onToggleAll={toggleAll}
              viewOnly={viewOnly}
              emptyLabel={emptyLabel}
            />
          )}
        </div>
      )}

      <ReceiptFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setPrefill(null);
            setEditing(null);
          }
        }}
        receipt={editing}
        prefill={prefill}
        allowItems={formAllowItems}
        defaultDocType={defaultDocType}
        titleNew={titleNew}
        titleEdit={titleEdit}
        onSaved={() => {
          void refetch();
        }}
      />

      {showCapture && (
        <ReceiptCaptureDialog
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          onScanComplete={handleScanComplete}
        />
      )}

      <ReceiptViewDialog
        receipt={viewing}
        open={viewing !== null}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
        onEdit={openEdit}
        onChanged={() => void refetch()}
      />

      <AttachmentViewerDialog
        receipt={viewingAttachment}
        open={viewingAttachment !== null}
        onOpenChange={(o) => {
          if (!o) setViewingAttachment(null);
        }}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.vendor || pendingDelete?.description}
              {" - "}
              {pendingDelete ? formatBRL(pendingDelete.total_value) : ""}.
              <br />
              Essa acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkOpen}
        onOpenChange={(o) => {
          if (!bulkDeleting) setBulkOpen(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedIds.size} {selectedIds.size === 1 ? "lançamento" : "lançamentos"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os lançamentos selecionados serão removidos permanentemente.
              <br />
              Essa acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Excluindo..." : `Excluir ${selectedIds.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
