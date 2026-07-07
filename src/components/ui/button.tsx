import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

/**
 * Variants em paleta slate (Farm V1.5 standard). Brand color
 * #FF5C00 fica reservada pra marca/identidade (header, nav ativo,
 * destaques), nao pra botoes.
 *
 * Mapa funcao -> variant:
 *   acao principal / confirmacao  -> default (slate-900)
 *   acao secundaria / informacao  -> secondary (slate-100)
 *   cancelamento / dismiss        -> outline ou ghost
 *   destrutivo (excluir)          -> destructive (vermelho, mantem semantica)
 *   link inline em texto          -> link
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-normal transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-offset-0 aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-slate-900 text-white hover:bg-slate-800 shadow-[0_2px_4px_rgba(0,0,0,0.18)]",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-200 shadow-sm",
        outline:
          "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
        ghost:
          "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-[0_2px_4px_rgba(0,0,0,0.18)]",
        link:
          "text-slate-700 underline-offset-2 hover:underline hover:text-slate-900",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded px-6 has-[>svg]:px-4",
        icon: "size-9 rounded",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,

  React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };