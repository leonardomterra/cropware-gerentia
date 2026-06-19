import { Suspense, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SignUpScreen } from "@/components/auth/SignUpScreen";
import { ForgotPasswordScreen } from "@/components/auth/ForgotPasswordScreen";
import { ResetPasswordScreen } from "@/components/auth/ResetPasswordScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/Layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
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
const FaturasPage = lazyWithRetry(
  () => import("@/modules/receipts/pages/FaturasPage"),
);
const AnexosPage = lazyWithRetry(
  () => import("@/modules/receipts/pages/AnexosPage"),
);
const ReportsPage = lazyWithRetry(
  () => import("@/modules/reports/pages/ReportsPage"),
);
const FarmsPage = lazyWithRetry(
  () => import("@/modules/farms/pages/FarmsPage"),
);
const AccountPage = lazyWithRetry(
  () => import("@/modules/account/pages/AccountPage"),
);
const ConfiguracoesPage = lazyWithRetry(
  () => import("@/modules/settings/pages/ConfiguracoesPage"),
);
const TeamPage = lazyWithRetry(
  () => import("@/modules/team/pages/TeamPage"),
);
const JoinPage = lazyWithRetry(
  () => import("@/modules/team/pages/JoinPage"),
);
const RecurringPage = lazyWithRetry(
  () => import("@/modules/recurring/pages/RecurringPage"),
);
const IconLabPage = lazyWithRetry(
  () => import("@/modules/dev/pages/IconLabPage"),
);
const AdminUsersPage = lazyWithRetry(
  () => import("@/modules/admin/pages/AdminUsersPage"),
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

function RootRoutes() {
  const { user, loading, isResettingPassword, resetError, isAdmin, isMaster } =
    useAuth();

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
    <Routes>
      <Route element={<AppShell />}>
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
            <Suspense fallback={<LoadingScreen />}>
              <ReceiptsPage />
            </Suspense>
          }
        />
        <Route
          path="notas"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <NotasRecibosPage />
            </Suspense>
          }
        />
        <Route
          path="faturas"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <FaturasPage />
            </Suspense>
          }
        />
        <Route
          path="anexos"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <AnexosPage />
            </Suspense>
          }
        />
        <Route
          path="relatorios"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="fazendas"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <FarmsPage />
            </Suspense>
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
            <Route
              path="recorrencias"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <RecurringPage />
                </Suspense>
              }
            />
          </>
        )}
        {isMaster && (
          <Route
            path="admin"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <AdminUsersPage />
              </Suspense>
            }
          />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
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
