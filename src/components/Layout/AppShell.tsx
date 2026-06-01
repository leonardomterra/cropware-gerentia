import { useEffect, useMemo, useState, type ComponentType } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LogOut,
  Wifi,
  WifiOff,
  Building2,
  HelpCircle,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo, LogoName } from "@/components/Logo";
import { PageBreadcrumb } from "@/components/Layout/PageBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/lancamentos", label: "Lançamentos" },
  // "Fazendas" escondido do menu em 2026-05-30 - hoje e' um CRUD orfao
  // (farm_id nao e' usado em form de lancamento nem filtro). Rota
  // /fazendas continua valida pra acesso direto via URL. Voltar quando
  // tiver justificativa (usuario com 2+ fazendas pedindo segmentacao).
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/configuracoes", label: "Configurações" },
  { to: "/recorrencias", label: "Recorrências" },
  { to: "/equipe", label: "Equipe" },
];

const ACCOUNT_NAV_ITEM: NavItem = { to: "/conta", label: "Conta" };

/**
 * Botao de acao do header (branco). Outline slate: borda slate-200,
 * texto slate-700, hover slate-50. Combina com header claro.
 */
function GlassButton({
  icon: Icon,
  label,
  onClick,
  iconOnly = false,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  iconOnly?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded h-8 text-[14px] font-normal text-slate-700 bg-white border border-slate-200 transition-colors active:scale-95 hover:bg-slate-50",
        iconOnly ? "w-8" : "px-3",
      )}
    >
      <Icon className="size-3.5" />
      {iconOnly ? null : <span>{label}</span>}
    </button>
  );
}

