import { useEffect, useMemo, useState, type ComponentType } from "react";
import { openExternalUrl } from "@/utils/nativeExport";
import { LINKS_LEGAIS } from "@/components/auth/linksLegais";
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
import CalendarDots from "~icons/ph/calendar-dots";
import RailCalendario from "~icons/ph/calendar-dots-fill";
import NotificationsIcon from "~icons/ph/bell";
import Users from "~icons/ph/users";
import ManageAccounts from "~icons/ph/user-gear";
import Domain from "~icons/ph/buildings";
// Duotone, um por página, no trilho do desktop. Duotone e não sólido: o segundo
// tom entra a 20% de opacidade, então a coluna lê como glifo colorido sobre
// lavagem clara — sólidos, 13 matizes empilhados virariam confete.
import RailDashboard from "~icons/ph/squares-four-fill";
import RailLancamentos from "~icons/ph/arrows-left-right-fill";
import RailNotas from "~icons/ph/receipt-fill";
import RailCartoes from "~icons/ph/credit-card-fill";
import RailRecorrencias from "~icons/ph/arrows-clockwise-fill";
import RailRelatorios from "~icons/ph/file-text-fill";
import RailAnexos from "~icons/ph/folder-open-fill";
import RailPendencias from "~icons/ph/list-checks-fill";
import RailNotificacoes from "~icons/ph/bell-fill";
import RailConfiguracoes from "~icons/ph/sliders-horizontal-fill";
import RailEquipe from "~icons/ph/users-fill";
import RailUsuarios from "~icons/ph/user-gear-fill";
import RailOrganizacoes from "~icons/ph/buildings-fill";
import RailTalhoes from "~icons/ph/plant-fill";
import RailFazendas from "~icons/ph/barn-fill";
import RailProdutores from "~icons/ph/user-list-fill";
import Plant from "~icons/ph/plant";
import Barn from "~icons/ph/barn";
import UserList from "~icons/ph/user-list";
import Grains from "~icons/ph/grains";
import ClipboardText from "~icons/ph/clipboard-text";
import ChartBar from "~icons/ph/chart-bar";
import CalendarBlank from "~icons/ph/calendar";
import Flask from "~icons/ph/flask";
import TestTube from "~icons/ph/test-tube";
import Globe from "~icons/ph/globe-hemisphere-west";
import CloudSun from "~icons/ph/cloud-sun";
import RailNdvi from "~icons/ph/globe-hemisphere-west-fill";
import RailClima from "~icons/ph/cloud-sun-fill";
import ChartPieSlice from "~icons/ph/chart-pie-slice";
import RailPainel from "~icons/ph/chart-pie-slice-fill";
import ChartLineUp from "~icons/ph/chart-line-up";
import RailEnsaios from "~icons/ph/test-tube-fill";
import RailAnalises from "~icons/ph/chart-line-up-fill";
import RailPlantios from "~icons/ph/grains-fill";
import RailAtividades from "~icons/ph/clipboard-text-fill";
import RailCustos from "~icons/ph/chart-bar-fill";
import RailSafras from "~icons/ph/calendar-fill";
import RailCatalogo from "~icons/ph/flask-fill";
import CaretDown from "~icons/ph/caret-down";
import UserCircle from "~icons/ph/user-circle";
// Gatilho da CONTA: cheio e grafite como o resto do menu (17/11/2026). Até
// então era teal em duotone; com o primeiro nome ao lado, não precisa mais de
// cor própria para se distinguir.
import UserCircleFill from "~icons/ph/user-circle-fill";
import LogOut from "~icons/ph/sign-out";
import HelpCircle from "~icons/ph/question";
import Moon from "~icons/ph/moon";
import Sun from "~icons/ph/sun";
import { useTema } from "@/lib/tema";
import Menu from "~icons/ph/list";
import X from "~icons/ph/x";
import { ROLE_LABELS, useAuth } from "@/contexts/AuthContext";
import {
  MODULOS,
  moduloPorId,
  modulosVisiveis,
  type ModuloId,
} from "@/lib/modulos";
import { getStoredValue, setStoredValue } from "@/utils/appStorage";
import { mostraProdutores } from "@/utils/modoDeUso";
import { AppSidebar, type RailItem } from "./AppSidebar";
import { useNotifications } from "@/modules/notifications/hooks/useNotifications";
import { Logo, LogoName } from "@/components/Logo";
import type { ContextoDoShell } from "./moduloAtivo";
import { PageBreadcrumb } from "@/components/Layout/PageBreadcrumb";
import { ImpersonationBanner } from "@/modules/admin/components/ImpersonationBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  /** Só no modo "consultor" do Field (utils/modoDeUso.ts). */
  soConsultor?: boolean;
  /** Liga um contador dinâmico ao item. O array é constante de módulo, então o
   *  número é resolvido no AppShell (via hook). */
  badgeKey?: "notifications";
  /** Tela de um módulo (lib/modulos.ts). Sem módulo = fixa: aparece sempre,
   *  qualquer que seja o módulo ativo no seletor do trilho. */
  modulo?: ModuloId;
}

