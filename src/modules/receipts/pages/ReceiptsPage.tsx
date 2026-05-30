import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Camera,
  ChevronDown,
  ClockArrowDown,
  ClockArrowUp,
  FileText,
  Loader2,
  Plus,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
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
import { ReceiptFiltersBar } from "../components/ReceiptFiltersBar";
import { ReceiptsTable } from "../components/ReceiptsTable";
import { ReceiptsCards } from "../components/ReceiptsCards";
import { ReceiptFormDialog } from "../components/ReceiptFormDialog";
import { ReceiptCaptureDialog } from "../components/ReceiptCaptureDialog";
import { deleteReceipt, useReceipts } from "../hooks/useReceipts";
import type { ScanResult } from "../hooks/useReceiptScanner";
import type {
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
  };
  attachment_key: string;
  attachment_mime: string;
  ai_confidence?: number | null;
  ai_raw?: unknown;
}

function scanToPrefill(scan: ScanResult): PrefillFromScan {
  const e = scan.extracted;
  const direction: ReceiptDirection = e?.direction ?? "expense";
  const defaultStatus = STATUSES_BY_DIRECTION[direction][0];

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
    },
  };
}

export default function ReceiptsPage() {
  const { user } = useAuth();
  const userCCs = user?.costCenters ?? [];
  const showTabs = userCCs.length > 1;

  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [activeCCId, setActiveCCId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "recent" | "old" | "value_desc" | "value_asc"
  >("recent");
  const [formOpen, setFormOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editing, setEditing] = useState<Receipt | null>(null);
  const [prefill, setPrefill] = useState<PrefillFromScan | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const effectiveFilters: ReceiptFilters = activeCCId !== "all"
    ? { ...filters, cost_center_id: activeCCId }
    : filters;

  const { receipts, loading, error, refetch } = useReceipts(effectiveFilters);
  const isMobile = useIsMobile();
  // Loading inicial = sem dados em tela ainda. Refetch = trocou filtro
  // com dados ja exibidos - dimm sutil em vez de trocar pelo card grande.
  const isInitialLoad = loading && receipts.length === 0 && !error;
  const isRefetching = loading && receipts.length > 0;

  // Sort client-side. Default 'recent' usa paid_date || transaction_date
  // (mais recente primeiro). Tie-break por created order do array.
  const sortedReceipts = useMemo(() => {
    const arr = [...receipts];
    const dateOf = (r: Receipt) => r.paid_date || r.transaction_date || "";
    switch (sortBy) {
      case "recent":
        return arr.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
      case "old":
        return arr.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
      case "value_desc":
        return arr.sort(
          (a, b) => Number(b.total_value) - Number(a.total_value),
        );
      case "value_asc":
        return arr.sort(
          (a, b) => Number(a.total_value) - Number(b.total_value),
        );
    }
  }, [receipts, sortBy]);

  const totalExpenses = receipts
    .filter((r) => r.direction === "expense")
    .reduce((sum, r) => sum + Number(r.total_value), 0);
  const totalIncome = receipts
    .filter((r) => r.direction === "income")
    .reduce((sum, r) => sum + Number(r.total_value), 0);

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
      "data", "tipo", "valor", "categoria", "fornecedor",
      "documento", "pagamento", "status", "vencimento", "pago em",
      "centro de custo", "descricao", "observacoes",
    ];
    const rows = receipts.map((r) => [
      r.transaction_date || "",
      r.direction === "income" ? "receita" : "despesa",
      Number(r.total_value).toFixed(2).replace(".", ","),
      r.category || "",
      r.vendor || "",
      r.invoice_number || "",
      r.payment_method || "",
      r.status,
      r.due_date || "",
      r.paid_date || "",
      ccName(r.cost_center_id),
      r.description || "",
      r.notes || "",
    ]);
    const csv = rowsToCsv(headers, rows);
    const today = todayISO();
    const tag = activeCCId !== "all" ? `_${(userCCs.find((c) => c.id === activeCCId)?.name || "cc").replace(/\s+/g, "-").toLowerCase()}` : "";
    downloadCsv(`lancamentos${tag}_${today}.csv`, csv);
    toast.success(`${receipts.length} lançamento(s) exportado(s)`);
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
      console.error("[ReceiptsPage] delete failed:", err);
      toast.error("Erro ao excluir. Tente de novo.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Filtros logo abaixo do breadcrumb. CC dropdown + sort dropdown
          vao pro slot 'trailing' (mesma row dos campos, alinhados a direita). */}
      <div className="mb-3">
        <ReceiptFiltersBar
          value={filters}
          onChange={setFilters}
          trailing={
            <>
              {showTabs && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-9 w-[180px] inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                    >
                      {activeCCId !== "all" && (
                        <span
                          className="size-2 rounded-full inline-block shrink-0"
                          style={{
                            backgroundColor:
                              userCCs.find((c) => c.id === activeCCId)
                                ?.color || "#64748b",
                          }}
                        />
                      )}
                      <span className="flex-1 text-left truncate">
                        {activeCCId === "all"
                          ? "Todos os Centros"
                          : userCCs.find((c) => c.id === activeCCId)?.name ||
                            "Centro"}
                      </span>
                      <ChevronDown className="size-4 text-slate-500 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <DropdownMenuItem
                      onClick={() => setActiveCCId("all")}
                      className={
                        activeCCId === "all"
                          ? "bg-slate-100 font-medium gap-2"
                          : "gap-2"
                      }
                    >
                      Todos os Centros
                    </DropdownMenuItem>
                    {userCCs.map((cc) => (
                      <DropdownMenuItem
                        key={cc.id}
                        onClick={() => setActiveCCId(cc.id)}
                        className={
                          activeCCId === cc.id
                            ? "bg-slate-100 font-medium gap-2"
                            : "gap-2"
                        }
                      >
                        <span
                          className="size-2 rounded-full inline-block shrink-0"
                          style={{
                            backgroundColor: cc.color || "#64748b",
                          }}
                        />
                        {cc.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Botao de ordenacao - padrao CDM PlotManagement */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-9 w-[160px] inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                  >
                    {sortBy === "recent" && (
                      <ClockArrowDown className="size-4 shrink-0" />
                    )}
                    {sortBy === "old" && (
                      <ClockArrowUp className="size-4 shrink-0" />
                    )}
                    {sortBy === "value_desc" && (
                      <ArrowDownNarrowWide className="size-4 shrink-0" />
                    )}
                    {sortBy === "value_asc" && (
                      <ArrowUpNarrowWide className="size-4 shrink-0" />
                    )}
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
                    className={
                      sortBy === "recent"
                        ? "bg-slate-100 font-medium gap-2"
                        : "gap-2"
                    }
                  >
                    <ClockArrowDown className="size-4" />
                    Mais recentes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("old")}
                    className={
                      sortBy === "old"
                        ? "bg-slate-100 font-medium gap-2"
                        : "gap-2"
                    }
                  >
                    <ClockArrowUp className="size-4" />
                    Mais antigos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("value_desc")}
                    className={
                      sortBy === "value_desc"
                        ? "bg-slate-100 font-medium gap-2"
                        : "gap-2"
                    }
                  >
                    <ArrowDownNarrowWide className="size-4" />
                    Maior valor
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("value_asc")}
                    className={
                      sortBy === "value_asc"
                        ? "bg-slate-100 font-medium gap-2"
                        : "gap-2"
                    }
                  >
                    <ArrowUpNarrowWide className="size-4" />
                    Menor valor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
      </div>

      {/* Action row - estilo CDM PlotManagement: outline + icone leading.
          Novo Lancamento + Capturar Recibo sao botoes; Exportar e' dropdown
          (preparado pra varios formatos: CSV agora, Excel/PDF depois). */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Button variant="outline" onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          Novo Lançamento
        </Button>
        <Button
          variant="outline"
          onClick={() => setCaptureOpen(true)}
          className="gap-1"
        >
          <Camera className="size-4" />
          Capturar Recibo
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={receipts.length === 0}
              className="gap-1"
            >
              Exportar
              <ChevronDown className="size-4 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[180px]">
            <DropdownMenuItem
              onClick={handleExportCsv}
              className="gap-2"
              title="Lançamentos filtrados em CSV (abre no Excel)"
            >
              <FileText className="size-4" />
              CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Estados:
          - error: error card (sempre)
          - isInitialLoad (loading + sem dados): big "Carregando..."
          - isRefetching (loading + ja tem dados): mantem tabela visivel,
            dim sutil + spinner inline ao lado de "Mostrando N" (evita
            piscar de layout ao trocar de CC/filtro).
          - empty (sem loading, sem dados): empty state
          - data: tabela */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      ) : isInitialLoad ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <div
          className={cn(
            "transition-opacity duration-200",
            isRefetching && "opacity-50 pointer-events-none",
          )}
        >
          {/* KPIs do resultado filtrado */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-sm text-slate-500">Entradas</p>
              <p className="text-base font-medium text-emerald-700 tabular-nums">
                {formatBRL(totalIncome)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-sm text-slate-500">Saídas</p>
              <p className="text-base font-medium text-slate-900 tabular-nums">
                {formatBRL(totalExpenses)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 col-span-2 sm:col-span-1">
              <p className="text-sm text-slate-500">Saldo</p>
              <p className="text-base font-medium text-farm-primary tabular-nums">
                {formatBRL(totalIncome - totalExpenses)}
              </p>
            </div>
          </div>

          {receipts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 flex flex-col items-center text-center gap-3">
              <ReceiptIcon className="size-10 text-slate-300" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Nenhum lançamento ainda
                </p>
                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                  Adiciona seu primeiro pelo botão "Novo Lançamento" ou
                  tira foto de um recibo em "Capturar Recibo".
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-2 px-1 inline-flex items-center gap-2">
                Mostrando {receipts.length}{" "}
                {receipts.length === 1 ? "lançamento" : "lançamentos"}
                {isRefetching ? (
                  <Loader2 className="size-3 animate-spin text-slate-400" />
                ) : null}
              </p>
              {isMobile ? (
                <ReceiptsCards
                  receipts={sortedReceipts}
                  onEdit={openEdit}
                  onDelete={(r) => setPendingDelete(r)}
                />
              ) : (
                <ReceiptsTable
                  receipts={sortedReceipts}
                  onEdit={openEdit}
                  onDelete={(r) => setPendingDelete(r)}
                />
              )}
            </>
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
        onSaved={() => {
          void refetch();
        }}
      />

      <ReceiptCaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onScanComplete={handleScanComplete}
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
    </div>
  );
}
