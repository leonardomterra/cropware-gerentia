import { useCallback, useEffect, useState } from "react";
import { api, apiGet } from "@/utils/api";

export interface Plan {
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: "monthly" | "yearly";
  metadata: Record<string, unknown>;
}

export interface SubscriptionInfo {
  plan_code: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  trial_active: boolean;
  active: boolean;
  subscription:
    | {
        plan_code: string;
        provider: string;
        status: string;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        updated_at: string;
      }
    | null;
}

/**
 * Estado de billing da org do usuário: assinatura + trial + catálogo de planos.
 * Inclui checkout (cria preapproval no MP e devolve a URL pra redirecionar) e
 * refresh (repolla o MP pós-retorno do checkout).
 */
export function useBilling() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sub, pl] = await Promise.all([
        apiGet<SubscriptionInfo>("/billing/subscription"),
        apiGet<{ plans: Plan[] }>("/billing/plans"),
      ]);
      setInfo(sub);
      setPlans(pl.plans ?? []);
    } catch {
      setError("Não foi possível carregar sua assinatura.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Cria a assinatura no MP e devolve a URL de checkout (init_point). */
  const checkout = useCallback(async (planCode: string): Promise<string | null> => {
    const backUrl = `${window.location.origin}/conta?billing=return`;
    const res = await api<{ checkoutUrl: string | null }>("/billing/mp/checkout", {
      method: "POST",
      body: { planCode, backUrl },
    });
    return res.checkoutUrl ?? null;
  }, []);

  /** Repolla o MP e reconcilia (chamar quando o usuário volta do checkout). */
  const refresh = useCallback(async () => {
    try {
      await api("/billing/mp/refresh", { method: "POST", body: {} });
    } catch {
      /* silencioso — o webhook reconcilia de qualquer forma */
    }
    await load();
  }, [load]);

  return { info, plans, loading, error, reload: load, checkout, refresh };
}
