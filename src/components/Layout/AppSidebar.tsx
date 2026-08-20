import { type ComponentType, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/components/ui/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface RailItem {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  /** Classe de cor do ícone (duotone). Ver a paleta em AppShell/RAIL_ITENS. */
  cor: string;
  /** Rota exata (ex.: "/" e "/admin", que são prefixo de tudo). */
  end?: boolean;
  /** Contador (notificações não lidas). 0 = sem selo. */
  badge?: number;
  /** Desenha uma divisória ANTES deste item (separa o bloco do master). */
  separadorAntes?: boolean;
}

/**
 * Navegação principal do desktop: uma coluna estreita, **um ícone por página**.
 *
 * Nasceu com grupos e painel flutuante (o modelo do Flag Field, que tem ~37
 * itens em 9 grupos). Com 11 páginas o agrupamento cobrava um passo a mais para
 * chegar em qualquer lugar sem resolver problema nenhum: o painel existia para
 * caber o que aqui já cabia.
 *
 * O que sustenta o ícone sem rótulo é o **tooltip** — sem ele, ícone sozinho só
 * funciona depois que a pessoa decorou a posição, e até lá ela navega por
 * tentativa. Ele aparece à direita, onde há espaço, e usa o vidro quente do
 * app (o mesmo que distingue "dica" de "menu clicável").
 *
 * A **cor** é o segundo apoio: cada página tem a sua, em duotone. Duotone é o
 * que impede a coluna de virar confete — o segundo tom entra a 20% de opacidade,
 * então o que se vê é um glifo colorido sobre uma lavagem clara, não um bloco
 * chapado. Cor NUNCA é o único código aqui: o tooltip diz o nome e o fundo
 * marca a página aberta.
 */
export function AppSidebar({
  itens,
  footer,
}: {
  itens: RailItem[];
  footer?: ReactNode;
}) {
  return (
    <>
      {/* Um provider para o grupo todo: com um por item, cada tooltip teria o
          próprio atraso e a coluna piscaria ao correr o mouse por ela. */}
      <TooltipProvider delayDuration={200}>
        <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-1">
          {itens.map((it) => (
            <div key={it.to}>
              {it.separadorAntes && (
                <div aria-hidden className="my-2 h-px bg-slate-100" />
              )}
              <Tooltip>
                {/* O gatilho do tooltip envolve um <span>, e NÃO o NavLink.
                    `asChild` usa o Slot do Radix, que junta os className do pai
                    e do filho com join(" ") — e o className do NavLink é uma
                    FUNÇÃO. A junção transformava a função em string, e o <a>
                    saía com o código-fonte dela no atributo class.

                    O estrago era silencioso: pedaços do texto ainda são classes
                    válidas ("w-full", "flex", "h-10"), então o trilho parecia
                    certo — mas `relative` virava `"relative`, com aspa colada, e
                    não valia. Sem pai posicionado, o badge `absolute` do sino ia
                    ancorar no canto da PÁGINA e aparecia flutuando no topo à
                    direita, em todas as telas. */}
                <TooltipTrigger asChild>
                  <span className="relative block w-full">
                    <NavLink
                      to={it.to}
                      end={it.end}
                      aria-label={it.label}
                      className={({ isActive }) =>
                        cn(
                          "relative w-full flex items-center justify-center h-10 rounded-md transition-colors",
                          isActive ? "bg-slate-200" : "hover:bg-slate-100",
                        )
                      }
                    >
                      <it.Icon className={cn("size-6 shrink-0", it.cor)} />
                      {it.badge ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center tabular-nums"
                        >
                          {it.badge > 9 ? "9+" : it.badge}
                        </span>
                      ) : null}
                    </NavLink>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {it.label}
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
        </nav>
      </TooltipProvider>

      {footer && (
        <div className="shrink-0 border-t border-slate-200 p-2 flex justify-center">
          {footer}
        </div>
      )}
    </>
  );
}
