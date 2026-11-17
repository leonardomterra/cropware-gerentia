import { cn } from "./utils";

interface EmptyStateCardProps {
  title: string;
  description?: string;
  /**
   * Dentro de um cartão ou seção (Centros de Custo, Categorias…): sem a
   * altura de meia tela, que lá empurraria o resto para baixo.
   */
  compacto?: boolean;
  className?: string;
}

/** Palavras que ficam em minúsculas no meio do título. */
const CONECTORES = new Set([
  "a",
  "as",
  "o",
  "os",
  "e",
  "ou",
  "de",
  "da",
  "das",
  "do",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "nesta",
  "neste",
  "com",
  "sem",
  "para",
  "por",
]);

/**
 * Title Case em português: "Nenhum plantio nesta safra" → "Nenhum Plantio
 * nesta Safra". Conectores em minúsculas (menos a 1ª palavra) e siglas
 * preservadas ("NDVI" não vira "Ndvi" — por isso não usa o `toSubtitleCase`,
 * que põe tudo em minúsculas antes).
 */
function emTitulo(texto: string): string {
  return texto
    .split(" ")
    .map((p, i) => {
      if (p.length > 1 && p === p.toUpperCase() && /\p{L}/u.test(p)) return p;
      const min = p.toLowerCase();
      if (i > 0 && CONECTORES.has(min)) return min;
      return min.charAt(0).toUpperCase() + min.slice(1);
    })
    .join(" ");
}

/**
 * Estado vazio padrão — o "nada aqui" das listas. Use SEMPRE este componente,
 * para manter consistência.
 *
 * Desde 17/11/2026: SEM card e SEM ícone, direto na tela e centralizado
 * também na vertical (a área livre abaixo da barra de filtros); título em
 * Title Case, `slate-700`; a explicação numa linha só a partir de xl
 * (abaixo quebra, para não vazar), `slate-500`. Antes era uma faixa
 * cinza-clara num card logo abaixo da barra, em `slate-400`/`slate-300`, que
 * lia como aviso apagado. O nome ficou "Card" para não mexer nas telas.
 */
export function EmptyStateCard({
  title,
  description,
  compacto = false,
  className,
}: EmptyStateCardProps) {
  return (
    <div
      className={cn(
        "w-full flex flex-col items-center justify-center text-center px-6",
        // Ocupa a área livre até o fim da tela (descontados cabeçalho, barra
        // de filtros e margens ≈ 16rem), para o centro cair no meio do vazio.
        compacto ? "py-10" : "min-h-[40vh] sm:min-h-[calc(100dvh-16rem)] py-12",
        className,
      )}
    >
      <p className="text-base font-medium text-slate-700">{emTitulo(title)}</p>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-slate-500 xl:max-w-none xl:whitespace-nowrap">
          {description}
        </p>
      )}
    </div>
  );
}
