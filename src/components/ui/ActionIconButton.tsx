import { forwardRef, type ButtonHTMLAttributes, type ComponentType } from "react";
import { cn } from "@/components/ui/utils";

/**
 * Botao de acao em ICONE - padrao do app (espelha os botoes dos cards de
 * Centro de Custo). Box `size-9 rounded-md` com borda slate-200, icone
 * `size-5`, hover slate. Variante `danger` (excluir/arquivar) = hover
 * vermelho. Usar SEMPRE este componente pra acoes em icone em listas/cards/
 * tabelas (Ver/Editar/Excluir/Ocultar/etc.) - nao recriar a mao.
 *
 * forwardRef pra poder ser trigger de Tooltip/Popover (asChild).
 */
interface ActionIconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<{ className?: string }>;
  /** vira title + aria-label (acessibilidade + tooltip nativo de fallback). */
  label: string;
  tone?: "default" | "danger";
}

export const ActionIconButton = forwardRef<
  HTMLButtonElement,
  ActionIconButtonProps
>(({ icon: Icon, label, tone = "default", className, title, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      // title nativo = label por padrao; passe title="" pra suprimir (ex:
      // quando e' trigger de um Tooltip estilizado, evita 2 tooltips).
      title={title ?? label}
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
  );
});

ActionIconButton.displayName = "ActionIconButton";
