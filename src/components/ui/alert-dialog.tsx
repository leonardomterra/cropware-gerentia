"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "./utils";

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[10000] bg-black/50",
        className,
      )}
      {...props}
    />
  );
});
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-5 pointer-events-none"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top, 0px) + 0.5rem)",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px) + 0.5rem)",
        }}
      >
        <AlertDialogPrimitive.Content
          data-slot="alert-dialog-content"
          className={cn(
            "relative bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 grid grid-cols-1 w-full max-w-md gap-4 rounded-lg border p-6 shadow-sm duration-200 pointer-events-auto max-h-[calc(100vh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem)] overflow-y-auto",
            className,
          )}
          {...props}
        />
      </div>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        // Padrão do Flag Field: SEMPRE em linha, os dois botões dividindo a
        // largura. Sem divisória em cima — num dialog de confirmação o corpo é
        // uma frase, e a linha separava um parágrafo de dois botões, o que só
        // adicionava peso. Empilhar no mobile também saiu: dois botões de meia
        // tela cabem, e empilhado a ação destrutiva ficava sob o polegar.
        "flex flex-row gap-2 w-full mt-2 sm:space-x-0 *:flex-1",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-base font-medium", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/*
 * A ação usa `bg-primary` (#525252), o MESMO de "Novo Lançamento" e "Salvar" —
 * e não um `slate-800` cravado à mão, que deixava o botão de confirmar bem mais
 * escuro que qualquer outra ação principal da interface. Cor de botão primário
 * vem do token; cravada, ela só diverge.
 *
 * Botões do padrão Flag Field: sem sombra. Sombra em botão dentro de um dialog
 * que já flutua é sombra sobre sombra — o elemento parecia descolar do cartão.
 *
 * `outline-none` + anel próprio: o Radix foca um deles
 * ao abrir o dialog, e sem isso o que aparece é o outline padrão do navegador —
 * o halo AZUL do Chrome, fora da paleta do app. As classes destes dois botões
 * são escritas à mão (não vêm de `buttonVariants`), então o tratamento de foco
 * de lá não chegava aqui.
 */
function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-normal transition-colors disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 border-0 h-9 px-4 py-2 rounded-md shadow-none outline-none focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-normal transition-all disabled:pointer-events-none disabled:opacity-50 bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 h-9 px-4 py-2 mt-0 rounded-md shadow-none outline-none focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