// Ordem única do menu.
//   adminOnly      gestão da organização (Configurações, Equipe)
//   teamOnly       só faz sentido em org com equipe (kind=company)
//   hideForViewer  cria/edita dado — o convidado não vê
// Ver docs/ORGANIZACOES-E-PERFIS.md §2.
const NAV_ITEMS: NavItem[] = [
  {
    to: "/lancamentos",
    label: "Lançamentos",
    icon: ArrowLeftRight,
    modulo: "financas",
  },
  {
    to: "/recorrencias",
    label: "Recorrências",
    icon: Repeat,
    hideForViewer: true,
    modulo: "financas",
  },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  // Fixas (dos dois módulos): o calendário junta financeiro e campo.
  { to: "/calendario", label: "Calendário", icon: CalendarDots },
  { to: "/pendencias", label: "Pendências", icon: Checklist },
  {
    to: "/notificacoes",
    label: "Notificações",
    icon: NotificationsIcon,
    badgeKey: "notifications",
  },
  {
    to: "/relatorios",
    label: "Relatórios",
    icon: Assessment,
    modulo: "financas",
  },
  { to: "/anexos", label: "Anexos", icon: FolderOpen, modulo: "financas" },
  { to: "/cartoes", label: "Cartões", icon: CreditCard, modulo: "financas" },
  {
    to: "/notas",
    label: "Notas e Recibos",
    icon: ReceiptLong,
    modulo: "financas",
  },
  // Módulo Field — cadastros (fase 1, docs/UNIFICACAO-FIELD.md).
  {
    to: "/campo/produtores",
    label: "Produtores",
    icon: UserList,
    modulo: "field",
    soConsultor: true,
  },
  // Fase 6 — painel da safra.
  {
    to: "/campo/painel",
    label: "Painel da Safra",
    icon: ChartPieSlice,
    modulo: "field",
  },
  { to: "/campo/fazendas", label: "Fazendas", icon: Barn, modulo: "field" },
  { to: "/campo/talhoes", label: "Talhões", icon: Plant, modulo: "field" },
  // Fase 5 — satélite e clima.
  { to: "/campo/ndvi", label: "NDVI", icon: Globe, modulo: "field" },
  { to: "/campo/clima", label: "Clima", icon: CloudSun, modulo: "field" },
  // Fase 2 — safra.
  { to: "/campo/plantios", label: "Plantios", icon: Grains, modulo: "field" },
  {
    to: "/campo/atividades",
    label: "Atividades",
    icon: ClipboardText,
    modulo: "field",
  },
  {
    to: "/campo/custos",
    label: "Custo por Talhão",
    icon: ChartBar,
    modulo: "field",
  },
  // Fase 4 — ensaios (desenvolvimento de mercado).
  { to: "/campo/ensaios", label: "Ensaios", icon: TestTube, modulo: "field" },
  {
    to: "/campo/analises",
    label: "Análises de Ensaios",
    icon: ChartLineUp,
    modulo: "field",
  },
  {
    to: "/campo/safras",
    label: "Safras",
    icon: CalendarBlank,
    modulo: "field",
  },
  { to: "/campo/catalogo", label: "Catálogo", icon: Flask, modulo: "field" },
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
];

