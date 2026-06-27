import { useEffect, type ReactNode } from "react";
import { useBilling } from "@/modules/account/hooks/useBilling";
import { Paywall } from "./Paywall";

/**
 * Gate de acesso pós-trial. Bloqueia o app com o Paywall quando o trial venceu E
 * não há assinatura ativa (sinal `info.active` = sub ativa OU trial ativo, vindo
 * de /billing/subscription — fonte de verdade no backend).
 *
 * FAIL-OPEN: enquanto carrega, em erro, ou sem info, NÃO bloqueia. Acesso é a
 * regra; o paywall só entra quando temos certeza de que acabou. Assim uma falha
 * no fetch de billing nunca tranca o usuário pra fora.
 *
 * Vale pra web (assina no Mercado Pago) e nativo (assina na loja via RevenueCat).
 */
export function PaywallGate({ children }: { children: ReactNode }) {
  const { info, loading, error, reload } = useBilling();

  // Revalida ao recuperar o foco da janela (volta do checkout MP no browser ou
  // da loja no app nativo) — destrava sem o usuário precisar recarregar.
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  if (loading || error || !info) return <>{children}</>;
  if (info.active) return <>{children}</>;
  return <Paywall onRecheck={reload} />;
}
