import { forwardRef, type ButtonHTMLAttributes, type ComponentType } from "react";
import { cn } from "@/components/ui/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/**
 * Botao de acao em ICONE - padrao do app (espelha os botoes dos cards de
 * Centro de Custo). Box `size-9 rounded-md` com borda slate-200, icone
 * `size-5`, hover slate. Variante `danger` (excluir/arquivar) = hover
 * vermelho. Usar SEMPRE este componente pra acoes em icone em listas/cards/
 * tabelas (Ver/Editar/Excluir/Ocultar/etc.) - nao recriar a mao.
 *
 * O `label` vira um Tooltip ESTILIZADO (Radix) + aria-label. O Tooltip do app
 * ja embute o Provider, entao funciona em qualquer lugar sem setup.
 */
interface ActionIconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<{ className?: string }>;
  /** vira o texto do Tooltip + aria-label. */
  label: string;
  tone?: "default" | "danger";
}

export const ActionIconButton = forwardRef<
  HTMLButtonElement,
  ActionIconButtonProps
>(({ icon: Icon, label, tone = "default", className, title: _title, ...props }, ref) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className={cn(
            "size-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed",
            tone === "danger"
              ? "hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              : "hover:bg-slate-100 hover:text-slate-700",
            className,
          )}
          {...props}
        >
          <Icon className="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
});

ActionIconButton.displayName = "ActionIconButton";
