import type { ComponentType, SVGProps } from "react";

/**
 * A ação principal de uma seção, entregue ao HUB que a hospeda.
 *
 * POR QUE existe: o botão de ação mora na barra do hub, ao lado do "Voltar" —
 * uma linha inteira só para ele empurraria a lista para baixo sem informar
 * nada. Mas quem SABE o que a ação faz é a seção, não o hub.
 *
 * Nasceu como uma função nua (`() => void`), com o hub escrevendo o rótulo. Foi
 * suficiente enquanto só uma seção registrava; com duas, o hub passaria a ter um
 * `if` por seção só para decidir o texto do botão — e erraria em silêncio na
 * terceira. O rótulo, o ícone e o estado desligado viajam junto com a ação.
 */
export interface AcaoDeSecao {
  rotulo: string;
  /** Versão curta para telas estreitas. Sem ela, usa `rotulo`. */
  rotuloCurto?: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Some com o botão quem não pode agir; DESLIGA quem não pode agir AGORA. */
  desabilitado?: boolean;
  executar: () => void;
}