function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function AppShell() {
  const { user, signOut, isAdmin } = useAuth();
  const online = useOnline();
  const location = useLocation();
  const navItems: NavItem[] = [
    ...BASE_NAV_ITEMS,
    ...(isAdmin ? ADMIN_NAV_ITEMS : []),
    ACCOUNT_NAV_ITEM,
  ];

  // Breadcrumb auto baseado na rota atual. NAV_ITEMS define o label; pra
  // rotas escondidas (ex: /fazendas) ou desconhecidas usa um fallback do
  // primeiro segmento do path.
  const breadcrumbSegments = useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path === "") return ["Cropware Farm", "Dashboard"];
    const lookup = [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS, ACCOUNT_NAV_ITEM]
      .find((it) => path === it.to || path.startsWith(it.to + "/"));
    if (lookup) return ["Cropware Farm", lookup.label];
    const first = path.split("/").filter(Boolean)[0] ?? "";
    const fallback = first.charAt(0).toUpperCase() + first.slice(1);
    return fallback ? ["Cropware Farm", fallback] : ["Cropware Farm"];
  }, [location.pathname]);

  return (
    <div
      className="flex flex-col overflow-hidden bg-white"
      style={{ height: "100dvh" }}
    >
      {/* HEADER (branco) */}
      <header className="shadow-none bg-white">
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile - simbolo + wordmark CROPWARE FARM */}
          <div className="flex md:hidden items-center justify-between min-h-9">
            <div className="flex items-center gap-2">
              <Logo className="h-7 w-auto shrink-0" />
              <LogoName className="h-5 w-auto shrink-0" />
            </div>
            <div className="flex items-center gap-2">
              <GlassButton
                icon={HelpCircle}
                label="Ajuda"
                iconOnly
                onClick={() => {}}
              />
              <GlassButton
                icon={LogOut}
                label="Sair"
                iconOnly
                onClick={() => void signOut()}
              />
            </div>
          </div>

          {/* Desktop - lockup simbolo + wordmark CROPWARE FARM (sem tagline) */}
          <div className="hidden md:flex items-center justify-between min-h-12">
            <div className="flex items-center gap-2.5">
              <Logo className="h-9 w-auto shrink-0" />
              <LogoName className="h-6 w-auto shrink-0" />
            </div>

            {/* Lado direito - so glass buttons. Nome do usuario foi
                pro sub-header como Badge (espelho do CDM, 2026-05-30).
                Configuracoes saiu daqui pro tab Conta. */}
            <div className="flex items-center gap-3">
              <GlassButton
                icon={HelpCircle}
                label="Ajuda"
                onClick={() => {}}
              />
              <GlassButton
                icon={LogOut}
                label="Sair"
                onClick={() => void signOut()}
              />
            </div>
          </div>
        </div>
      </header>

      {/* SUB-HEADER status bar (branco, separado do header por borda fina) */}
      <div className="bg-white border-t border-slate-100">
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-2">
          <div className="flex flex-col md:flex-row md:justify-end items-stretch md:items-center gap-2">
            {/* Badge do usuario logado - empurrado pra esquerda no desktop
                via md:mr-auto (padrao CDM). Stack em cima no mobile. */}
            {user ? (
              <Badge
                className="gap-1.5 px-2.5 py-1 justify-center md:justify-start md:mr-auto"
                style={{
                  backgroundColor: "transparent",
                  color: "#475569",
                  borderColor: "transparent",
                }}
              >
                <User className="size-3.5 shrink-0" />
                <span className="truncate max-w-[160px]">
                  {user.fullName || user.email}
                </span>
              </Badge>
            ) : null}
            {user?.organizationName ? (
              <Badge
                className="gap-1.5 px-2.5 py-1 justify-center md:justify-start"
                style={{
                  backgroundColor: "transparent",
                  color: "#475569",
                  borderColor: "transparent",
                }}
              >
                <Building2 className="size-3.5" />
                <span className="truncate max-w-[150px]">
                  {user.organizationName}
                </span>
              </Badge>
            ) : null}
            <Badge
              className="gap-1.5 px-2.5 py-1 justify-center md:justify-start"
              style={{
                // online: discreto (slate). offline: vermelho pra alertar.
                backgroundColor: online ? "transparent" : "#fef2f2",
                color: online ? "#475569" : "#b91c1c",
                borderColor: online ? "transparent" : "#fecaca",
              }}
            >
              {online ? (
                <Wifi className="size-3.5" />
              ) : (
                <WifiOff className="size-3.5" />
              )}
              <span>{online ? "Online" : "Offline"}</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* TAB BAR - tabs dividem a largura igualmente (flex-1), sem icone.
          border-t separa do sub-header branco (antes era contraste de cor). */}
      <div className="bg-white border-t border-b border-slate-200">
        <div className="max-w-[1600px] w-full mx-auto flex h-12 items-stretch">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex-1 flex items-center justify-center px-3 h-12 whitespace-nowrap text-sm transition-colors",
                  isActive
                    ? "text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                )
              }
              style={({ isActive }) =>
                isActive ? { backgroundColor: "#475569" } : undefined
              }
            >
              {({ isActive }) => (
                <>
                  <span>{item.label}</span>
                  {isActive ? (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: "#334155" }}
                    />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* BREADCRUMB - "Cropware Farm > <label da rota>". Espelho do CDM. */}
      <PageBreadcrumb segments={breadcrumbSegments} />

      {/* MAIN - flex-1 + min-h-0 garante que o overflow-y-auto ativa
          (sem min-h-0, flex item tem min-height: auto = content size,
          main expande junto com conteudo e scroll interno nunca aciona).
          Padrao CDM (App.tsx data-app-scroll-container). */}
      <main
        className="flex-1 w-full min-h-0 overflow-y-auto"
        data-app-scroll-container
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          // Reserva o espaco do scrollbar permanentemente. Sem isso, o
          // scroll aparece/some conforme a quantidade de conteudo e
          // a pagina "espreme/desespreme" 15px. Com stable, o scroll
          // continua aparecendo so quando ha overflow, mas a largura
          // util do conteudo nunca muda.
          scrollbarGutter: "stable",
        }}
      >
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
