import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn, toSubtitleCase } from "./utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const badgeVariants = cva(
  // Mesmas classes do simulador (/badges): sem sombra, sem transição, fonte via
  // text-xs (não inline), padding por tamanho. Tom/cor vem de colorScheme.
  "inline-flex items-center justify-center rounded border w-fit whitespace-nowrap shrink-0 font-medium [&>svg]:size-3.5 gap-1.5 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
      size: {
        default: "h-6 px-2.5 text-xs",
        compact: "h-5 px-2 text-[11px]",
      },
      colorScheme: {
        // Padrão "soft forte" (igual ao simulador): fundo claro (100) + texto
        // escuro (800), SEM borda visível.
        // Semantic
        slate: "bg-slate-100 text-slate-800 border-transparent",
        amber: "bg-amber-100 text-amber-800 border-transparent",
        emerald: "bg-emerald-100 text-emerald-800 border-transparent",
        red: "bg-red-100 text-red-800 border-transparent",
        blue: "bg-blue-100 text-blue-800 border-transparent",
        // Extended
        green: "bg-green-100 text-green-800 border-transparent",
        orange: "bg-orange-100 text-orange-800 border-transparent",
        yellow: "bg-yellow-100 text-yellow-800 border-transparent",
        purple: "bg-purple-100 text-purple-800 border-transparent",
        cyan: "bg-cyan-100 text-cyan-800 border-transparent",
        teal: "bg-teal-100 text-teal-800 border-transparent",
        indigo: "bg-indigo-100 text-indigo-800 border-transparent",
        pink: "bg-pink-100 text-pink-800 border-transparent",
        rose: "bg-rose-100 text-rose-800 border-transparent",
        sky: "bg-sky-100 text-sky-800 border-transparent",
        lime: "bg-lime-100 text-lime-800 border-transparent",
        gray: "bg-gray-100 text-gray-800 border-transparent",
        white: "bg-white text-slate-600 border-slate-200",
        // Nenhuma cor (para uso com className custom)
        none: "",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
);

function Badge({
  className,
  variant,
  size = "default",
  colorScheme,
  asChild = false,
  style,
  truncate,
  title,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; truncate?: boolean }) {
  const Comp = asChild ? Slot : "span";
  const useShadcnTooltip = truncate && !!title;

  // Badges sempre em Title Case PT-BR: "A Pagar", "Nota de Saida".
  // So transforma filhos string diretos (labels); nomes/JSX aninhados
  // (ex.: <span>{user.fullName}</span> no header) ficam intactos.
  const content = React.Children.map(children, (child) =>
    typeof child === "string" ? toSubtitleCase(child) : child,
  );

  const badge = (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({ variant, size, colorScheme }),
        truncate && "shrink min-w-0 max-w-[260px] md:max-w-[420px]",
        className,
      )}
      style={style}
      title={useShadcnTooltip ? undefined : title}
      {...props}
    >
      {truncate ? <span className="truncate">{content}</span> : content}
    </Comp>
  );

  if (useShadcnTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

export { Badge, badgeVariants };
