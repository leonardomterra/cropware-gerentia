import Spinner from "~icons/material-symbols-light/progress-activity";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/components/ui/use-mobile";
import type { Receipt } from "../types";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { transformImageUrl } from "@/utils/cloudflareImage";

interface AttachmentViewerDialogProps {
  receipt: Receipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Visualizador do arquivo anexado a um lançamento (imagem ou PDF). Reusado em
 * Lançamentos (dialog de detalhes) e na aba Anexos. Busca o URL presigned via
 * `useAttachmentUrl` só enquanto aberto; imagens passam pelo Cloudflare (WebP)
 * com fallback pro presigned cru.
 */
export function AttachmentViewerDialog({
  receipt,
  open,
  onOpenChange,
}: AttachmentViewerDialogProps) {
  const isMobile = useIsMobile();
  const hasAttachment = !!receipt?.attachment_key;
  const { url, loading, error } = useAttachmentUrl(
    receipt?.id,
    open && hasAttachment,
  );

  const mime = receipt?.attachment_mime ?? "";
  const isPdf = mime === "application/pdf";
  const isImage = mime.startsWith("image/");
  const title = receipt?.vendor || receipt?.description || "Arquivo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-[40vh] flex items-center justify-center bg-slate-50 rounded border border-slate-100 overflow-hidden">
          {!hasAttachment ? (
            <p className="text-sm text-slate-400 p-8">Sem arquivo anexado.</p>
          ) : loading ? (
            <Spinner className="size-8 text-slate-400 animate-spin" />
          ) : error ? (
            <p className="text-sm text-red-600 p-8 text-center">{error}</p>
          ) : url && isImage ? (
            <img
              src={transformImageUrl(url, "full")}
              alt={title}
              className="max-h-[70vh] w-full object-contain"
            />
          ) : url && isPdf ? (
            isMobile ? (
              // WebView/mobile costuma renderizar <iframe> de PDF em branco — o
              // usuário abre pelo botão "Abrir em nova aba" do rodapé.
              <p className="text-sm text-slate-500 p-8 text-center">
                Pré-visualização indisponível no celular.
                <br />
                Use “Abrir em nova aba” abaixo.
              </p>
            ) : (
              <iframe
                src={url}
                title={title}
                className="w-full h-[70vh] bg-white"
              />
            )
          ) : url ? (
            <p className="text-sm text-slate-500 p-8 text-center">
              Pré-visualização não disponível para este tipo de arquivo.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
          <Button
            onClick={() => url && window.open(url, "_blank", "noopener")}
            disabled={!url}
          >
            {isPdf ? "Abrir em nova aba" : "Baixar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
