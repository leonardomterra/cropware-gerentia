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
                                {description}
                            </p>
                            <p className="font-normal" style={{ fontSize: '14px', color: '#94a3b8' }}>
                                As alterações não salvas serão perdidas permanentemente.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-row gap-2 w-full sm:space-x-0 mt-2">
                    <AlertDialogCancel
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 h-9 flex-1 rounded-md text-sm font-normal shadow-none transition-colors mt-0"
                        onClick={() => onOpenChange(false)}
                    >
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onDiscard();
                        }}
                        className="bg-slate-800 text-white hover:bg-slate-900 border-0 h-9 flex-1 rounded-md text-sm font-normal shadow-none transition-colors"
                    >
                        {discardLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
