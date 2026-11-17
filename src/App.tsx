import { Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { isNativeCapacitorApp } from "@/utils/platform";
import { PaywallGate } from "@/components/billing/PaywallGate";
import { Paywall } from "@/components/billing/Paywall";
import { ModuloGate } from "@/components/billing/ModuloGate";
import { modulosVisiveis } from "@/lib/modulos";
import { mostraProdutores } from "@/utils/modoDeUso";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SignUpScreen } from "@/components/auth/SignUpScreen";
import { ForgotPasswordScreen } from "@/components/auth/ForgotPasswordScreen";
import { ResetPasswordScreen } from "@/components/auth/ResetPasswordScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/Layout/AppShell";
import { NotificationsProvider } from "@/modules/notifications/hooks/useNotifications";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

const DashboardPage = lazyWithRetry(
  () => import("@/modules/dashboard/pages/DashboardPage"),
);
const ReceiptsPage = lazyWithRetry(
  () => import("@/modules/receipts/pages/ReceiptsPage"),
);
const NotasRecibosPage = lazyWithRetry(
  () => import("@/modules/receipts/pages/NotasRecibosPage"),
);
const CartoesPage = lazyWithRetry(() => import("@/modules/cards/CartoesPage"));
const AnexosPage = lazyWithRetry(
  () => import("@/modules/receipts/pages/AnexosPage"),
);
const ReportsPage = lazyWithRetry(
  () => import("@/modules/reports/pages/ReportsPage"),
);
const AccountPage = lazyWithRetry(
  () => import("@/modules/account/pages/AccountPage"),
);
const ConfiguracoesPage = lazyWithRetry(
  () => import("@/modules/settings/pages/ConfiguracoesPage"),
);
const TeamPage = lazyWithRetry(() => import("@/modules/team/pages/TeamPage"));
const JoinPage = lazyWithRetry(() => import("@/modules/team/pages/JoinPage"));
const RecurringPage = lazyWithRetry(
  () => import("@/modules/recurring/pages/RecurringPage"),
);
const CalendarioPage = lazyWithRetry(
  () => import("@/modules/calendario/CalendarioPage"),
);
const PendenciasPage = lazyWithRetry(
  () => import("@/modules/tasks/pages/PendenciasPage"),
);
const NotificacoesPage = lazyWithRetry(
  () => import("@/modules/notifications/pages/NotificacoesPage"),
);
const IconLabPage = lazyWithRetry(
  () => import("@/modules/dev/pages/IconLabPage"),
);
const BadgeLabPage = lazyWithRetry(
  () => import("@/modules/dev/pages/BadgeLabPage"),
);
const ErrorTestPage = lazyWithRetry(
  () => import("@/modules/dev/pages/ErrorTestPage"),
);
const AdminUsersPage = lazyWithRetry(
  () => import("@/modules/admin/pages/AdminUsersPage"),
);
const AdminOrgsPage = lazyWithRetry(
  () => import("@/modules/admin/pages/AdminOrgsPage"),
);
const ProdutoresPage = lazyWithRetry(
  () => import("@/modules/field/pages/ProdutoresPage"),
);
const FazendasPage = lazyWithRetry(
  () => import("@/modules/field/pages/FazendasPage"),
);
const TalhoesPage = lazyWithRetry(
  () => import("@/modules/field/pages/TalhoesPage"),
);
const PlantiosPage = lazyWithRetry(
  () => import("@/modules/field/pages/PlantiosPage"),
);
const AtividadesPage = lazyWithRetry(
  () => import("@/modules/field/pages/AtividadesPage"),
);
const CustosPage = lazyWithRetry(
  () => import("@/modules/field/pages/CustosPage"),
);
const SafrasPage = lazyWithRetry(
  () => import("@/modules/field/pages/SafrasPage"),
);
const CatalogoPage = lazyWithRetry(
  () => import("@/modules/field/pages/CatalogoPage"),
);
const EnsaiosPage = lazyWithRetry(
  () => import("@/modules/field/pages/EnsaiosPage"),
);
const AnalisesPage = lazyWithRetry(
  () => import("@/modules/field/pages/AnalisesPage"),
);
const NdviPage = lazyWithRetry(() => import("@/modules/field/pages/NdviPage"));
const ClimaPage = lazyWithRetry(
  () => import("@/modules/field/pages/ClimaPage"),
);

type AuthView = "login" | "signup" | "forgot";