/**
 * Só-master (allowlist MASTER_EMAILS): gestão de plataforma.
 *
 * FORA DO TRILHO desde 20/08/2026 — as duas telas viraram atalhos dentro de
 * Configurações. São telas que uma pessoa no mundo abre, e ocupavam
 * permanentemente duas posições numa coluna que todo usuário vê.
 *
 * A lista continua existindo porque o BREADCRUMB resolve o rótulo por ela: as
 * rotas /admin e /admin/organizacoes seguem válidas por URL (link direto,
 * favorito, histórico), e sem isto o cabeçalho mostraria "admin".
 */
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
 * O trilho do desktop: **um ícone por página**, ao lado do nome.
 *
 * Este mapa é o botão de ajuste — a ordem se edita aqui, sem tocar em
 * componente nenhum. Rota fora do mapa não entra no trilho.
 *
 * Estilo: ícones CHEIOS (Phosphor fill), na cor do texto (grafite), desde
 * 17/11/2026. Antes cada página tinha seu matiz em duotone, e o menu ficava
 * colorido demais. Testados e descartados: miolo lima da Cropware (chamava
 * atenção demais), duotone grafite, só contorno e contorno com cheio na
 * página aberta — o cheio combina com o nome da marca, que também é cheio.
 */
const RAIL_ICONES: Record<string, { Icon: NavItem["icon"] }> = {
  "/": { Icon: RailDashboard },
  "/lancamentos": { Icon: RailLancamentos },
  "/notas": { Icon: RailNotas },
  "/cartoes": { Icon: RailCartoes },
  "/recorrencias": { Icon: RailRecorrencias },
  "/relatorios": { Icon: RailRelatorios },
  "/anexos": { Icon: RailAnexos },
  "/campo/produtores": { Icon: RailProdutores },
  "/campo/fazendas": { Icon: RailFazendas },
  "/campo/painel": { Icon: RailPainel },
  "/campo/talhoes": { Icon: RailTalhoes },
  "/campo/plantios": { Icon: RailPlantios },
  "/campo/atividades": { Icon: RailAtividades },
  "/campo/custos": { Icon: RailCustos },
  "/campo/ensaios": { Icon: RailEnsaios },
  "/campo/ndvi": { Icon: RailNdvi },
  "/campo/clima": { Icon: RailClima },
  "/campo/analises": { Icon: RailAnalises },
  "/campo/safras": { Icon: RailSafras },
  "/campo/catalogo": { Icon: RailCatalogo },
  "/calendario": { Icon: RailCalendario },
  "/pendencias": { Icon: RailPendencias },
  "/notificacoes": { Icon: RailNotificacoes },
  "/configuracoes": { Icon: RailConfiguracoes },
  "/equipe": { Icon: RailEquipe },
  "/admin": { Icon: RailUsuarios },
  "/admin/organizacoes": { Icon: RailOrganizacoes },
};

/**
 * Ordem do trilho. Uma lista só, para todos os módulos: o trilho mostra as
 * telas fixas + as do módulo ativo, NESTA ordem. Assim, para quem só tem o
 * Finanças, o trilho é exatamente o de antes dos módulos.
 */
const RAIL_ORDEM = [
  "/",
  "/lancamentos",
  "/notas",
  "/cartoes",
  "/recorrencias",
  "/relatorios",
  "/anexos",
  "/campo/painel",
  "/campo/talhoes",
  "/campo/ndvi",
  "/campo/clima",
  "/campo/plantios",
  "/campo/atividades",
  "/campo/custos",
  "/campo/ensaios",
  "/campo/analises",
  "/campo/fazendas",
  "/campo/produtores",
  "/campo/safras",
  "/campo/catalogo",
  "/calendario",
  "/pendencias",
  "/notificacoes",
  "/configuracoes",
  "/equipe",
];

