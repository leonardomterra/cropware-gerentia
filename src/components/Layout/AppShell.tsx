import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import LayoutDashboard from "~icons/ph/squares-four";
import ArrowLeftRight from "~icons/ph/arrows-left-right";
import ReceiptLong from "~icons/ph/receipt";
import CreditCard from "~icons/ph/credit-card";
import FolderOpen from "~icons/ph/folder-open";
import Assessment from "~icons/ph/file-text";
import SlidersHorizontal from "~icons/ph/sliders-horizontal";
import Repeat from "~icons/ph/arrows-clockwise";
import Checklist from "~icons/ph/list-checks";
import NotificationsIcon from "~icons/ph/bell";
import Users from "~icons/ph/users";
import ManageAccounts from "~icons/ph/user-gear";
import Domain from "~icons/ph/buildings";
// Duotone, um por página, no trilho do desktop. Duotone e não sólido: o segundo
// tom entra a 20% de opacidade, então a coluna lê como glifo colorido sobre
// lavagem clara — sólidos, 13 matizes empilhados virariam confete.
import RailDashboard from "~icons/ph/squares-four-duotone";
import RailLancamentos from "~icons/ph/arrows-left-right-duotone";
import RailNotas from "~icons/ph/receipt-duotone";
import RailFaturas from "~icons/ph/credit-card-duotone";
import RailRecorrencias from "~icons/ph/arrows-clockwise-duotone";
import RailRelatorios from "~icons/ph/file-text-duotone";
import RailAnexos from "~icons/ph/folder-open-duotone";
import RailPendencias from "~icons/ph/list-checks-duotone";
import RailNotificacoes from "~icons/ph/bell-duotone";
import RailConfiguracoes from "~icons/ph/sliders-horizontal-duotone";
import RailEquipe from "~icons/ph/users-duotone";
import RailUsuarios from "~icons/ph/user-gear-duotone";
import RailOrganizacoes from "~icons/ph/buildings-duotone";
import UserCircle from "~icons/ph/user-circle";
// Duotone e em cor própria só no gatilho da CONTA: ele é o único item do
// trilho que não leva a uma tela de trabalho — leva a você. O segundo tom e o
// teal (que não é usado por nenhum estado do app) o separam da fileira de
// ícones sem precisar de rótulo, que ali não cabe.
import UserCircleDuotone from "~icons/ph/user-circle-duotone";
import LogOut from "~icons/ph/sign-out";
import HelpCircle from "~icons/ph/question";
import Menu from "~icons/ph/list";
import X from "~icons/ph/x";
import { ROLE_LABELS, useAuth } from "@/contexts/AuthContext";
import { AppSidebar, type RailItem } from "./AppSidebar";
import { useNotifications } from "@/modules/notifications/hooks/useNotifications";
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
  /** So aparece em organizacao com equipe (kind=company). */
  teamOnly?: boolean;
  /** Some pro convidado (perfil somente-leitura). */
  hideForViewer?: boolean;
  /** Liga um contador dinâmico ao item. O array é constante de módulo, então o
   *  número é resolvido no AppShell (via hook). */
  badgeKey?: "notifications";
}

// Ordem única do menu.
//   adminOnly      gestão da organização (Configurações, Equipe)
//   teamOnly       só faz sentido em org com equipe (kind=company)
//   hideForViewer  cria/edita dado — o convidado não vê
// Ver docs/ORGANIZACOES-E-PERFIS.md §2.
const NAV_ITEMS: NavItem[] = [
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  {
    to: "/recorrencias",
    label: "Recorrências",
    icon: Repeat,
    hideForViewer: true,
  },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pendencias", label: "Pendências", icon: Checklist },
  {
    to: "/notificacoes",
    label: "Notificações",
    icon: NotificationsIcon,
    badgeKey: "notifications",
  },
  { to: "/relatorios", label: "Relatórios", icon: Assessment },
  { to: "/anexos", label: "Anexos", icon: FolderOpen },
  { to: "/faturas", label: "Faturas", icon: CreditCard },
  { to: "/notas", label: "Notas e Recibos", icon: ReceiptLong },
  {
    to: "/configuracoes",
    label: "Configurações",
    icon: SlidersHorizontal,
    adminOnly: true,
  },
  {
    to: "/equipe",
    label: "Equipe",
    icon: Users,
    adminOnly: true,
    teamOnly: true,
  },
  // "Fazendas" escondido do menu (CRUD orfao); rota /fazendas segue válida via URL.
];

// Só-master (allowlist MASTER_EMAILS): gestão de plataforma de todos os usuários.
const MASTER_NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Usuários", icon: ManageAccounts, end: true },
  { to: "/admin/organizacoes", label: "Organizações", icon: Domain },
];

// Conta NAO entra no nav principal - fica no menu do usuario (rodape).
// A constante e' mantida pro breadcrumb resolver /conta -> "Conta".
const ACCOUNT_NAV_ITEM: NavItem = {
  to: "/conta",
  label: "Conta",
  icon: UserCircle,
};

