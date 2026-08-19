import React from "react";
import X from "~icons/ph/x";
import { Button } from "./button";
import { cn } from "./utils";

interface BatchActionBarProps {
  /** Texto completo, já flexionado — "3 lançamentos selecionados". */
  label: React.ReactNode;
  onCancel: () => void;
  /** Os botões de ação da barra (excluir, imprimir...). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Barra flutuante de ações em lote. Portada do Flag Field (Etapa H de
 * docs/ADOCAO-DESIGN-FLAGFIELD.md).
 *
 * O fundo segue o vidro do resto do app: a barra cobre a lista justamente onde
 * o usuário acabou de marcar itens, e fundo opaco esconde o que ele está
 * selecionando.
 *
 * Divisor e hover em `white/*`, não num cinza fixo: sobre fundo translúcido um
 * cinza não tem contraste garantido — ele depende do que passa por trás.
 */
export function BatchActionBar({
  label,
  onCancel,
  children,
  className,
}: BatchActionBarProps) {
  return (
    <div
      className={cn(
        "fixed z-[200] flex items-center gap-3 whitespace-nowrap",
        "rounded-[14px] border border-white/10 bg-slate-900/65 backdrop-blur-sm text-white shadow-xl",
        "animate-in slide-in-from-bottom-4 duration-300",
        // No celular ela pousa ACIMA da barra "Menu" do rodapé (h-12 = 3rem),
        // que continua sendo o caminho de navegação enquanto a seleção existe.
        "left-3 right-3 bottom-[calc(3rem+12px+env(safe-area-inset-bottom,0px))] h-12 px-4",
        "md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-6 md:rounded-lg md:h-auto md:px-5 md:py-3 md:gap-4",
        // Largura travada: sem isto a barra cresce a cada dígito do contador
        // (1 → 2 → 29 → 100). Como ela é centralizada por `-translate-x-1/2`,
        // crescer desloca as DUAS bordas ao mesmo tempo, e o botão de excluir
        // muda de lugar entre um clique e o seguinte. No celular ela já é fixa.
        "md:min-w-[30rem]",
        className,
      )}
    >
      {/* `flex-1` faz o texto absorver toda a folga: o que sobra da largura
          mínima fica aqui, e não empurrando os botões. Assim o alvo de clique
          fica no mesmo pixel com 1 ou com 100 selecionados. `tabular-nums`
          mantém os próprios dígitos com largura igual. */}
      <span className="text-sm font-medium flex-1 min-w-0 truncate tabular-nums">
        {label}
      </span>
      <div className="w-px h-5 bg-white/20 shrink-0" />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 px-3 shrink-0 text-white/70 hover:text-white hover:bg-white/10 font-normal text-sm"
        onClick={onCancel}
      >
        <X className="size-3.5 mr-1.5" /> Cancelar
      </Button>
      {children}
    </div>
  );
}
