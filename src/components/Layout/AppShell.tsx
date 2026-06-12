import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import LayoutDashboard from "~icons/material-symbols-light/space-dashboard-outline";
import ArrowLeftRight from "~icons/material-symbols-light/swap-horiz";
import SlidersHorizontal from "~icons/material-symbols-light/tune";
import Repeat from "~icons/material-symbols-light/autorenew";
import Users from "~icons/material-symbols-light/group-outline";
import ManageAccounts from "~icons/material-symbols-light/manage-accounts-outline";
import UserCircle from "~icons/material-symbols-light/account-circle-outline";
import LogOut from "~icons/material-symbols-light/logout";
import HelpCircle from "~icons/material-symbols-light/help-outline";
import UnfoldMore from "~icons/material-symbols-light/unfold-more";
import PanelLeftClose from "~icons/material-symbols-light/left-panel-close-outline";
import PanelLeftOpen from "~icons/material-symbols-light/left-panel-open-outline";
import Menu from "~icons/material-symbols-light/menu";
import X from "~icons/material-symbols-light/close";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { LogoWordmark } from "@/components/LogoWordmark";
import { PageBreadcrumb } from "@/components/Layout/PageBreadcrumb";
import { ImpersonationBanner } from "@/modules/admin/components/ImpersonationBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  // "Fazendas" escondido do menu (CRUD orfao). Rota /fazendas continua
  // valida pra acesso direto via URL.
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/configuracoes", label: "Configurações", icon: SlidersHorizontal },
  { to: "/recorrencias", label: "Recorrências", icon: Repeat },
  { to: "/equipe", label: "Equipe", icon: Users },
];

// Só-master (allowlist MASTER_EMAILS): gestão de plataforma de todos os usuários.
const MASTER_NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Usuários", icon: ManageAccounts },
];

// Conta NAO entra no nav principal - fica no menu do usuario (rodape).
// A constante e' mantida pro breadcrumb resolver /conta -> "Conta".
const ACCOUNT_NAV_ITEM: NavItem = {
  to: "/conta",
  label: "Conta",
  icon: UserCircle,
};

const COLLAPSED_KEY = "farm:sidebar:collapsed";

/** Link de navegacao da sidebar. Icone sempre; label some quando colapsada. */
function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 h-9 rounded-md text-sm transition-colors",
          collapsed ? "justify-center px-0 w-9 mx-auto" : "px-2.5",
          isActive
            ? "bg-white text-slate-900 font-medium shadow-sm"
            : "text-slate-600 hover:bg-slate-200 hover:text-slate-900",
        )
      }
    >
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

export function AppShell() {
  const { user, signOut, isAdmin, isMaster } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Colapso (desktop) persistido. Drawer (mobile) e' estado efemero.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Fecha o drawer ao trocar de rota (mobile).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navItems: NavItem[] = [
    ...BASE_NAV_ITEMS,
    ...(isAdmin ? ADMIN_NAV_ITEMS : []),
    ...(isMaster ? MASTER_NAV_ITEMS : []),
  ];

  const breadcrumbSegments = useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path === "") return ["Dashboard"];
    const lookup = [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS, ...MASTER_NAV_ITEMS, ACCOUNT_NAV_ITEM].find(
      (it) => path === it.to || path.startsWith(it.to + "/"),
    );
    if (lookup) return [lookup.label];
    const first = path.split("/").filter(Boolean)[0] ?? "";
    const fallback = first.charAt(0).toUpperCase() + first.slice(1);
    return fallback ? [fallback] : [];
  }, [location.pathname]);

  // Conteudo da sidebar (reusado no desktop fixo + drawer mobile).
  // `inDrawer` força full (nao colapsado) no mobile.
  const renderSidebar = (inDrawer: boolean) => {
    const isCollapsed = inDrawer ? false : collapsed;
    return (
      <div className="flex flex-col h-full bg-slate-100">
        {/* Topo: logo */}
        <div
          className={cn(
            "flex items-center h-13 shrink-0 border-b border-slate-100",
            isCollapsed ? "justify-center px-2" : "px-3 gap-2",
          )}
        >
          {isCollapsed ? (
            <Logo className="h-7 w-auto opacity-80" />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <Logo className="h-7 w-auto shrink-0 opacity-80" />
              <LogoWordmark className="text-slate-500/80 ml-1" />
            </div>
          )}
          {inDrawer && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="ml-auto inline-flex items-center justify-center size-8 rounded-md text-slate-500 hover:bg-slate-200"
              aria-label="Fechar menu"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Navegacao */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => (
            <NavRow
              key={item.to}
              item={item}
              collapsed={isCollapsed}
              onNavigate={inDrawer ? () => setMobileOpen(false) : undefined}
            />
          ))}
        </nav>

        {/* Rodape: nome do usuario -> menu (Conta / Ajuda / Sair) */}
        <div className="shrink-0 border-t border-slate-100 p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={user?.fullName || user?.email || "Conta"}
                className={cn(
                  "flex items-center h-9 w-full rounded-md text-sm text-slate-700 hover:bg-slate-200 transition-colors outline-none",
                  isCollapsed ? "justify-center" : "gap-2 px-2.5",
                )}
              >
                {isCollapsed ? (
                  <UserCircle className="size-5 shrink-0 text-slate-500" />
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-left font-medium">
                      {user?.fullName || user?.email}
                    </span>
                    <UnfoldMore className="size-4 shrink-0 text-slate-400" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={6}
              className="w-56"
            >
              {user?.organizationName ? (
                <>
                  <DropdownMenuLabel className="font-normal text-slate-400 truncate">
                    {user.organizationName}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem onSelect={() => navigate("/conta")}>
                <UserCircle className="size-4" />
                Conta
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {}}>
                <HelpCircle className="size-4" />
                Ajuda
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex overflow-hidden bg-white"
      style={{ height: "100dvh" }}
    >
      {/* SIDEBAR DESKTOP (fixa, colapsavel) */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 border-r border-slate-200 transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {renderSidebar(false)}
      </aside>

      {/* DRAWER MOBILE */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[1500]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
            {renderSidebar(true)}
          </div>
        </div>
      )}

      {/* COLUNA DE CONTEUDO */}
      <div className="flex flex-col flex-1 min-w-0">
        <ImpersonationBanner />
        {/* Topbar fina: toggle (desktop) / menu (mobile) + breadcrumb */}
        <div className="flex items-center h-13 shrink-0 border-b border-slate-200 px-2 sm:px-3 gap-1">
          {/* Desktop: colapsar/expandir */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:inline-flex items-center justify-center size-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
          {/* Mobile: abrir drawer */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden inline-flex items-center justify-center size-8 rounded-md text-slate-500 hover:bg-slate-100"
            aria-label="Abrir menu"
          >
            <Menu className="size-4" />
          </button>

          <div className="flex-1 min-w-0">
            <PageBreadcrumb segments={breadcrumbSegments} embedded />
          </div>
        </div>

        {/* MAIN - scroll vive aqui (min-h-0 + overflow-y-auto). */}
        <main
          className="flex-1 w-full min-h-0 overflow-y-auto"
          data-app-scroll-container
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorY: "contain",
            scrollbarGutter: "stable",
          }}
        >
          <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
