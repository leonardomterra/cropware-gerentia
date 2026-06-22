import Spinner from "~icons/material-symbols-light/progress-activity";
import { cn } from "./utils";

interface LoadingStateProps {
  /** Texto ao lado do spinner. Default "Carregando…". */
  label?: string;
  className?: string;
}

/**
 * Estado de carregamento padrão (spinner + texto, centralizado). Use SEMPRE
 * este componente no lugar de um "<p>Carregando...</p>" cru, pra consistência.
 */
export function LoadingState({ label = "Carregando…", className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "w-full flex items-center justify-center gap-2 py-8 text-sm text-slate-400",
        className,
      )}
    >
      <Spinner className="size-4 animate-spin" />
      {label}
    </div>
  );
}
