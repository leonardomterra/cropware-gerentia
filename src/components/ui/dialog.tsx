"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "./utils";
import { ModalScopeProvider } from "./modal-scope";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[2000] bg-black/50",
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

function DialogContent({
  className,
  children,
  hideCloseButton,
  onAnimationStart,
  description,
  "aria-describedby": ariaDescribedBy,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  hideCloseButton?: boolean;
  /** Descrição p/ leitores de tela (sr-only). Sem ela, o aviso do Radix é
   *  suprimido (a maioria dos nossos dialogs não tem descrição visível). */
  description?: React.ReactNode;
}) {
  // Com `description`, deixa o Radix vincular a <Description>. Sem ela (e sem um
  // aria-describedby explícito), passa undefined p/ silenciar o warning.
  const describedBy =
    description != null
      ? ariaDescribedBy != null
        ? { "aria-describedby": ariaDescribedBy }
        : {}
      : { "aria-describedby": ariaDescribedBy };
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      {/* Wrapper garante margem lateral no mobile + safe area para dynamic island */}
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-5 pointer-events-none" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px) + 0.5rem)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px) + 0.5rem)' }}>
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            "relative bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 grid w-full max-w-4xl gap-4 rounded border p-4 sm:p-6 shadow-sm duration-200 pointer-events-auto max-h-[calc(100vh-env(safe-area-inset-top,0)-env(safe-area-inset-bottom,0)-2rem)] overflow-y-auto",
            className,
          )}
          onAnimationStart={(e) => {
            const el = e.currentTarget as HTMLElement;
            if (el.getAttribute('data-state') === 'open') {
              el.scrollTop = 0;
              el.querySelectorAll<HTMLElement>('*').forEach(child => {
                if (child.scrollTop > 0) child.scrollTop = 0;
              });
            }
            onAnimationStart?.(e);
          }}
          // Bloqueia fechar ao clicar fora (padrao Farm: dialog so fecha
          // via X, Cancelar ou acao explicita). Override via props se preciso.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          {...props}
          {...describedBy}
        >
          {description != null && (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          )}
          <ModalScopeProvider>{children}</ModalScopeProvider>
          {!hideCloseButton && (
            <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-3 right-3 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 p-2 min-w-[44px] min-h-[44px] hidden sm:flex items-center justify-center">
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // No mobile empilha (col-reverse: ação primária em cima); no desktop
        // vira linha com botoes dividindo a largura (sm:*:flex-1). Linha suave
        // em cima (full-width via -mx-6 px-6). Mesmo padrao do AlertDialogFooter.
        // NAO sticky - flui no fim do conteudo (o DialogContent ja tem
        // overflow-y-auto), evita sobrepor o ultimo campo.
        "flex flex-col-reverse gap-2 sm:flex-row sm:*:flex-1 border-t border-slate-100 pt-4 -mx-4 px-4 sm:-mx-6 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};