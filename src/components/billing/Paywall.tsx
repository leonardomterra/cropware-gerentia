import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SubscriptionCard } from "@/modules/account/components/SubscriptionCard";
import { isNativeCapacitorApp } from "@/utils/platform";

/** Pinta o status bar nativo (no-op no web). */
function setStatusBarColor(color: string) {
  if (!isNativeCapacitorApp()) return;
  import("@capacitor/status-bar")
    .then(({ StatusBar }) => StatusBar.setBackgroundColor({ color }).catch(() => {}))
    .catch(() => {});
}

/**
 * Tela cheia mostrada quando o acesso acabou (trial vencido E sem assinatura
 * ativa). Reusa o SubscriptionCard, que já resolve a frente certa: compra via
 * loja (RevenueCat) no app nativo e checkout do Mercado Pago no web — nunca
 * link externo no nativo (regra das lojas). O gate (PaywallGate) destrava sozinho
 * quando o billing volta a "ativo"; o botão "Já assinei" força a revalidação.
 */
export function Paywall({ onRecheck }: { onRecheck: () => void }) {
  const { signOut } = useAuth();

  // Status bar branca enquanto o paywall (fundo branco) está visível; volta pro
  // slate-100 do app ao desmontar (ex.: assinou e voltou pro app).
  useEffect(() => {
    setStatusBarColor("#ffffff");
    return () => setStatusBarColor("#f1f5f9");
  }, []);

  return (
    <AuthLayout
      title="Seu período de teste terminou"
      subtitle="Assine o Gerentia Pro para continuar usando o app."
    >
      <SubscriptionCard />
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onRecheck}
          className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          Já assinei — atualizar
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Sair
        </button>
      </div>
    </AuthLayout>
  );
}
