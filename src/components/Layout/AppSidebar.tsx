import { type ComponentType, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/components/ui/utils";

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
 * Navegação principal do desktop: uma coluna com **ícone e nome** de cada
 * página.
 *
 * Até 17/11/2026 era só ícone (64px), com o nome num tooltip. Com o módulo
 * Field o trilho passou de 11 para ~20 telas, e ícone sozinho virou navegação
 * por tentativa; o nome visível resolve sem o passo do tooltip.
 *
 * A **cor** continua: cada página tem a sua, em duotone (o segundo tom a 20%,
 * então se lê um glifo colorido, não um bloco chapado). É apoio para achar de
 * relance; quem diz o nome é o texto, e o fundo marca a página aberta.
 */
export function AppSidebar({
  itens,
  footer,
  topo,
}: {
  itens: RailItem[];
  footer?: ReactNode;
  /** Acima dos ícones: o seletor de módulo, quando há mais de um (AppShell). */
  topo?: ReactNode;
}) {
  return (
    <>
      {topo && (
        <div className="shrink-0 px-2 pt-2 pb-1 border-b border-slate-100">
          {topo}
        </div>
      )}
      <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-0.5">
        {itens.map((it) => (
          <div key={it.to}>
            {it.separadorAntes && (
              <div aria-hidden className="my-2 h-px bg-slate-100" />
            )}
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-slate-200 text-slate-900 font-medium"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )
              }
            >
              <it.Icon className={cn("size-5 shrink-0", it.cor)} />
              <span className="truncate">{it.label}</span>
              {it.badge ? (
                <span className="ml-auto shrink-0 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 text-center tabular-nums">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              ) : null}
            </NavLink>
          </div>
        ))}
      </nav>

      {footer && (
        <div className="shrink-0 border-t border-slate-200 p-2">{footer}</div>
      )}
    </>
  );
}
