import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded border px-2.5 py-0.5 text-[13px] font-light w-fit whitespace-nowrap shrink-0 [&>svg]:size-3.5 gap-1.5 [&>svg]:pointer-events-none transition-all shadow-xs overflow-hidden",
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
        default: "h-6",
        compact: "h-5",
      },
      colorScheme: {
        // Semantic
        slate: "bg-slate-50 text-slate-700 border-slate-200",
        amber: "bg-amber-50 text-amber-700 border-amber-200",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
        red: "bg-red-50 text-red-700 border-red-200",
        blue: "bg-blue-50 text-blue-700 border-blue-200",
        // Extended
        green: "bg-green-50 text-green-700 border-green-200",
        orange: "bg-orange-50 text-orange-700 border-orange-200",
        yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
        purple: "bg-purple-50 text-purple-700 border-purple-200",
        cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
        teal: "bg-teal-50 text-teal-700 border-teal-200",
        indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
        pink: "bg-pink-50 text-pink-700 border-pink-200",
        rose: "bg-rose-50 text-rose-700 border-rose-200",
        sky: "bg-sky-50 text-sky-700 border-sky-200",
        lime: "bg-lime-50 text-lime-700 border-lime-200",
        gray: "bg-gray-100 text-gray-700 border-gray-200",
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

const sizeToFontSize: Record<string, string> = {
  default: "13px",
  compact: "13px",
};

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
  const fontSize = sizeToFontSize[size || "default"];
  const useShadcnTooltip = truncate && !!title;

  const badge = (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({ variant, size, colorScheme }),
        truncate && "shrink min-w-0 max-w-[260px] md:max-w-[420px]",
        className,
      )}
      style={{ fontSize, ...style }}
      title={useShadcnTooltip ? undefined : title}
      {...props}
    >
      {truncate ? <span className="truncate">{children}</span> : children}
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
