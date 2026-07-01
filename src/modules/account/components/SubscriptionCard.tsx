import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Premium from "~icons/material-symbols-light/workspace-premium-outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { isNativeCapacitorApp } from "@/utils/platform";
import { useAuth } from "@/contexts/AuthContext";
import {
  isRevenueCatConfigured,
  loadOfferingPackages,
  purchasePackage as rcPurchase,
  restorePurchases as rcRestore,
  type RcPackage,
} from "@/lib/revenuecat";
import { useBilling, type Plan } from "../hooks/useBilling";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

function intervalLabel(interval: Plan["billing_interval"]): string {
  return interval === "yearly" ? "/ano" : "/mês";
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

const PRIVACY_URL = "https://gerentia.app/privacidade.html";
// EULA padrão da Apple (exigido no fluxo de compra de assinaturas — guideline 3.1.2).
const TERMS_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

/** Divulgação de renovação automática + links obrigatórios (Termos de Uso / Privacidade). */
function SubscriptionLegal() {
  return (
    <p className="text-xs text-slate-400 leading-relaxed">
      A assinatura renova automaticamente pelo mesmo período até ser cancelada.{" "}
      <a
        href={TERMS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-600"
      >
        Termos de Uso
      </a>{" "}
      ·{" "}
      <a
        href={PRIVACY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-600"
      >
        Política de Privacidade
      </a>
    </p>
  );
}

/**
 * Card de Assinatura na tela de Conta. Mostra o estado atual (ativa ou trial) e,
 * quando não há assinatura ativa, lista os planos com botão "Assinar" que cria o
 * preapproval no Mercado Pago e redireciona pro checkout. Ao voltar do checkout
 * (?billing=return), repolla o MP pra refletir o novo estado.
 */
export function SubscriptionCard({ className }: { className?: string }) {
  const { info, plans, loading, error, checkout, refresh } = useBilling();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const returnedRef = useRef(false);

  // RevenueCat (app nativo): ofertas + estado de compra/restauração.
  const [rcPackages, setRcPackages] = useState<RcPackage[]>([]);
  const [rcBusy, setRcBusy] = useState<string | null>(null);
  const [rcRestoring, setRcRestoring] = useState(false);

  useEffect(() => {
    if (!isNativeCapacitorApp() || !isRevenueCatConfigured() || !user?.id) return;
    let cancelled = false;
    loadOfferingPackages()
      .then((pkgs) => {
        if (!cancelled) setRcPackages(pkgs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function handleRcPurchase(pkg: RcPackage) {
    setRcBusy(pkg.id);
    try {
      const { active } = await rcPurchase(pkg.raw);
      if (active) {
        toast.success("Assinatura ativada!");
        await refresh();
      }
    } catch {
      /* cancelado pelo usuário ou erro — silencioso */
    } finally {
      setRcBusy(null);
    }
  }

  async function handleRcRestore() {
    setRcRestoring(true);
    try {
      const { active } = await rcRestore();
      if (active) {
        toast.success("Compras restauradas.");
        await refresh();
      } else {
        toast.info("Nenhuma assinatura encontrada.");
      }
    } catch {
      toast.error("Não foi possível restaurar agora.");
    } finally {
      setRcRestoring(false);
    }
  }

  // Retorno do checkout do MP: reconcilia uma vez e limpa a query.
  useEffect(() => {
    if (returnedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "return") {
      returnedRef.current = true;
      void refresh().then(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("billing");
        window.history.replaceState({}, "", url.pathname + url.search);
      });
    }
  }, [refresh]);

  async function handleSubscribe(planCode: string) {
    setSubmitting(planCode);
    try {
      const url = await checkout(planCode);
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Não foi possível iniciar o checkout. Tente novamente.");
        setSubmitting(null);
      }
    } catch {
      toast.error("Não foi possível iniciar o checkout. Tente novamente.");
      setSubmitting(null);
    }
  }

  const isActive = info?.subscription?.status === "active";
  const trialActive = info?.trial_active ?? false;
  // Regra dura da Play/App Store: o app nativo NÃO pode oferecer pagamento
  // externo (Mercado Pago). No nativo, mostramos só o status; a compra entra
  // via loja (RevenueCat) quando os produtos estiverem configurados.
  const isNative = isNativeCapacitorApp();

  return (
    <section
      className={cn("bg-white rounded-lg border border-slate-200 p-5", className)}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 shrink-0">
          <Premium className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-slate-900">Assinatura</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Seu plano e cobrança.
          </p>
        </div>
        {isActive ? (
          <Badge colorScheme="emerald">Ativa</Badge>
        ) : trialActive ? (
          <Badge colorScheme="amber">Trial</Badge>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : isActive ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500">Plano</p>
            <p className="text-sm text-slate-900 mt-1">
              {plans.find((p) => p.code === info?.subscription?.plan_code)?.name ??
                info?.subscription?.plan_code}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Próxima cobrança</p>
            <p className="text-sm text-slate-900 mt-1">
              {formatDate(info?.subscription?.current_period_end ?? null)}
            </p>
          </div>
          <p className="text-xs text-slate-400 sm:col-span-2">
            Para cancelar, acesse sua assinatura no Mercado Pago.
          </p>
        </div>
      ) : isNative ? (
        // App nativo: compra via loja (RevenueCat). Nunca checkout externo (regra
        // da Play/App Store). Sem produtos configurados, cai no aviso "em breve".
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {trialActive
              ? `Seu período de teste termina em ${formatDate(info?.trial_ends_at ?? null)}.`
              : "Você ainda não tem uma assinatura ativa."}
          </p>
          {rcPackages.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rcPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="rounded-lg border border-slate-200 p-4 flex flex-col gap-2"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {pkg.title}
                    </span>
                    <span className="text-base font-medium text-slate-900">
                      {pkg.priceString}
                      {pkg.period ? (
                        <span className="text-xs font-normal text-slate-500">
                          {pkg.period}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      className="mt-1"
                      onClick={() => handleRcPurchase(pkg)}
                      disabled={rcBusy !== null}
                    >
                      {rcBusy === pkg.id ? "Processando..." : "Assinar"}
                    </Button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRcRestore}
                disabled={rcRestoring}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {rcRestoring ? "Restaurando..." : "Restaurar compras"}
              </button>
              <SubscriptionLegal />
            </>
          ) : (
            <p className="text-xs text-slate-400">
              Assinaturas pelo app chegam em breve.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {trialActive
              ? `Seu período de teste termina em ${formatDate(info?.trial_ends_at ?? null)}. Escolha um plano para continuar.`
              : "Escolha um plano para continuar usando o Gerentia."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plans.map((plan) => {
              const founder = plan.metadata?.founder === true;
              return (
                <div
                  key={plan.code}
                  className={cn(
                    "rounded-lg border p-4 flex flex-col gap-2",
                    founder ? "border-slate-300 bg-slate-50" : "border-slate-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {plan.name}
                    </span>
                    {founder ? <Badge>Fundador</Badge> : null}
                  </div>
                  <div className="text-slate-900">
                    <span className="text-base font-medium">
                      {formatBRL(plan.price_cents)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {intervalLabel(plan.billing_interval)}
                    </span>
                  </div>
                  {plan.description ? (
                    <p className="text-xs text-slate-500">{plan.description}</p>
                  ) : null}
                  <Button
                    className="mt-1"
                    onClick={() => handleSubscribe(plan.code)}
                    disabled={submitting !== null}
                  >
                    {submitting === plan.code ? "Abrindo checkout..." : "Assinar"}
                  </Button>
                </div>
              );
            })}
          </div>
          <SubscriptionLegal />
        </div>
      )}
    </section>
  );
}
