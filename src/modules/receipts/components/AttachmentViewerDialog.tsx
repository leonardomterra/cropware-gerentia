import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Receipt } from "../types";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { openExternalUrl } from "@/utils/nativeExport";
import { AttachmentViewer } from "./AttachmentViewer";

interface AttachmentViewerDialogProps {
  receipt: Receipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Visualizador em DIÁLOGO — usado de dentro do formulário de lançamento, onde
 * ver o anexo é uma espiada e a tela de trás precisa continuar de pé (com o que
 * já foi digitado). A partir de uma LISTA, o caminho é a página inline
 * (`PaginaDeAnexo`), que tem para onde voltar.
 *
 * O conteúdo é o mesmo `AttachmentViewer` nos dois — inclusive a rasterização
 * do PDF, que é o que faz o anexo aparecer no iOS.
 */
export function AttachmentViewerDialog({
  receipt,
  open,
  onOpenChange,
}: AttachmentViewerDialogProps) {
  const { url } = useAttachmentUrl(
    receipt?.id,
    open && !!receipt?.attachment_key,
  );
  const isPdf = (receipt?.attachment_mime ?? "") === "application/pdf";
  const title = receipt?.vendor || receipt?.description || "Arquivo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
        </DialogHeader>

        <AttachmentViewer receipt={receipt} ativo={open} />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
          <Button onClick={() => url && openExternalUrl(url)} disabled={!url}>
            {isPdf ? "Abrir em nova aba" : "Baixar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
