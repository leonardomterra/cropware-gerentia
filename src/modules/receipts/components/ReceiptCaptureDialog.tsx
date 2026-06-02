import { useEffect, useRef, useState } from "react";
import Camera from "~icons/material-symbols-light/photo-camera-outline";
import Upload from "~icons/material-symbols-light/upload";
import Loader2 from "~icons/svg-spinners/ring-resize";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReceiptScanner, type ScanResult } from "../hooks/useReceiptScanner";

interface ReceiptCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanComplete: (result: ScanResult) => void;
}

export function ReceiptCaptureDialog({
  open,
  onOpenChange,
  onScanComplete,
}: ReceiptCaptureDialogProps) {
  const { scan, scanning, error } = useReceiptScanner();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);

  useEffect(() => {
    if (!open) {
      // limpa estado quando fecha
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewSrc(null);
      setSelectedFile(null);
      setLastScan(null);
    }
  }, [open]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewSrc(url);
    setSelectedFile(file);
  };

  const handleProcessar = async () => {
    if (!selectedFile) return;
    const result = await scan(selectedFile);
    if (!result) return;

    const ocrFailed =
      !!result.scan_error || !result.extracted;
    if (ocrFailed) {
      // Mantem o dialog aberto e mostra o erro. User decide se prossegue.
      setLastScan(result);
      return;
    }
    onScanComplete(result);
    onOpenChange(false);
  };

  const handleContinueAnyway = () => {
    if (!lastScan) return;
    onScanComplete(lastScan);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !scanning && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Capturar Recibo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Tire foto do recibo, nota ou cupom. A IA tenta extrair os campos
            sozinha. Você revisa antes de salvar.
          </p>

          {previewSrc ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <img
                src={previewSrc}
                alt="Preview"
                className="w-full max-h-80 object-contain"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => cameraInputRef.current?.click()}
                disabled={scanning}
              >
                <Camera className="size-6 text-farm-primary" />
                <span className="text-sm">Tirar Foto</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
              >
                <Upload className="size-6 text-farm-primary" />
                <span className="text-sm">Galeria</span>
              </Button>
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {selectedFile ? (
            <div className="text-sm text-slate-500 flex items-center justify-between">
              <span className="truncate">{selectedFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (previewUrlRef.current)
                    URL.revokeObjectURL(previewUrlRef.current);
                  previewUrlRef.current = null;
                  setPreviewSrc(null);
                  setSelectedFile(null);
                }}
                disabled={scanning}
              >
                Trocar
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {lastScan && (lastScan.scan_error || !lastScan.extracted) ? (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <p className="font-medium">A IA não conseguiu ler o recibo.</p>
              <p className="mt-1">
                A foto foi salva. Você pode continuar e preencher os campos
                manualmente, ou trocar a foto e tentar de novo.
              </p>
              {lastScan.scan_error ? (
                <p className="mt-2 text-sm font-mono text-amber-700">
                  Detalhe: {lastScan.scan_error}
                </p>
              ) : null}
            </div>
          ) : null}

          {scanning ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600 py-2">
              <Loader2 className="size-4" />
              Processando com IA...
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={scanning}
          >
            Cancelar
          </Button>
          {lastScan && (lastScan.scan_error || !lastScan.extracted) ? (
            <Button
              type="button"
              variant="default"
              onClick={handleContinueAnyway}
            >
              Continuar e Preencher
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              onClick={handleProcessar}
              disabled={!selectedFile || scanning}
            >
              {scanning ? "Processando..." : "Processar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
