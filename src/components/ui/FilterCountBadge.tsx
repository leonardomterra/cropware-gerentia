import { BADGE_BOTAO_BARRA } from "@/lib/ui-tokens";
import { cn } from "./utils";

/**
 * Contador de filtros ativos, dentro do botão "Filtros".
 *
 * O espaço dele é SEMPRE reservado — em zero ele fica invisível, não removido.
 * Renderizar sob condição fazia o botão crescer e encolher a cada filtro
 * aplicado, empurrando os vizinhos de lugar: você aplicava um filtro e a barra
 * inteira andava. Um botão que muda de largura também move o próprio alvo de
 * clique entre uma interação e a seguinte.
 *
 * `invisible` (e não `hidden`) é o que mantém a caixa ocupando o espaço.
 * `aria-hidden` em zero evita que o leitor de tela anuncie um "0" que não está
 * na tela.
 *
 * Conte só os filtros DE DENTRO do painel: contar os que estão à vista na barra
 * faria o número anunciar o que já se vê.
 */
export function FilterCountBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden={count === 0}
      className={cn(BADGE_BOTAO_BARRA, count === 0 && "invisible")}
    >
      {count || 0}
    </span>
  );
}
