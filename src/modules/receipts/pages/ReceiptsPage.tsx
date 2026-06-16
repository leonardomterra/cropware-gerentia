import { useEffect, useMemo, useState } from "react";
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
import { AllCentersChip, CostCenterChip, ccTextColor } from "@/modules/cost-centers/ccIcons";
import { ReceiptFiltersBar } from "../components/ReceiptFiltersBar";
import { ReceiptsTable } from "../components/ReceiptsTable";
import { ReceiptsCards } from "../components/ReceiptsCards";
import {
  ReceiptFormDialog,
  type ItemRow,
} from "../components/ReceiptFormDialog";
import { ReceiptCaptureDialog } from "../components/ReceiptCaptureDialog";
import { ReceiptViewDialog } from "../components/ReceiptViewDialog";
import {
  MonthSwitcher,
  currentYearMonth,
  monthRangeISO,
  type YearMonth,
} from "../components/MonthSwitcher";
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

export default function ReceiptsPage() {
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
  const [formOpen, setFormOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editing, setEditing] = useState<Receipt | null>(null);
  const [prefill, setPrefill] = useState<PrefillFromScan | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Mês é o escopo primário de data: define from/to (transaction_date).
  const monthRange = useMemo(() => monthRangeISO(month), [month]);
  const effectiveFilters: ReceiptFilters = {
    ...filters,
    ...(activeCCId !== "all" ? { cost_center_id: activeCCId } : {}),
    from: monthRange.from,
    to: monthRange.to,
  };

  const { receipts, loading, error, refetch } = useReceipts(effectiveFilters);
  const isMobile = useIsMobile();
  // Refetch = ja tinha dados em tela e esta recarregando (troca de mes/filtro):
  // spinner sutil na contagem, sem trocar o conteudo de lugar.
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

  const openView = (r: Receipt) => setViewing(r);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    // Se todos da pagina atual ja estao selecionados, limpa. Senao,
    // adiciona todos os ids visiveis ao set.
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

  // Limpa selecao quando filtros mudam (selecao de linha que sumiu do
  // resultado fica orfa - melhor reset).
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, activeCCId]);

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
      "pago em", "descricao", "observacoes",
    ];
    // Uma linha por item (lançamento sem itens = 1 linha = ele mesmo).
    const rows: string[][] = [];
    for (const r of receipts) {
      for (const ln of receiptLines(r)) {
        rows.push([
          r.transaction_date || "",
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
        />
      </div>

      {/* Action row - estilo CDM PlotManagement: outline + icone leading.
          Novo Lancamento + Capturar Recibo sao botoes; Exportar e' dropdown
          (preparado pra varios formatos: CSV agora, Excel/PDF depois). */}
      <div className="grid grid-cols-2 gap-2 mb-3 lg:flex lg:flex-wrap lg:items-center">
        <Button variant="outline" onClick={openCreate} className="gap-1.5 flex-1 min-w-0 lg:min-w-[150px]">
          <Plus className="size-4 shrink-0" />
          <span className="flex-1 text-left">Novo Lançamento</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => setCaptureOpen(true)}
          className="gap-1.5 flex-1 min-w-0 lg:min-w-[150px]"
        >
          <Camera className="size-4 shrink-0" />
          <span className="flex-1 text-left">Capturar Recibo</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={receipts.length === 0}
              className="gap-1.5 flex-1 min-w-0 lg:min-w-[150px]"
            >
              <Download className="size-4 text-slate-500 shrink-0" />
              <span className="flex-1 text-left">Exportar</span>
              <ChevronDown className="size-4 text-slate-500 shrink-0" />
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

        {/* CC + ordenacao + mes: mesma linha das acoes, dividindo a largura. */}
        {showTabs && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 flex-1 min-w-0 lg:min-w-[150px] inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
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
                    {activeCCId === "all"
                      ? "Todos os Centros"
                      : userCCs.find((c) => c.id === activeCCId)?.name || "Centro"}
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

          {/* Botao de ordenacao - padrao CDM PlotManagement */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-9 flex-1 inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
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

        {/* Seletor de mes (📅) - escopo primario por transaction_date. */}
        <MonthSwitcher
          value={month}
          onChange={setMonth}
          variant="picker"
          className="flex-1 min-w-0 lg:min-w-[150px]"
        />
      </div>

      {/* Contagem (acima da regua de meses) - sempre montada (altura fixa) pra
          nao "pular" o layout ao trocar de mes; so o texto muda. */}
      {!error && (
        <div className="flex items-center justify-between mb-2 px-1 min-h-[28px]">
          <p className="text-sm text-slate-500 inline-flex items-center gap-2">
            {loading && receipts.length === 0
              ? "Carregando…"
              : receipts.length === 0
                ? "Sem lançamentos"
                : `Mostrando ${receipts.length} ${receipts.length === 1 ? "lançamento" : "lançamentos"}`}
            {isRefetching ? <Loader2 className="size-3 text-slate-400" /> : null}
          </p>
          {selectedIds.size > 0 ? (
            <div className="inline-flex items-center gap-2 text-sm">
              <span className="text-slate-700">
                {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
              </span>
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

      {/* Chips de navegacao de mes, logo acima da tabela. */}
      <MonthSwitcher
        value={month}
        onChange={setMonth}
        variant="chips"
        className="mb-3"
      />

      {/* Estados:
          - error: error card.
          - resto: tabela SEMPRE montada (mes vazio = linha de "—"), com dim +
            spinner sobreposto durante o loading. Nada troca de lugar ao mudar
            de mes/filtro (sem "desmonta/monta"). */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        // Tabela sempre montada (mes vazio = linha de "—"); so um dim sutil
        // durante o loading. Sem overlay - o spinner na contagem ja indica.
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
        onSaved={() => {
          void refetch();
        }}
      />

      <ReceiptCaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onScanComplete={handleScanComplete}
      />

      <ReceiptViewDialog
        receipt={viewing}
        open={viewing !== null}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
        onEdit={openEdit}
        onChanged={() => void refetch()}
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
