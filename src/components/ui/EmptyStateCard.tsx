import type { ComponentType } from "react";
import { cn } from "./utils";

interface EmptyStateCardProps {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  /**
   * Dentro de um cartão ou seção (Centros de Custo, Categorias…): sem a
   * altura de meia tela, que lá empurraria o resto para baixo.
   */
  compacto?: boolean;
  className?: string;
}

/**
 * Estado vazio padrão — o "nada aqui" das listas. Use SEMPRE este componente,
 * para manter consistência.
 *
 * Desde 17/11/2026 SEM card: direto na tela, centralizado também na vertical
 * (a área livre abaixo da barra de filtros), com ícone maior e texto um
 * degrau mais escuro. Antes era uma faixa cinza-clara num card logo abaixo da
 * barra, em `slate-400`/`slate-300`, que lia como aviso apagado. O nome
 * ficou "Card" para não mexer nas 18 telas que o usam.
 */
export function EmptyStateCard({
  title,
  description,
  icon: IconComponent,
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
      {IconComponent && (
        <IconComponent
          className={cn(
            "shrink-0 text-slate-400",
            compacto ? "size-7 mb-2" : "size-10 mb-3",
          )}
        />
      )}
      <p className="text-base font-medium text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}
