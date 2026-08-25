import type { ReactNode } from "react";
import Question from "~icons/ph/question";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";
import { SUPERFICIE_TOOLTIP } from "@/lib/ui-tokens";

/**
 * O "(?)" do app — explicação que fica GUARDADA até alguém pedir.
 *
 * Nasceu em 25/08/2026 de um problema concreto: a tela da fatura tinha um
 * parágrafo explicando por que algumas compras aparecem fora dela. O texto
 * estava certo e era útil UMA vez; depois disso virava peso permanente numa
 * tela que já tem muito número. Guardar atrás de um ícone devolve a tela a quem
 * já entendeu, sem tirar a explicação de quem ainda não.
 *
 * POR QUE CLIQUE, e não hover: o app roda no celular, onde hover não existe —
 * um tooltip de hover simplesmente não abriria. Clique funciona nos dois, e o
 * Radix cuida de Esc, clique fora e teclado.
 *
 * O vidro é o `SUPERFICIE_TOOLTIP` que o app já usa, e não uma superfície nova:
 * é cinza QUENTE, o que distingue "dica passageira" de "menu com que dá pra
 * interagir" sem inventar outra linguagem visual.
 *
 * Uso:
 *   <h2 className="flex items-center gap-1.5">
 *     Lançadas fora desta fatura
 *     <Ajuda>Normalmente são compras feitas depois do fechamento.</Ajuda>
 *   </h2>
 */
export function Ajuda({
  children,
  rotulo = "O que é isso?",
  className,
}: {
  /** O texto da explicação. Uma ou duas frases — o que não couber aí é
   *  documentação, não dica. */
  children: ReactNode;
  /** Lido por leitor de tela e mostrado no title. */
  rotulo?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          title={rotulo}
          // `shrink-0` porque ele quase sempre fica ao lado de um título que
          // pode truncar — sem isso o ícone é o primeiro a ser espremido.
          className={cn(
            "shrink-0 inline-flex items-center justify-center size-[18px] rounded-full",
            "text-slate-400 hover:text-slate-600 transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300",
            className,
          )}
        >
          <Question className="size-[15px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        // 18rem cabe duas ou três linhas de frase sem virar um parágrafo
        // atravessado na tela.
        className={cn(SUPERFICIE_TOOLTIP, "w-72 p-3 text-sm z-[999]")}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