/** Último módulo escolhido no seletor (vale quando a rota é fixa, ex.: Dashboard). */
const CHAVE_MODULO_ATIVO = "gerentia.moduloAtivo";

/** Link de navegacao da sidebar. Icone sempre; label some quando colapsada. */
export function AppShell() {
  const { user, signOut, isAdmin, isViewer, isTeamOrg, isMaster } = useAuth();
  // Atalho claro/escuro no menu da conta (a escolha completa, com "igual ao
  // sistema", fica em Conta > Aparência).
  const { tema, escolher: escolherTema } = useTema();
  const rotuloDoTema =
    tema === "escuro" ? "Usar Tema Claro" : "Usar Tema Escuro";
  const alternarTema = () =>
    escolherTema(tema === "escuro" ? "claro" : "escuro");
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

  // ---- Módulos (ver lib/modulos.ts) -------------------------------------
  const visiveis = useMemo(
    () => modulosVisiveis(user?.modules, isMaster),
    [user?.modules, isMaster],
  );
  const variosModulos = visiveis.length > 1;

  // Módulo escolhido no seletor, guardado entre sessões. Só decide quando a
  // rota atual é FIXA (Dashboard, Pendências…); numa tela de módulo, quem manda
  // é a rota — um link direto para /lancamentos abre o Finanças sozinho.
  const [moduloEscolhido, setModuloEscolhido] = useState<ModuloId>("financas");
  useEffect(() => {
    void getStoredValue(CHAVE_MODULO_ATIVO).then((v) => {
      if (v && MODULOS.some((m) => m.id === v))
        setModuloEscolhido(v as ModuloId);
    });
  }, []);

  const moduloDaRota = NAV_ITEMS.find(
    (it) =>
      it.modulo &&
      (location.pathname === it.to ||
        location.pathname.startsWith(it.to + "/")),
  )?.modulo;
  const candidato = moduloDaRota ?? moduloEscolhido;
  const moduloAtivo: ModuloId = visiveis.includes(candidato)
    ? candidato
    : "financas";

  // A rota que abre um módulo também vira a escolha guardada: quem chegou ao
  // Field por link e volta ao Dashboard continua vendo o trilho do Field.
  useEffect(() => {
    if (moduloDaRota && moduloDaRota !== moduloEscolhido) {
      setModuloEscolhido(moduloDaRota);
      void setStoredValue(CHAVE_MODULO_ATIVO, moduloDaRota);
    }
  }, [moduloDaRota, moduloEscolhido]);

  /** Itens permitidos por papel e por módulo visível (todos os módulos). */
  const navItems: NavItem[] = NAV_ITEMS.filter(
    (i) =>
      (!i.adminOnly || isAdmin) &&
      (!i.teamOnly || isTeamOrg) &&
      (!i.hideForViewer || !isViewer) &&
      (!i.soConsultor || mostraProdutores(user?.fieldMode)) &&
      (!i.modulo || visiveis.includes(i.modulo)),
  );

  /** Troca de módulo no selo: guarda a escolha e abre o Dashboard, que
   *  desde 17/11/2026 é o início de CADA módulo (o do Field é outro). */
  const trocarModulo = (id: ModuloId) => {
    setModuloEscolhido(id);
    void setStoredValue(CHAVE_MODULO_ATIVO, id);
    navigate("/");
  };

  /**
   * Gaveta do celular. Com um módulo só, a lista é a de sempre. Com vários, sem
   * seletor (a gaveta tem altura para tudo): as telas fixas primeiro e depois
   * uma seção com título por módulo.
   */
  const gruposDoDrawer: { titulo: string | null; itens: NavItem[] }[] =
    variosModulos
      ? [
          { titulo: null, itens: navItems.filter((i) => !i.modulo) },
          ...visiveis.map((id) => ({
            titulo: moduloPorId(id).nome,
            itens: navItems.filter((i) => i.modulo === id),
          })),
        ].filter((g) => g.itens.length > 0)
      : [{ titulo: null, itens: navItems }];

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
   * Gatilho da conta — o rodapé do menu: ícone + nome do usuário. Organização e
   * perfil ficam dentro do menu (é o que explica ver ou não ver o dado dos
   * colegas).
   */
  /**
   * Ações da conta, à DIREITA da faixa do breadcrumb (17/11/2026). Eram um
   * menu suspenso com o nome no rodapé do menu lateral; viraram botões à
   * vista: tema e ajuda só com ícone, conta com o primeiro nome, e sair.
   * A ajuda abre a do site da Cropware — as ajudas ficam centralizadas lá.
   * Em org com equipe, a organização e o perfil vão no `title` da conta (era
   * o cabeçalho do menu suspenso).
   */
  const primeiroNome = user?.fullName?.split(" ")[0] || user?.email || "Conta";
  const BOTAO_DO_TOPO =
    "h-8 inline-flex items-center gap-1.5 rounded-md text-sm text-[#19191d] hover:bg-black/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/20";
  const abrirAjuda = () => void openExternalUrl(LINKS_LEGAIS.ajuda);
  const acoesDaConta = (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={alternarTema}
        title={rotuloDoTema}
        aria-label={rotuloDoTema}
        className={cn(BOTAO_DO_TOPO, "size-8 justify-center")}
      >
        {tema === "escuro" ? (
          <Sun className="size-[18px]" />
        ) : (
          <Moon className="size-[18px]" />
        )}
      </button>
      <button
        type="button"
        onClick={abrirAjuda}
        title="Ajuda (cropware.com.br)"
        aria-label="Ajuda"
        className={cn(BOTAO_DO_TOPO, "size-8 justify-center")}
      >
        <HelpCircle className="size-[18px]" />
      </button>
      <span aria-hidden className="mx-1.5 h-5 w-px bg-black/15" />
      <button
        type="button"
        onClick={() => navigate("/conta")}
        title={
          isTeamOrg && user
            ? `Conta · ${user.organizationName} · ${ROLE_LABELS[user.role]}`
            : "Conta"
        }
        className={cn(BOTAO_DO_TOPO, "px-2.5 max-w-48")}
      >
        <UserCircleFill className="size-[18px] shrink-0" />
        <span className="truncate">{primeiroNome}</span>
      </button>
      <button
        type="button"
        onClick={() => void signOut()}
        className={cn(BOTAO_DO_TOPO, "px-2.5")}
      >
        <LogOut className="size-[18px] shrink-0" />
        Sair
      </button>
    </div>
  );

  /**
   * SELO do módulo, no topo do menu, à direita do nome (17/11/2026). Grafite,
   * como todo "selecionado" do app. Com mais de um módulo ele É o seletor: tem
   * setinha e abre a lista; com um só, é só identificação. Substituiu a caixa
   * de seletor que ficava abaixo do nome — o módulo aparecia duas vezes.
   */
  const ativo = moduloPorId(moduloAtivo);
  const SELO_DO_MODULO =
    "h-6 shrink-0 inline-flex items-center rounded-md bg-slate-800 text-white text-xs font-medium";
  const seloDoModulo = variosModulos ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Módulo: ${ativo.nome}. Trocar de módulo`}
          title="Trocar de módulo"
          // gap-1.5 + pr-2: a seta não encosta no nome (pedido do Leonardo).
          className={cn(
            SELO_DO_MODULO,
            "gap-1.5 pl-2.5 pr-2 hover:bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300",
          )}
        >
          {ativo.nome}
          <CaretDown className="size-3 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-52"
      >
        {visiveis.map((id) => {
          const m = moduloPorId(id);
          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => trocarModulo(id)}
              className={cn(id === moduloAtivo && "font-semibold")}
            >
              <m.Icon className="size-5 shrink-0" />
              {m.nome}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <span className={cn(SELO_DO_MODULO, "px-2.5")}>{ativo.nome}</span>
  );

  /** Itens do trilho, na ordem do mapa e já filtrados por papel — página que o
   *  usuário não pode ver não ganha ícone. */
  const railItens: RailItem[] = RAIL_ORDEM.map<RailItem | null>((rota) => {
    const item = navItems.find(
      (i) => i.to === rota && (!i.modulo || i.modulo === moduloAtivo),
    );
    const visual = RAIL_ICONES[rota];
    if (!item || !visual) return null;
    return {
      to: item.to,
      label: item.label,
      Icon: visual.Icon,
      end: item.end,
      badge: item.badgeKey === "notifications" ? unread : 0,
      // Divisória separando o bloco do master do app do cliente.
      separadorAntes: rota === "/admin",
    };
  }).filter((i): i is RailItem => !!i);

  return (
    <div className="flex overflow-hidden bg-white" style={{ height: "100dvh" }}>
      {/* MENU DESKTOP — ícone + nome, sem recolher (ver AppSidebar). */}
      <aside className="hidden md:flex flex-col shrink-0 w-60 h-full min-h-0 border-r border-slate-200 bg-white">
        {/* A divisória é a BORDA deste bloco, e não uma div à parte, para
            fechar na mesma linha do topbar ao lado.
            Antes: h-13 (52px) + uma div de 1px = 53px, enquanto o topbar tem
            h-13 COM a borda por dentro (box-border) = 52px. A régua da esquerda
            ficava 1px abaixo da da direita — e ainda em outro tom
            (slate-100 x slate-200), então as duas liam como linhas diferentes. */}
        {/* Faixa lima (app.css .faixa-lima, em teste 17/11/2026). `-mr-px`:
            cobre a borda direita do menu, para a faixa seguir sem corte até
            a do breadcrumb. */}
        <div className="faixa-lima tema-claro -mr-px flex items-center justify-between gap-2 h-13 shrink-0 px-4 border-b">
          {/* Só o nome no menu (17/11/2026): o símbolo fica na entrada. Nome
              a 20px e selo do módulo na ponta, para ocupar a largura. O menu
              foi de 224 para 240px para caber "Finanças" + seta com folga. */}
          {/* filter: none — no tema escuro a marca clareia sozinha (app.css,
              .marca-img); sobre o lima ela fica grafite. */}
          <LogoName className="h-5 shrink-0" style={{ filter: "none" }} />
          {seloDoModulo}
        </div>
        <AppSidebar itens={railItens} />
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
              {gruposDoDrawer.map((grupo) => (
                <div
                  key={grupo.titulo ?? "unico"}
                  className="flex flex-col gap-1"
                >
                  {grupo.titulo && (
                    <p className="px-3 pt-2 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {grupo.titulo}
                    </p>
                  )}
                  {grupo.itens.map((item) => (
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
                        <span className="ml-auto shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[#f87171] text-branco text-[11px] font-medium tabular-nums">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
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
                onClick={() => {
                  setMobileOpen(false);
                  abrirAjuda();
                }}
                className="flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <HelpCircle className="size-5 shrink-0" />
                Ajuda
              </button>
              <button
                type="button"
                onClick={alternarTema}
                className="flex items-center justify-start gap-2.5 h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {tema === "escuro" ? (
                  <Sun className="size-5 shrink-0" />
                ) : (
                  <Moon className="size-5 shrink-0" />
                )}
                {rotuloDoTema}
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
        <div className="faixa-lima tema-claro hidden md:flex items-center h-13 shrink-0 border-b px-3 gap-2">
          <div className="flex-1 min-w-0">
            <PageBreadcrumb segments={breadcrumbSegments} embedded />
          </div>
          {acoesDaConta}
        </div>

        {/* MOBILE: cabeçalho com a logo centralizada (safe-area no topo) */}
        <div
          className="md:hidden flex items-center justify-center shrink-0 border-b border-slate-200 px-3 bg-slate-100"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            minHeight: "calc(3.25rem + env(safe-area-inset-top, 0px))",
          }}
        >
          <div className="flex items-center gap-2.5">
            <Logo className="h-6" />
            <LogoName className="h-4" />
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
            <Outlet context={{ moduloAtivo } satisfies ContextoDoShell} />
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
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#f87171]" />
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
