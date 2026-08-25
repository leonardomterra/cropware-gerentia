import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import NoteDuotone from "~icons/ph/note-duotone";
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
 * POR QUE DIALOG NO CENTRO, e não um balão ancorado no ícone: o balão nascia
 * grudado no título e empurrado pela borda da tela, então a mesma dica aparecia
 * num lugar diferente a cada uso — e no celular ele cobria justamente a linha
 * que estava sendo explicada. No centro, sempre no mesmo lugar, com o resto da
 * tela desfocado atrás, a explicação é a única coisa em foco. Sai com Esc,
 * clique fora ou "Entendi".
 *
 * POR QUE CLIQUE, e não hover: o app roda no celular, onde hover não existe.
 *
 * O cartão é o `SUPERFICIE_TOOLTIP` que o app já usa — cinza QUENTE, o que
 * distingue "dica passageira" de "dialog com que se opera" sem inventar outra
 * linguagem visual.
 *
 * Uso:
 *   <h2 className="flex items-center gap-1.5">
 *     Fora desta fatura
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
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          title={rotulo}
          // `shrink-0` porque ele quase sempre fica ao lado de um título que
          // pode truncar — sem isso o ícone é o primeiro a ser espremido.
          className={cn(
            "shrink-0 inline-flex items-center justify-center size-5 rounded-full",
            // A MARGEM NEGATIVA é o que mantém os campos alinhados. O <Label>
            // do app é `leading-none` — 14px de altura de linha para texto de
            // 14px —, e este botão tem 20px. Sem isso, a linha do rótulo que
            // tem (?) fica 2px mais alta que a do vizinho, e o campo abaixo
            // dela desce 2px: numa grade de duas colunas o desalinho salta aos
            // olhos. Com `-my-[3px]` o botão contribui 14px para a linha e
            // transborda 3px para cada lado, onde não há nada. A área de
            // clique continua com 20px, que é o que importa no celular.
            "-my-[3px]",
            // Cinza, e não colorido: o ícone acompanha um título e não pode
            // competir com ele. Quem procura ajuda acha; quem não procura não
            // tropeça. Escurece no hover para confirmar que é clicável.
            "text-slate-400 hover:text-slate-600 transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300",
            className,
          )}
        >
          <NoteDuotone className="size-5" />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        {/* O desfoque é o efeito principal: some com a tela sem escondê-la, e
            o véu escuro fica de leve só para dar contraste ao cartão. Um
            `bg-black/50` como o dos dialogs de verdade seria peso demais para
            uma frase explicativa. */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[2000] bg-slate-900/20 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 pointer-events-none">
          <DialogPrimitive.Content
            // Sem título visível: a dica JÁ nasce ao lado do título que ela
            // explica, e repeti-lo dentro do cartão só ocuparia linha.
            aria-label={rotulo}
            className={cn(
              SUPERFICIE_TOOLTIP,
              "pointer-events-auto w-full max-w-sm p-4 text-sm leading-relaxed",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            )}
          >
            {/* Sem ícone aqui dentro: o cartão só tem uma coisa a dizer, e
                repetir o ícone do gatilho roubava a primeira linha do texto. */}
            {children}
            {/* Largura cheia e transparente: o botão é a borda de baixo do
                cartão, não um elemento a mais competindo por atenção. No
                celular, também vira um alvo de toque que não se erra. */}
            <DialogPrimitive.Close className="mt-4 w-full rounded-lg border border-white/25 py-2 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40">
              Entendi
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
