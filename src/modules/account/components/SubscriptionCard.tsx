import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Premium from "~icons/material-symbols-light/workspace-premium-outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
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

/**
 * Card de Assinatura na tela de Conta. Mostra o estado atual (ativa ou trial) e,
 * quando não há assinatura ativa, lista os planos com botão "Assinar" que cria o
 * preapproval no Mercado Pago e redireciona pro checkout. Ao voltar do checkout
 * (?billing=return), repolla o MP pra refletir o novo estado.
 */
export function SubscriptionCard({ className }: { className?: string }) {
  const { info, plans, loading, error, checkout, refresh } = useBilling();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const returnedRef = useRef(false);

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
        </div>
      )}
    </section>
  );
}