/**
 * O trilho do desktop: **um ícone por página**, com cor e tooltip próprios.
 *
 * Este mapa é o botão de ajuste — ordem e cor se editam aqui, sem tocar em
 * componente nenhum. Rota fora do mapa não entra no trilho.
 *
 * Sobre a paleta: cada página tem seu matiz, e nenhum se repete no bloco de
 * cima. Os do master ficam abaixo de uma divisória. A cor é APOIO, nunca o
 * código — quem diz o nome é o tooltip.
 */
const RAIL_ICONES: Record<string, { Icon: NavItem["icon"]; cor: string }> = {
  "/": { Icon: RailDashboard, cor: "text-sky-600" },
  "/lancamentos": { Icon: RailLancamentos, cor: "text-indigo-600" },
  "/notas": { Icon: RailNotas, cor: "text-amber-600" },
  "/faturas": { Icon: RailFaturas, cor: "text-violet-600" },
  "/recorrencias": { Icon: RailRecorrencias, cor: "text-cyan-600" },
  "/relatorios": { Icon: RailRelatorios, cor: "text-blue-600" },
  "/anexos": { Icon: RailAnexos, cor: "text-orange-600" },
  "/pendencias": { Icon: RailPendencias, cor: "text-emerald-600" },
  "/notificacoes": { Icon: RailNotificacoes, cor: "text-rose-600" },
  "/configuracoes": { Icon: RailConfiguracoes, cor: "text-slate-600" },
  "/equipe": { Icon: RailEquipe, cor: "text-purple-600" },
  "/admin": { Icon: RailUsuarios, cor: "text-fuchsia-600" },
  "/admin/organizacoes": { Icon: RailOrganizacoes, cor: "text-stone-600" },
};

/** Ordem do trilho. */
const RAIL_ORDEM = [
  "/",
  "/lancamentos",
  "/notas",
  "/faturas",
  "/recorrencias",
  "/relatorios",
  "/anexos",
  "/pendencias",
  "/notificacoes",
  "/configuracoes",
  "/equipe",
  "/admin",
  "/admin/organizacoes",
];

