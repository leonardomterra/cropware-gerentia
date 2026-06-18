import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';

export interface InfoItem {
  label: string;
  value: string;
}

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  /** Itens informativos opcionais exibidos em card */
  infoItems?: InfoItem[];
  loading?: boolean;
  cancelLabel?: string;
  confirmLabel?: string;
  loadingLabel?: string;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Confirmar ação',
  description,
  infoItems,
  loading = false,
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  loadingLabel = 'Processando...',
}: ConfirmActionDialogProps) {
  const hasInfo = infoItems && infoItems.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-lg max-w-md">
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle className="font-medium" style={{ fontSize: '16px', color: '#18181b' }}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {description && (
                <p
                  className="font-normal leading-relaxed"
                  style={{ fontSize: '14px', color: '#71717a' }}
                >
                  {description}
                </p>
              )}

              {hasInfo && (
                <div
                  className="rounded-lg p-3 space-y-1"
                  style={{ backgroundColor: '#fafafa', fontSize: '14px', border: '1px solid #e4e4e7' }}
                >
                  {infoItems!.map((item) => (
                    <div key={item.label} className="flex items-center justify-between font-normal">
                      <span style={{ color: '#52525b' }}>{item.label}</span>
                      <span style={{ color: '#18181b' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-2 gap-2 mt-2">
          <AlertDialogCancel
            disabled={loading}
            className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 h-9 w-full rounded-md text-sm font-normal shadow-none transition-colors mt-0"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-slate-800 text-white hover:bg-slate-900 border-0 h-9 w-full rounded-md text-sm font-normal shadow-none transition-colors"
          >
            {loading ? loadingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
