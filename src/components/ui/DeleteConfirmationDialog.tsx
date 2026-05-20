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

export interface CascadeItem {
  label: string;
  count: number;
}

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  /** Nome do item sendo excluído, ex: "o talhão P07" */
  itemName?: string;
  /** Itens que serão excluidos em cascata */
  cascadeItems?: CascadeItem[];
  /** Se true, mostra spinner no botão */
  loading?: boolean;
  cancelLabel?: string;
  confirmLabel?: string;
  /** Batch mode: list of selected item names to display */
  batchItems?: string[];
  /** Batch mode: total count (when batchItems is truncated) */
  batchCount?: number;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Confirmar exclusão',
  itemName,
  cascadeItems,
  loading = false,
  cancelLabel = 'Cancelar',
  confirmLabel = 'Excluir',
  batchItems,
  batchCount,
}: DeleteConfirmationDialogProps) {
  const hasCascade = cascadeItems && cascadeItems.some(c => c.count > 0);
  const isBatch = batchItems && batchItems.length > 0;
  const totalBatch = batchCount ?? batchItems?.length ?? 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-lg max-w-4xl" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle className="font-medium" style={{ fontSize: '16px', color: '#0f172a' }}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p
                className="font-normal leading-relaxed"
                style={{ fontSize: '14px', color: '#64748b' }}
              >
                Esta ação é irreversível.{' '}
                {isBatch
                  ? `Ao excluir ${totalBatch} item(ns), todos os dados vinculados também serão removidos permanentemente.`
                  : itemName
                    ? `Ao excluir ${itemName}, todos os dados vinculados também serão removidos permanentemente.`
                    : 'Todos os dados relacionados serão removidos permanentemente.'}
              </p>

              {/* Subtle warning */}
              <p className="font-normal" style={{ fontSize: '14px', color: '#94a3b8' }}>
                Esta exclusão é definitiva e não poderá ser desfeita.
              </p>

              {/* Batch items list */}
              {isBatch && (
                <div className="space-y-2">
                  <p
                    className="font-normal"
                    style={{ fontSize: '14px', color: '#64748b' }}
                  >
                    Itens selecionados:
                  </p>
                  <div
                    className="rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto"
                    style={{ backgroundColor: '#f8fafc', fontSize: '14px', border: '1px solid #e2e8f0' }}
                  >
                    {batchItems!.map((name, i) => (
                      <div key={i} className="flex items-center gap-1.5 font-normal">
                        <span style={{ color: '#475569' }}>{name}</span>
                      </div>
                    ))}
                    {totalBatch > batchItems!.length && (
                      <p className="font-normal italic" style={{ fontSize: '14px', color: '#94a3b8' }}>
                        ...e mais {totalBatch - batchItems!.length} item(ns)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Cascade impact card */}
              {hasCascade && (
                <div className="space-y-2">
                  <p
                    className="font-normal"
                    style={{ fontSize: '14px', color: '#64748b' }}
                  >
                    A exclusão {isBatch ? 'destes itens' : 'deste item'} irá impactar:
                  </p>
                  <div
                    className="rounded-lg p-3 space-y-1"
                    style={{ backgroundColor: '#f8fafc', fontSize: '14px', border: '1px solid #e2e8f0' }}
                  >
                    {cascadeItems!
                      .filter(c => c.count > 0)
                      .map((item) => (
                        <div key={item.label} className="flex items-center justify-between font-normal">
                          <span style={{ color: '#475569' }}>{item.label}</span>
                          <span style={{ color: '#0f172a' }}>{item.count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-row gap-2 w-full sm:space-x-0 mt-2">
          <AlertDialogCancel
            disabled={loading}
            className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 h-9 flex-1 rounded-md text-sm font-normal shadow-none transition-colors mt-0"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-slate-800 text-white hover:bg-slate-900 border-0 h-9 flex-1 rounded-md text-sm font-normal shadow-none transition-colors"
          >
            {loading ? 'Excluindo...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
