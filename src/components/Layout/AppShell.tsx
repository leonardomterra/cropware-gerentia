import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import LayoutDashboard from "~icons/material-symbols-light/space-dashboard-outline";
import ArrowLeftRight from "~icons/material-symbols-light/swap-horiz";
import ReceiptLong from "~icons/material-symbols-light/receipt-long-outline";
import CreditCard from "~icons/material-symbols-light/credit-card-outline";
import FolderOpen from "~icons/material-symbols-light/folder-open-outline";
import Assessment from "~icons/material-symbols-light/summarize-outline";
import SlidersHorizontal from "~icons/material-symbols-light/tune";
import Repeat from "~icons/material-symbols-light/autorenew";
// import Users from "~icons/material-symbols-light/group-outline"; // Equipe desativada (app individual)
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  /** Só pra admin (RBAC). No app individual o dono é admin, então aparecem. */
  adminOnly?: boolean;
}

// Ordem única do menu. adminOnly marca os itens de gestão (Recorrências/
// Configurações) — RBAC preservado p/ multi-usuário futuro; no app individual
// o dono é admin e vê todos.
const NAV_ITEMS: NavItem[] = [
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/recorrencias", label: "Recorrências", icon: Repeat, adminOnly: true },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/relatorios", label: "Relatórios", icon: Assessment },
  { to: "/anexos", label: "Anexos", icon: FolderOpen },
  { to: "/faturas", label: "Faturas", icon: CreditCard },
  { to: "/notas", label: "Notas e Recibos", icon: ReceiptLong },
  { to: "/configuracoes", label: "Configurações", icon: SlidersHorizontal, adminOnly: true },
  // "Fazendas" escondido do menu (CRUD orfao); rota /fazendas segue válida via URL.
  // "Equipe" desativada (app individual); infra de org/RBAC/convites dormente no
  // backend. Rota /equipe segue válida via URL direta.
  // { to: "/equipe", label: "Equipe", icon: Users },
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
    ...NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin),
    ...(isMaster ? MASTER_NAV_ITEMS : []),
  ];

  const breadcrumbSegments = useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path === "") return ["Dashboard"];
    const lookup = [...NAV_ITEMS, ...MASTER_NAV_ITEMS, ACCOUNT_NAV_ITEM].find(
      (it) => path === it.to || path.startsWith(it.to + "/"),
    );
    if (lookup) return [lookup.label];
    const first = path.split("/").filter(Boolean)[0] ?? "";
    const fallback = first.charAt(0).toUpperCase() + first.slice(1);
    return fallback ? [fallback] : [];
  }, [location.pathname]);

  // Título da aba por rota (acessibilidade/histórico). Mantém a marca no fim.
  useEffect(() => {
    const page = breadcrumbSegments[breadcrumbSegments.length - 1];
    document.title = page ? `${page} — gerentia.app` : "gerentia.app";
  }, [breadcrumbSegments]);

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
                  "flex items-center h-9 w-full rounded-md text-sm text-slate-700 hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300",
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
              {/* Rotulo da org escondido (app individual): o nome da org = nome
                  do usuario, redundante com o botao. Reativar com app multi-user. */}
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

      {/* BOTTOM SHEET MOBILE: menu que sobe ACIMA da barra "Menu" (que continua
          visível no rodapé p/ recolher a qualquer momento). O overlay para no
          topo da barra (bottom = altura da barra + safe-area). */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-x-0 top-0 z-[1500]"
          style={{ bottom: "calc(3rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-white shadow-xl animate-sheet-up">
            {/* puxador */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>
            <nav className="px-3 pb-3 pt-1 max-h-[70vh] overflow-y-auto flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : "text-slate-600 hover:bg-slate-50",
                    )
                  }
                >
                  <item.icon className="size-5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <div className="my-1 h-px bg-slate-100" />
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/conta");
                }}
                className="flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <UserCircle className="size-5 shrink-0" />
                Conta
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <HelpCircle className="size-5 shrink-0" />
                Ajuda
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void signOut();
                }}
                className="flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <LogOut className="size-5 shrink-0" />
                Sair
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* COLUNA DE CONTEUDO */}
      <div className="flex flex-col flex-1 min-w-0">
        <ImpersonationBanner />

        {/* DESKTOP: topbar com toggle + breadcrumb */}
        <div className="hidden md:flex items-center h-13 shrink-0 border-b border-slate-200 px-3 gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center justify-center size-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <PageBreadcrumb segments={breadcrumbSegments} embedded />
          </div>
        </div>

        {/* MOBILE: cabeçalho com a logo centralizada (safe-area no topo) */}
        <div
          className="md:hidden flex items-center justify-center shrink-0 border-b border-slate-200 px-3"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            minHeight: "calc(3.25rem + env(safe-area-inset-top, 0px))",
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ ["--logo-size" as string]: "20px" } as CSSProperties}
          >
            <Logo className="h-8 w-auto opacity-80" />
            <LogoWordmark animate={false} className="text-slate-500/80" />
          </div>
        </div>

        {/* MOBILE: sub-cabeçalho com o título da página à esquerda */}
        <div className="md:hidden shrink-0 border-b border-slate-200 px-4 py-2">
          <PageBreadcrumb segments={breadcrumbSegments} embedded />
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

        {/* BOTTOM BAR MOBILE: toggle do menu — fica SEMPRE visível (z acima do
            sheet) p/ recolher a qualquer momento. paddingBottom = home indicator. */}
        <div
          className="md:hidden shrink-0 relative z-[1600] border-t border-slate-200 bg-white"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className={cn(
              "flex items-center justify-center gap-2 w-full h-12 transition-colors",
              mobileOpen
                ? "text-[#f87171] hover:bg-red-50"
                : "text-slate-600 hover:bg-slate-100 active:bg-slate-100",
            )}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            <span className="text-sm font-medium">
              {mobileOpen ? "Fechar" : "Menu"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
