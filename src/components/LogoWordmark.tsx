import { useEffect, useState } from "react";
import { cn } from "@/components/ui/utils";

/**
 * Wordmark "DIRETOR IA" em texto vivo (JetBrains Mono): "DIRETOR" + "IA"
 * dentro de um balaozinho de chat estilo mdi-light:message (traco fino,
 * cantos arredondados, rabinho no canto inferior esquerdo). Reproduz o logo
 * estatico com animacao: "DIRETOR" digita (typewriter) e o balao com "IA"
 * entra com "pop".
 *
 * O balao e' um SVG de tamanho fixo (o texto "IA" e' sempre 2 chars mono ->
 * largura constante), com "IA" posicionado por cima (centro do corpo). Cor
 * via currentColor. Os keyframes vivem em app.css (.logo-wordmark* /
 * .logo-ia*). CAIXA ALTA aqui e' excecao de marca (texto literal).
 *
 * Toca a cada refresh: a flag de modulo `played` reseta no reload do bundle.
 * Re-mounts na mesma sessao (ex: expandir a sidebar) renderizam o estado
 * final, sem re-animar.
 *
 * Substitui o antigo <LogoName> (img SVG) no header da sidebar; o LogoName
 * continua existindo pra telas estaticas (ex: JoinPage).
 */
let played = false;

export function LogoWordmark({
  className,
  animate = true,
}: {
  className?: string;
  /** desliga a animação typewriter (ex.: cabeçalho do mobile). */
  animate?: boolean;
}) {
  const [doAnim] = useState(() => animate && !played);
  useEffect(() => {
    played = true;
  }, []);

  return (
    <span
      className={cn(
        "logo-wordmark",
        doAnim && "logo-wordmark-anim",
        className,
      )}
      aria-label="gerentia.app"
    >
      <span className="logo-wordmark-text" aria-hidden="true">
        gerent<span className="logo-ia-accent">ia</span><span className="logo-tld">.app</span>
      </span>
    </span>
  );
}
