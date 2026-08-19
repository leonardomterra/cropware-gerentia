import {
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/components/ui/utils";
import { SUPERFICIE_ESCURA } from "@/lib/ui-tokens";

export interface RailItem {
  to: string;
  label: string;
  /** Rota exata (ex.: "/" e "/admin", que são prefixo de tudo). */
  end?: boolean;
  /** Contador (notificações não lidas). 0 = sem selo. */
  badge?: number;
}

export interface RailGroup {
  label: string;
  Icon: ElementType;
  items: RailItem[];
}

/**
 * Navegação principal do desktop: uma coluna estreita de ícones, sempre nesse
 * estado. Portada do Flag Field (Etapa F de docs/ADOCAO-DESIGN-FLAGFIELD.md).
 *
 * **Não recolhe nem expande.** A lateral com rótulos e botão de recolher saiu
 * junto — e com ela o estado `collapsed`, porque estado sem controle na
 * interface é como o usuário fica preso num modo que não sabe desfazer.
 *
 * **Os itens vivem em GRUPOS, não soltos.** Onze ícones sem rótulo numa coluna
 * seriam piores que a lateral que havia antes: sem rótulo, o ícone só funciona
 * quando o conjunto é pequeno o bastante para virar memória de posição. O painel
 * flutuante dá a lista inteira do grupo sem cobrar espaço fixo.
 *
 * O painel é escuro por contraste: a lateral e a página são brancas, e um painel
 * branco sobre fundo branco se separava do conteúdo só por um fio cinza. Mesmo
 * vidro dos menus do app, de um token só.
 */
export function AppSidebar({
  groups,
  footer,
}: {
  groups: RailGroup[];
  footer?: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Guarda a posição do gatilho: o painel é posicionado por coordenada, não
  // relativo ao item, pra poder escapar da coluna e ser contido na janela.
  const [flyout, setFlyout] = useState<{
    label: string;
    topo: number;
    esquerda: number;
  } | null>(null);
  const timer = useRef<number | null>(null);
  const painelRef = useRef<HTMLDivElement | null>(null);

  const abrir = (label: string, alvo: HTMLElement) => {
    const r = alvo.getBoundingClientRect();
    setFlyout({ label, topo: r.top, esquerda: r.right + 6 });
  };

  // Sobe o painel quando ele passaria da borda de baixo. Precisa medir depois
  // de renderizar, porque a altura depende de quantos itens o grupo tem.
  useLayoutEffect(() => {
    const el = painelRef.current;
    if (!el || !flyout) return;
    const MARGEM = 8;
    const limite = window.innerHeight - el.offsetHeight - MARGEM;
    el.style.top = `${Math.max(MARGEM, Math.min(flyout.topo, limite))}px`;
  }, [flyout]);

  // Pequeno atraso ao sair: sem isso o painel some ao cruzar o vão até ele.
  const agendarFechar = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlyout(null), 180);
  };
  const cancelarFechar = () => {
    if (timer.current) window.clearTimeout(timer.current);
  };

  const itemAtivo = (it: RailItem) =>
    it.end
      ? location.pathname === it.to
      : location.pathname === it.to ||
        location.pathname.startsWith(it.to + "/");

  return (
    <>
      <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-1">
        {groups.map((g) => {
          const aberto = flyout?.label === g.label;
          const ativo = g.items.some(itemAtivo);
          const naoLidas = g.items.reduce((s, i) => s + (i.badge ?? 0), 0);

          return (
            <div
              key={g.label}
              className="relative"
              onMouseEnter={(e) => {
                cancelarFechar();
                abrir(g.label, e.currentTarget);
              }}
              onMouseLeave={agendarFechar}
            >
              <button
                type="button"
                // Clique também abre — só hover deixaria teclado e toque sem
                // caminho. Vale INCLUSIVE para grupo de um item só: um trilho
                // em que alguns ícones navegam e outros abrem painel é
                // imprevisível, e a previsibilidade vale mais que o clique
                // economizado.
                onClick={(e) =>
                  aberto ? setFlyout(null) : abrir(g.label, e.currentTarget)
                }
                // Sem `title`: o tooltip nativo é desenhado por cima do painel.
                aria-label={g.label}
                aria-expanded={aberto}
                className={cn(
                  "w-full flex items-center justify-center h-10 rounded-md transition-colors",
                  ativo
                    ? "bg-slate-200 text-slate-900"
                    : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900",
                )}
              >
                <g.Icon className="size-5 shrink-0" />
              </button>

              {naoLidas > 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center tabular-nums"
                >
                  {naoLidas > 9 ? "9+" : naoLidas}
                </span>
              )}

              {/* No body, com posição fixa: dentro da coluna ele seria
                  recortado por qualquer ancestral com overflow, e não teria
                  como ser contido na janela. */}
              {aberto &&
                createPortal(
                  <div
                    ref={painelRef}
                    style={{
                      top: flyout.topo,
                      left: flyout.esquerda,
                      maxHeight: "calc(100vh - 16px)",
                    }}
                    className={cn(
                      // Largura FIXA, não min-width: os itens usam w-full e,
                      // num elemento fixed que encolhe até o conteúdo, isso
                      // resolve pela largura disponível — a janela toda.
                      "fixed z-[1200] w-56 p-2 overflow-y-auto",
                      SUPERFICIE_ESCURA,
                    )}
                    onMouseEnter={cancelarFechar}
                    onMouseLeave={agendarFechar}
                  >
                    {/* Sem título de grupo: o painel abre a partir do ícone
                        que o usuário acabou de apontar, então o nome repetia o
                        que ele já sabia e comia uma linha do painel. O grupo
                        continua nomeado no `aria-label` do gatilho, que é quem
                        o leitor de tela anuncia. */}
                    <div className="space-y-0.5">
                      {g.items.map((it) => (
                        <button
                          key={it.to}
                          type="button"
                          onClick={() => {
                            setFlyout(null);
                            navigate(it.to);
                          }}
                          className={cn(
                            "w-full text-left px-2.5 h-8 rounded-md text-[14px] font-normal transition-colors truncate flex items-center gap-2",
                            // Branco, não cinza-claro: sobre o vidro a 65% o
                            // tom antigo cairia para ~3,9:1.
                            itemAtivo(it)
                              ? "bg-white/15 text-white"
                              : "text-white hover:bg-white/10",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {it.label}
                          </span>
                          {it.badge ? (
                            <span className="shrink-0 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center tabular-nums">
                              {it.badge > 9 ? "9+" : it.badge}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body,
                )}
            </div>
          );
        })}
      </nav>

      {footer && (
        <div className="shrink-0 border-t border-slate-200 p-2 flex justify-center">
          {footer}
        </div>
      )}
    </>
  );
}
