import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

interface DiscardChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  title?: string;
  description?: string;
  cancelLabel?: string;
  discardLabel?: string;
}

export function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  title = "Descartar alterações?",
  description = "Existem dados não salvos no formulário. Se você sair agora, todas as alterações serão perdidas.",
  cancelLabel = "Continuar Editando",
  discardLabel = "Descartar",
}: DiscardChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-lg max-w-md">
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle
            className="font-medium"
            style={{ fontSize: "16px", color: "#171717" }}
          >
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p
                className="font-normal leading-relaxed"
                style={{ fontSize: "14px", color: "#737373" }}
              >
                {description}
              </p>
              <p
                className="font-normal"
                style={{ fontSize: "14px", color: "#a3a3a3" }}
              >
                As alterações não salvas serão perdidas permanentemente.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onDiscard();
            }}
          >
            {discardLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
