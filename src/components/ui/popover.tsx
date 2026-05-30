"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "./utils";
import { useIsInsideModal } from "./modal-scope";

function Popover({
  modal = false,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" modal={modal} {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  collisionPadding = { top: 340, bottom: 16 },
  style,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  // Eleva z-index pra acima do overlay de modais (Dialog/Sheet/Drawer = 2000)
  // quando o popover é aberto DENTRO de um modal. Fora de modal, mantém z-[999]
  // que respeita o header sticky. Ver .agent/workflows/dropdown-stacking-pattern.md.
  const isInsideModal = useIsInsideModal();
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        // collisionPadding.top reserva ~340px do topo — notch iOS + header sticky completo (3 linhas)
        // para Radix nunca posicionar/flippar o popper sob o header.
        // collisionPadding.bottom de 16px dá folga do rodapé do viewport e permite que
        // --radix-popover-content-available-height seja menor que o viewport total
        // quando o gatilho está no rodapé da página. Ver
        // .agent/workflows/dropdown-stacking-pattern.md.
        collisionPadding={collisionPadding}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 w-72 origin-(--radix-popover-content-transform-origin) rounded border border-slate-100 p-4 shadow-sm outline-hidden flex flex-col overflow-hidden",
          isInsideModal ? "z-[2500]" : "z-[999]",
          className,
        )}
        style={{
          maxHeight: "var(--radix-popover-content-available-height)",
          ...style,
        }}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