/** Link de navegacao da sidebar. Icone sempre; label some quando colapsada. */
export function AppShell() {
  const { user, signOut, isAdmin, isMaster, isViewer, isTeamOrg } = useAuth();
  // Contador vem do NotificationsProvider (envolve o AppShell em App.tsx), o
  // mesmo estado que a página lê — marcar lida lá atualiza o badge aqui.
  const { unread } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  // Colapso (desktop) persistido. Drawer (mobile) e' estado efemero.

  // Fecha o drawer ao trocar de rota (mobile).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // RevenueCat: liga a assinatura ao usuário logado. No-op fora do app nativo ou
  // sem a API key (ver src/lib/revenuecat.ts). Import dinâmico p/ não pesar o web.
  useEffect(() => {
    if (!user?.id) return;
    import("@/lib/revenuecat")
      .then((m) => m.identifyRevenueCatUser(user.id).catch(() => {}))
      .catch(() => {});
  }, [user?.id]);

  const navItems: NavItem[] = [
    ...NAV_ITEMS.filter(
      (i) =>
        (!i.adminOnly || isAdmin) &&
        (!i.teamOnly || isTeamOrg) &&
        (!i.hideForViewer || !isViewer),
    ),
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
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * Gatilho da conta — o rodapé do trilho. Icone só: a coluna tem 64px, e o
   * nome do usuário mora dentro do próprio menu (junto da organização e do
   * perfil, que é o que explica ver ou não ver o dado dos colegas).
   */
  const accountTrigger = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={user?.fullName || user?.email || "Conta"}
          // Mesma medida dos itens do trilho (h-10 / ícone size-6): ele fecha
          // a mesma coluna, e menor lia como um botão de outra categoria.
          className="flex items-center justify-center size-10 rounded-md text-teal-600 hover:bg-slate-200 hover:text-teal-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
        >
          <UserCircleDuotone className="size-6 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-56"
      >
        {/* Em org com equipe o usuario precisa saber ONDE esta e COM QUE
              perfil — e' o que explica ver (ou nao ver) o dado dos colegas.
              No assinante avulso isso e' redundante e fica escondido. */}
        {isTeamOrg && (
          <>
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-slate-900 truncate">
                {user?.organizationName}
              </p>
              <p className="text-[11px] text-slate-500">
                {user ? ROLE_LABELS[user.role] : ""}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}
        {/* Sem ícones: são três palavras curtas, e o ícone ali não distingue
            nada — só repete o rótulo. (Nos menus de ORDENAR eles ficam, porque
            lá separam critérios parecidos.) */}
        <DropdownMenuItem onSelect={() => navigate("/conta")}>
          Conta
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => {}}>Ajuda</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onSelect={() => void signOut()}>
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /** Itens do trilho, na ordem do mapa e já filtrados por papel — página que o
   *  usuário não pode ver não ganha ícone. */
  const railItens: RailItem[] = RAIL_ORDEM.map<RailItem | null>((rota) => {
    const item = navItems.find((i) => i.to === rota);
    const visual = RAIL_ICONES[rota];
    if (!item || !visual) return null;
    return {
      to: item.to,
      label: item.label,
      Icon: visual.Icon,
      cor: visual.cor,
      end: item.end,
      badge: item.badgeKey === "notifications" ? unread : 0,
      // Divisória separando o bloco do master do app do cliente.
      separadorAntes: rota === "/admin",
    };
  }).filter((i): i is RailItem => !!i);

  return (
    <div className="flex overflow-hidden bg-white" style={{ height: "100dvh" }}>
      {/* TRILHO DESKTOP — coluna de ícones, sem recolher (ver AppSidebar). */}
      <aside className="hidden md:flex flex-col shrink-0 w-16 h-full min-h-0 border-r border-slate-200 bg-white">
        {/* A divisória é a BORDA deste bloco, e não uma div à parte, para
            fechar na mesma linha do topbar ao lado.
            Antes: h-13 (52px) + uma div de 1px = 53px, enquanto o topbar tem
            h-13 COM a borda por dentro (box-border) = 52px. A régua da esquerda
            ficava 1px abaixo da da direita — e ainda em outro tom
            (slate-100 x slate-200), então as duas liam como linhas diferentes. */}
        <div className="flex items-center justify-center h-13 shrink-0 border-b border-slate-200">
          <Logo className="h-6 w-auto opacity-80" />
        </div>
        <AppSidebar itens={railItens} footer={accountTrigger} />
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
          <div className="absolute inset-x-0 bottom-0 bg-slate-100 shadow-xl animate-sheet-up">
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
                        ? "text-slate-900 font-semibold"
                        : "text-slate-600 hover:bg-slate-200",
                    )
                  }
                >
                  <item.icon className="size-5 shrink-0" />
                  <span>{item.label}</span>
                  {/* A gaveta desenha o item com markup próprio. */}
                  {item.badgeKey === "notifications" && unread > 0 && (
                    <span className="ml-auto shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-medium tabular-nums">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </NavLink>
              ))}
              <div className="my-1 h-px bg-slate-100" />
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/conta");
                }}
                className="flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <UserCircle className="size-5 shrink-0" />
                Conta
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-200 transition-colors"
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
                className="flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-200 transition-colors"
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

        {/* Convidado: deixa claro por que nao existe botao de criar/editar. */}
        {isViewer && (
          <div className="shrink-0 bg-purple-50 border-b border-purple-200 px-4 py-2 text-center text-xs text-purple-900">
            Você está como <strong>Convidado</strong> em{" "}
            {user?.organizationName} — acesso de consulta, sem cadastrar ou
            alterar lançamentos.
          </div>
        )}

        {/* DESKTOP: topbar com toggle + breadcrumb */}
        <div className="hidden md:flex items-center h-13 shrink-0 border-b border-slate-200 px-3 gap-2">
          <div className="flex-1 min-w-0">
            <PageBreadcrumb segments={breadcrumbSegments} embedded />
          </div>
        </div>

        {/* MOBILE: cabeçalho com a logo centralizada (safe-area no topo) */}
        <div
          className="md:hidden flex items-center justify-center shrink-0 border-b border-slate-200 px-3 bg-slate-100"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            minHeight: "calc(3.25rem + env(safe-area-inset-top, 0px))",
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ ["--logo-size" as string]: "22px" } as CSSProperties}
          >
            <Logo className="h-6 w-auto opacity-80" />
            <LogoWordmark animate={false} className="text-slate-500/80" />
          </div>
        </div>

        {/* MOBILE: sub-cabeçalho com o título da página à esquerda (fundo branco). */}
        <div className="md:hidden shrink-0 border-b border-slate-200 px-4 py-2.5 flex items-center">
          <span className="text-[16px] font-medium text-slate-500">
            {breadcrumbSegments[breadcrumbSegments.length - 1] ?? ""}
          </span>
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
          className="md:hidden shrink-0 relative z-[1600] border-t border-slate-200 bg-slate-100"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className={cn(
              "flex items-center justify-center gap-2 w-full h-12 transition-colors",
              mobileOpen
                ? "text-[#f87171] hover:bg-red-50"
                : "text-slate-600 hover:bg-slate-200 active:bg-slate-200",
            )}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="size-5" />
            ) : (
              // Dot de não-lidas: no mobile o badge do item vive dentro do
              // sheet, que fica fechado — sem isso o aviso seria invisível.
              <span className="relative inline-flex">
                <Menu className="size-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500" />
                )}
              </span>
            )}
            <span className="text-sm font-medium">
              {mobileOpen ? "Fechar" : "Menu"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