function AuthFlow() {
  const [view, setView] = useState<AuthView>("login");
  if (view === "signup")
    return <SignUpScreen onGoToLogin={() => setView("login")} />;
  if (view === "forgot")
    return <ForgotPasswordScreen onGoToLogin={() => setView("login")} />;
  return (
    <AuthScreen
      onGoToSignUp={() => setView("signup")}
      onGoToForgotPassword={() => setView("forgot")}
    />
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500 text-sm">Carregando...</p>
    </main>
  );
}

/**
 * /faturas → /cartoes PRESERVANDO a query.
 *
 * `<Navigate to="/cartoes">` sozinho descarta a busca, e "Gerenciar itens" de
 * uma fatura navega para `/faturas?open=<id>`. Sem isto o link cairia no hub em
 * vez de abrir a fatura — e continuaria "funcionando", só que na tela errada,
 * que é o tipo de quebra que ninguém reporta.
 */
function RedirecionaFaturas() {
  const { search } = useLocation();
  return <Navigate to={`/cartoes${search}`} replace />;
}

function RootRoutes() {
  const {
    user,
    loading,
    isResettingPassword,
    resetError,
    isAdmin,
    isMaster,
    isViewer,
  } = useAuth();
  const fieldVisivel = modulosVisiveis(user?.modules, isMaster).includes(
    "field",
  );

  // App nativo: status bar branca na tela de login (deslogado) e slate-100
  // (cor do cabeçalho) quando logado — consistência visual com o AppShell.
  useEffect(() => {
    if (!isNativeCapacitorApp()) return;
    const color = user ? "#f5f5f5" : "#ffffff";
    import("@capacitor/status-bar")
      .then(({ StatusBar }) =>
        StatusBar.setBackgroundColor({ color }).catch(() => {}),
      )
      .catch(() => {});
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (isResettingPassword || resetError) return <ResetPasswordScreen />;

  // Rota publica /entrar (acessivel sem login pra signup via convite)
  const path = window.location.pathname;
  if (!user && path === "/entrar") {
    return (
      <Routes>
        <Route
          path="entrar"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <JoinPage />
            </Suspense>
          }
        />
      </Routes>
    );
  }

  if (!user) return <AuthFlow />;

  return (
    <PaywallGate>
      <Routes>
        {/* DEV-only: preview da tela de erro em tela cheia (fora do AppShell),
          igual ao erro real. Acesse /erro. */}
        {import.meta.env.DEV && (
          <Route
            path="erro"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ErrorTestPage />
              </Suspense>
            }
          />
        )}
        {/* DEV-only: preview da tela de paywall (trial vencido) em tela cheia, sem
          precisar vencer o trial de verdade. Acesse /paywall. */}
        {import.meta.env.DEV && (
          <Route
            path="paywall"
            element={<Paywall onRecheck={() => window.location.reload()} />}
          />
        )}
        {/* NotificationsProvider envolve o AppShell: assim a sidebar (badge de
          não-lidas) e o <Outlet/> (página) leem o MESMO estado. */}
        <Route
          element={
            <NotificationsProvider>
              <AppShell />
            </NotificationsProvider>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<LoadingScreen />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="lancamentos"
            element={
              <ModuloGate modulo="financas">
                <Suspense fallback={<LoadingScreen />}>
                  <ReceiptsPage />
                </Suspense>
              </ModuloGate>
            }
          />
          {/* Calendário único (fase 3): tela FIXA, dos dois módulos. */}
          <Route
            path="calendario"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <CalendarioPage />
              </Suspense>
            }
          />
          <Route
            path="pendencias"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <PendenciasPage />
              </Suspense>
            }
          />
          <Route
            path="notificacoes"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <NotificacoesPage />
              </Suspense>
            }
          />
          <Route
            path="notas"
            element={
              <ModuloGate modulo="financas">
                <Suspense fallback={<LoadingScreen />}>
                  <NotasRecibosPage />
                </Suspense>
              </ModuloGate>
            }
          />
          <Route
            path="cartoes"
            element={
              <ModuloGate modulo="financas">
                <Suspense fallback={<LoadingScreen />}>
                  <CartoesPage />
                </Suspense>
              </ModuloGate>
            }
          />
          {/* /faturas virou /cartoes em 25/08/2026. O redirect fica: o caminho
              antigo está em link salvo, em histórico de navegador e no atalho
              que alguém fixou — e um 404 não explica que a tela mudou de nome. */}
          <Route path="faturas" element={<RedirecionaFaturas />} />
          <Route
            path="anexos"
            element={
              <ModuloGate modulo="financas">
                <Suspense fallback={<LoadingScreen />}>
                  <AnexosPage />
                </Suspense>
              </ModuloGate>
            }
          />
          <Route
            path="relatorios"
            element={
              <ModuloGate modulo="financas">
                <Suspense fallback={<LoadingScreen />}>
                  <ReportsPage />
                </Suspense>
              </ModuloGate>
            }
          />
          {/* /fazendas era o stub "CRUD vem no V2"; o cadastro de fazendas
            agora é do módulo Field. O caminho antigo leva para lá. */}
          <Route
            path="fazendas"
            element={
              <Navigate to={fieldVisivel ? "/campo/fazendas" : "/"} replace />
            }
          />
          <Route
            path="conta"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <AccountPage />
              </Suspense>
            }
          />
          {isAdmin && (
            <>
              <Route
                path="configuracoes"
                element={
                  <Suspense fallback={<LoadingScreen />}>
                    <ConfiguracoesPage />
                  </Suspense>
                }
              />
              {/* /centros legado -> redireciona pra /configuracoes (a aba foi
                renomeada e absorveu o gerenciamento de categorias). */}
              <Route
                path="centros"
                element={<Navigate to="/configuracoes" replace />}
              />
              <Route
                path="equipe"
                element={
                  <Suspense fallback={<LoadingScreen />}>
                    <TeamPage />
                  </Suspense>
                }
              />
            </>
          )}
          {/* Recorrência é do próprio usuário (a RLS garante a posse), então não
            é mais exclusiva de gestor — só o convidado fica de fora. */}
          {!isViewer && (
            <Route
              path="recorrencias"
              element={
                <ModuloGate modulo="financas">
                  <Suspense fallback={<LoadingScreen />}>
                    <RecurringPage />
                  </Suspense>
                </ModuloGate>
              }
            />
          )}
          {isMaster && (
            <>
              <Route
                path="admin"
                element={
                  <Suspense fallback={<LoadingScreen />}>
                    <AdminUsersPage />
                  </Suspense>
                }
              />
              <Route
                path="admin/organizacoes"
                element={
                  <Suspense fallback={<LoadingScreen />}>
                    <AdminOrgsPage />
                  </Suspense>
                }
              />
            </>
          )}
          {/* Módulo Field — cadastros (fase 1). Visível só para o master até
            FIELD_LIBERADO (lib/modulos.ts). /campo sozinho abre os talhões. */}
          {fieldVisivel && (
            <>
              <Route
                path="campo"
                element={<Navigate to="/campo/talhoes" replace />}
              />
              {mostraProdutores(user?.fieldMode) && (
                <Route
                  path="campo/produtores"
                  element={
                    <ModuloGate modulo="field">
                      <Suspense fallback={<LoadingScreen />}>
                        <ProdutoresPage />
                      </Suspense>
                    </ModuloGate>
                  }
                />
              )}
              <Route
                path="campo/fazendas"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <FazendasPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/talhoes"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <TalhoesPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/plantios"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <PlantiosPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/atividades"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <AtividadesPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/custos"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <CustosPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/safras"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <SafrasPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/catalogo"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <CatalogoPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/ensaios"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <EnsaiosPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/analises"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <AnalisesPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/ndvi"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <NdviPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
              <Route
                path="campo/clima"
                element={
                  <ModuloGate modulo="field">
                    <Suspense fallback={<LoadingScreen />}>
                      <ClimaPage />
                    </Suspense>
                  </ModuloGate>
                }
              />
            </>
          )}
          {/* DEV-only: laboratorio de icones (Iconify). So existe em dev, por URL
            /icones. Em producao a rota nao e registrada (cai no catch-all). */}
          {import.meta.env.DEV && (
            <Route
              path="icones"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <IconLabPage />
                </Suspense>
              }
            />
          )}
          {/* Laboratório de selos, mesma regra do de ícones: só em DEV. */}
          {import.meta.env.DEV && (
            <Route
              path="badges"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <BadgeLabPage />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </PaywallGate>
  );
}

/*
 * `window.toast` no console — SÓ em desenvolvimento.
 *
 * Existe porque conferir a aparência dos toasts pela interface é chato: o de
 * notificação depende do evento `focus` e de ids inéditos, e os de erro exigem
 * provocar uma falha de verdade. Do console dá para ver os quatro estados lado
 * a lado em segundos.
 *
 * `import.meta.env.DEV` some no build de produção junto com o bloco inteiro.
 */
if (import.meta.env.DEV) {
  (window as unknown as { toast: typeof toast }).toast = toast;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <RootRoutes />
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </ErrorBoundary>
  );
}
