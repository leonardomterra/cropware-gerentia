import type { ComponentType } from "react";

interface EmptyStateCardProps {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Estado vazio padrão (compacto): card slate-50 com ícone + título e uma
 * descrição opcional. Use SEMPRE este componente pros "nada aqui" das listas/
 * managers, pra manter consistência.
 */
export function EmptyStateCard({ title, description, icon: IconComponent }: EmptyStateCardProps) {
  return (
    <div className="w-full rounded-lg border border-slate-200 bg-slate-50 py-4 px-5 flex items-center justify-center gap-2 text-center">
      {IconComponent && <IconComponent className="size-4 shrink-0 text-slate-400" />}
      <p className="text-sm text-slate-400">
        {title}
        {description && <span className="text-slate-300"> — {description}</span>}
      </p>
    </div>
  );
}
