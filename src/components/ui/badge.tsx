import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn, toSubtitleCase } from "./utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const badgeVariants = cva(
  // Anatomia do Flag Field: SEM borda, padding fixo, e tamanho/peso da fonte
  // vindos do CSS global ([data-slot="badge"]) — não de classe por tamanho.
  // Tom/cor vem de colorScheme.
  "inline-flex items-center justify-center rounded px-2.5 py-0.5 w-fit whitespace-nowrap shrink-0 [&>svg]:size-3.5 gap-1.5 [&>svg]:pointer-events-none transition-all overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
        outline: "bg-slate-100 text-slate-700 [a&]:hover:bg-slate-200",
      },
      size: {
        // Só a altura muda entre os tamanhos: a fonte é a mesma nos dois,
        // definida uma vez no CSS.
        default: "h-6",
        compact: "h-5",
      },
      colorScheme: {
        // Tonal médio: fundo 200 + texto 900, sem borda e sem sombra.
        // Era 100/800 ("soft forte"); o Flag Field foi pro tom acima porque
        // sobre card branco o 100 quase não se separava do fundo, e o selo
        // precisa ser lido de relance numa lista.
        // Ver docs/ADOCAO-DESIGN-FLAGFIELD.md, Etapa B.
        // Semantic
        slate: "bg-slate-200 text-slate-900",
        // AMARELOS CALIBRADOS (25/08/2026). O "200" do Tailwind não quer dizer
        // a mesma coisa em toda cor: medido em OKLCH, amber-200 tem croma 0,120
        // e yellow/lime 0,129 — contra 0,059 do blue e 0,062 do red. Ou seja, o
        // selo âmbar tinha o DOBRO da saturação dos vizinhos e, por ser também
        // o mais claro, brilhava numa lista como se fosse de outro sistema.
        //
        // Aqui a matiz de cada um é preservada e só o croma desce para 0,075,
        // que é a mediana da família, com a claridade alinhada em 0,914. O valor
        // vai em OKLCH de propósito: em hexadecimal a intenção ("mesma cor, na
        // saturação da família") desapareceria. Contraste com o texto 900
        // conferido: 7,05 / 6,76 / 6,90 : 1, tudo acima do AA.
        //
        // Confira e recalibre em /badges (só em DEV).
        amber: "bg-[oklch(0.914_0.075_95.746)] text-amber-900",
        emerald: "bg-emerald-200 text-emerald-900",
        red: "bg-red-200 text-red-900",
        blue: "bg-blue-200 text-blue-900",
        // Extended
        green: "bg-green-200 text-green-900",
        orange: "bg-orange-200 text-orange-900",
        yellow: "bg-[oklch(0.914_0.075_101.54)] text-yellow-900",
        purple: "bg-purple-200 text-purple-900",
        cyan: "bg-cyan-200 text-cyan-900",
        teal: "bg-teal-200 text-teal-900",
        indigo: "bg-indigo-200 text-indigo-900",
        pink: "bg-pink-200 text-pink-900",
        rose: "bg-rose-200 text-rose-900",
        sky: "bg-sky-200 text-sky-900",
        lime: "bg-[oklch(0.914_0.075_124.321)] text-lime-900",
        gray: "bg-gray-200 text-gray-900 border-transparent",
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

type BadgeProps = React.ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    truncate?: boolean;
  };

// forwardRef: o Badge é usado como filho de TooltipTrigger/Slot asChild (que
// injeta um ref) — sem encaminhar o ref, o React avisa no console.
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
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
  },
  ref,
) {
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
      ref={ref}
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
});

export { Badge, badgeVariants };
