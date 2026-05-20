import { useState } from "react";
import { Camera, Plus, Receipt as ReceiptIcon } from "lucide-react";
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
import { useIsMobile } from "@/components/ui/use-mobile";
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
  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [formOpen, setFormOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editing, setEditing] = useState<Receipt | null>(null);
  const [prefill, setPrefill] = useState<PrefillFromScan | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { receipts, loading, error, refetch } = useReceipts(filters);
  const isMobile = useIsMobile();

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

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteReceipt(pendingDelete.id);
      setPendingDelete(null);
      await refetch();
    } catch (err) {
      console.error("[ReceiptsPage] delete failed:", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-base font-medium text-slate-900">Lancamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Despesas e receitas da fazenda.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCaptureOpen(true)}
            className="gap-1"
          >
            <Camera className="size-4" />
            Capturar Recibo
          </Button>
          <Button variant="default" onClick={openCreate}>
            <Plus className="size-4 mr-1" />
            Novo Lançamento
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-sm text-slate-500">Entradas</p>
          <p className="text-base font-medium text-emerald-700 tabular-nums">
            {formatBRL(totalIncome)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-sm text-slate-500">Saidas</p>
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

      <div className="mb-3">
        <ReceiptFiltersBar value={filters} onChange={setFilters} />
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-sm text-slate-500">
          Carregando...
        </div>
      ) : receipts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 flex flex-col items-center text-center gap-3">
          <ReceiptIcon className="size-10 text-slate-300" />
          <div>
            <p className="text-sm font-medium text-slate-900">
              Nenhum lancamento ainda
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              Adiciona seu primeiro pelo botao acima. Captura por foto chega no
              proximo commit.
            </p>
          </div>
        </div>
      ) : isMobile ? (
        <ReceiptsCards
          receipts={receipts}
          onEdit={openEdit}
          onDelete={(r) => setPendingDelete(r)}
        />
      ) : (
        <ReceiptsTable
          receipts={receipts}
          onEdit={openEdit}
          onDelete={(r) => setPendingDelete(r)}
        />
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
            <AlertDialogTitle>Excluir lancamento?</AlertDialogTitle>
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
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
