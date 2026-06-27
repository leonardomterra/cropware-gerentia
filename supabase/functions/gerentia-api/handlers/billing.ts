import type { Hono } from "npm:hono";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getUserClient, requireFarmUser, requireFarmAdmin } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import {
  createPreapproval,
  fetchAuthorizedPayment,
  fetchPreapproval,
  getMpToken,
  isAccessEnabled,
  mapMpStatus,
  verifyWebhookSignature,
  type SubStatus,
} from "../lib/mercadopago.ts";

/**
 * Billing — assinatura web via Mercado Pago (preapproval). RevenueCat (iOS/
 * Android IAP) entra depois — ver docs/FARM-PRICING.md §7.
 *
 * Fonte de verdade do estado: tabela `subscriptions` (por organização). A cada
 * reconciliação refletimos plan_code/status/period_end em `organizations` pra
 * gating rápido. Webhooks são públicos (deploy --no-verify-jwt); a validação é
 * por assinatura HMAC (webhook MP) dentro do handler.
 *
 * Rotas:
 *   GET  /billing/plans               catálogo de planos ativos
 *   GET  /billing/subscription        assinatura + trial da org do usuário
 *   POST /billing/mp/checkout         cria preapproval, devolve init_point
 *   POST /billing/mp/refresh          repolla o MP e reconcilia
 *   POST /webhook/mp                  webhook do Mercado Pago
 *   POST /webhook/revenuecat          (501 — implementar com os apps)
 */

interface PreapprovalJson {
  id?: string;
  status?: string;
  init_point?: string;
  sandbox_init_point?: string;
  date_created?: string;
  next_payment_date?: string;
  external_reference?: string;
  auto_recurring?: { start_date?: string };
}

function tryParseJson(s: unknown): Record<string, unknown> | null {
  if (typeof s !== "string") return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Aplica o estado de um preapproval do MP na assinatura + reflete na org.
 * Service role (bypassa RLS). Idempotente.
 */
async function reconcile(
  admin: SupabaseClient,
  subscription: { id: string; organization_id: string; plan_code: string; metadata?: Record<string, unknown> | null },
  mp: PreapprovalJson,
  eventMeta?: { eventType?: string; providerEventId?: string },
): Promise<{ status: SubStatus; periodEnd: string | null }> {
  const status = mapMpStatus(mp.status);
  const periodStart = mp.auto_recurring?.start_date || mp.date_created || null;
  const periodEnd = mp.next_payment_date || null;

  const metadata = {
    ...(subscription.metadata || {}),
    provider_status_raw: mp.status || null,
    mp_preapproval: mp,
    ...(eventMeta
      ? {
          last_webhook: {
            event_type: eventMeta.eventType || "unknown",
            provider_event_id: eventMeta.providerEventId || null,
            received_at: new Date().toISOString(),
          },
        }
      : {}),
  };

  await admin
    .from("subscriptions")
    .update({
      provider_preapproval_id: String(mp.id ?? ""),
      provider_subscription_id: String(mp.id ?? ""),
      status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      last_event_at: new Date().toISOString(),
      metadata,
    })
    .eq("id", subscription.id);

  // Reflete na org pro gating rápido. Quando ativa: grava plan_code; quando
  // cai (canceled/expired/paused/past_due): mantém o plan_code mas marca status.
  const orgPatch: Record<string, unknown> = {
    subscription_status: status,
    subscription_current_period_end: periodEnd,
  };
  if (isAccessEnabled(status)) orgPatch.plan_code = subscription.plan_code;

  await admin
    .from("organizations")
    .update(orgPatch)
    .eq("id", subscription.organization_id);

  return { status, periodEnd };
}

/**
 * Mapeia um evento do RevenueCat (tipo + expiração) pro nosso SubStatus.
 * RevenueCat manda o estado já resolvido por evento; access = entitlement não expirado.
 */
function mapRcEvent(
  type: string,
  expirationAtMs: number | null,
): { status: SubStatus; cancelAtPeriodEnd: boolean } {
  const now = Date.now();
  const hasAccess = expirationAtMs != null && expirationAtMs > now;
  const t = (type || "").toUpperCase();
  if (t === "EXPIRATION") return { status: "expired", cancelAtPeriodEnd: false };
  if (t === "SUBSCRIPTION_PAUSED") return { status: "paused", cancelAtPeriodEnd: false };
  if (t === "BILLING_ISSUE")
    return { status: hasAccess ? "past_due" : "expired", cancelAtPeriodEnd: false };
  if (t === "CANCELLATION")
    // Auto-renew desligado: segue ativo até expirar (cancela no fim do período).
    return { status: hasAccess ? "active" : "expired", cancelAtPeriodEnd: true };
  // INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE, SUBSCRIPTION_EXTENDED,
  // NON_RENEWING_PURCHASE, TRANSFER -> ativo enquanto não expirado.
  return { status: hasAccess ? "active" : "expired", cancelAtPeriodEnd: false };
}

export function mountBillingRoutes(app: Hono) {
  // -------------------------------------------------------------------------
  // GET /billing/plans — catálogo de planos ativos
  // -------------------------------------------------------------------------
  app.get("/billing/plans", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const { data, error } = await client
        .from("plans")
        .select("code, name, description, price_cents, currency, billing_interval, metadata, sort")
        .eq("active", true)
        .order("sort", { ascending: true });
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ plans: data ?? [] });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // -------------------------------------------------------------------------
  // GET /billing/subscription — assinatura + trial da org do usuário
  // -------------------------------------------------------------------------
  app.get("/billing/subscription", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const { data: org } = await client
        .from("organizations")
        .select("plan_code, subscription_status, subscription_current_period_end, trial_started_at, trial_ends_at")
        .eq("id", auth.organizationId!)
        .maybeSingle();

      const { data: sub } = await client
        .from("subscriptions")
        .select("plan_code, provider, status, current_period_end, cancel_at_period_end, updated_at")
        .eq("organization_id", auth.organizationId!)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = Date.now();
      const trialEndsAt = org?.trial_ends_at ?? null;
      const trialActive = !!trialEndsAt && new Date(trialEndsAt).getTime() > now;
      const subActive = sub?.status === "active";

      return c.json({
        plan_code: org?.plan_code ?? null,
        subscription_status: org?.subscription_status ?? null,
        trial_ends_at: trialEndsAt,
        trial_active: trialActive,
        active: subActive || trialActive,
        subscription: sub ?? null,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // -------------------------------------------------------------------------
  // POST /billing/mp/checkout — cria preapproval, devolve init_point
  // -------------------------------------------------------------------------
  app.post("/billing/mp/checkout", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;

      if (!getMpToken()) {
        return c.json({ error: "mp_not_configured" }, 503);
      }

      const body = await c.req.json().catch(() => null);
      const planCode = body && typeof body.planCode === "string" ? body.planCode : null;
      if (!planCode) return c.json({ error: "planCode obrigatorio" }, 400);

      const admin = getSupabaseAdmin();

      const { data: plan } = await admin
        .from("plans")
        .select("*")
        .eq("code", planCode)
        .eq("active", true)
        .maybeSingle();
      if (!plan) return c.json({ error: "plan_not_found" }, 404);

      const payerEmail = auth.user!.email;
      if (!payerEmail) return c.json({ error: "missing_payer_email" }, 400);
      const payerName =
        (auth.user!.user_metadata?.full_name as string | undefined) || payerEmail;

      // Upsert do billing_customer (idempotente por provider+user).
      await admin
        .from("billing_customers")
        .upsert(
          {
            user_id: auth.user!.id,
            organization_id: auth.organizationId,
            provider: "mercadopago",
            email: payerEmail,
            name: payerName,
          },
          { onConflict: "provider,user_id" },
        );

      const externalReference = JSON.stringify({
        app: "gerentia",
        organization_id: auth.organizationId,
        user_id: auth.user!.id,
        plan_code: plan.code,
      });

      const backUrl = body && typeof body.backUrl === "string" ? body.backUrl : undefined;

      const mp = (await createPreapproval({
        reason: plan.name,
        payerEmail,
        amount: (plan.price_cents ?? 0) / 100,
        currency: plan.currency || "BRL",
        interval: plan.billing_interval === "yearly" ? "yearly" : "monthly",
        externalReference,
        backUrl,
      })) as PreapprovalJson;

      const status = mapMpStatus(mp.status);

      // Registra a assinatura (estado inicial). Webhook/refresh atualizam depois.
      const { data: sub, error: subErr } = await admin
        .from("subscriptions")
        .insert({
          organization_id: auth.organizationId,
          created_by: auth.user!.id,
          plan_code: plan.code,
          provider: "mercadopago",
          provider_subscription_id: mp.id ?? null,
          provider_preapproval_id: mp.id ?? null,
          status,
          current_period_start: mp.auto_recurring?.start_date || mp.date_created || null,
          current_period_end: mp.next_payment_date || null,
          last_event_at: new Date().toISOString(),
          metadata: { provider_status_raw: mp.status, mp_preapproval: mp },
        })
        .select("id")
        .single();
      if (subErr) return c.json({ error: "subscription_persist_failed" }, 500);

      return c.json({
        subscriptionId: sub.id,
        provider: "mercadopago",
        checkoutUrl: mp.init_point || mp.sandbox_init_point || null,
        status,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      console.error("[billing] checkout error:", resp);
      return new Response(JSON.stringify({ error: "checkout_failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  });

  // -------------------------------------------------------------------------
  // POST /billing/mp/refresh — repolla o MP e reconcilia (pós-retorno do checkout)
  // -------------------------------------------------------------------------
  app.post("/billing/mp/refresh", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const admin = getSupabaseAdmin();

      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, organization_id, plan_code, provider_preapproval_id, metadata")
        .eq("organization_id", auth.organizationId!)
        .eq("provider", "mercadopago")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub?.provider_preapproval_id) {
        return c.json({ error: "no_subscription" }, 404);
      }

      const mp = (await fetchPreapproval(sub.provider_preapproval_id)) as PreapprovalJson;
      const { status, periodEnd } = await reconcile(admin, sub, mp);
      return c.json({ status, current_period_end: periodEnd });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      console.error("[billing] refresh error:", resp);
      return new Response(JSON.stringify({ error: "refresh_failed" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  });

  // -------------------------------------------------------------------------
  // POST /webhook/mp — webhook do Mercado Pago (público, valida assinatura)
  // -------------------------------------------------------------------------
  app.post("/webhook/mp", async (c) => {
    try {
      const rawBody = await c.req.raw.clone().text().catch(() => "");
      const body = tryParseJson(rawBody) ?? {};
      const url = new URL(c.req.url);
      const queryDataId =
        url.searchParams.get("data.id") || url.searchParams.get("id") || undefined;

      const eventType = String(
        (body as Record<string, unknown>).type ||
          (body as Record<string, unknown>).topic ||
          (body as Record<string, unknown>).action ||
          url.searchParams.get("type") ||
          url.searchParams.get("topic") ||
          "unknown",
      );

      // 1. Assinatura
      const dataId =
        ((body as Record<string, unknown>).data as Record<string, unknown> | undefined)?.id ??
        queryDataId;
      const sig = await verifyWebhookSignature(c.req.raw, dataId ? String(dataId) : null);
      if (!sig.valid) {
        return c.json({ error: "invalid_signature", reason: sig.reason }, 401);
      }

      const admin = getSupabaseAdmin();

      const providerEventId = String(
        (body as Record<string, unknown>).id ||
          dataId ||
          `${eventType}:${url.searchParams.toString()}`,
      );

      // 2. Idempotência
      const { data: existing } = await admin
        .from("billing_events")
        .select("id, processed")
        .eq("provider", "mercadopago")
        .eq("provider_event_id", providerEventId)
        .maybeSingle();
      if (existing?.processed) return c.json({ ok: true, duplicate: true });

      const { data: eventRow, error: evErr } = await admin
        .from("billing_events")
        .upsert(
          {
            provider: "mercadopago",
            event_type: eventType,
            provider_event_id: providerEventId,
            payload: { body, query: url.search, signature: sig },
            processed: false,
          },
          { onConflict: "provider,provider_event_id" },
        )
        .select("id")
        .single();
      if (evErr) return c.json({ error: "event_persist_failed" }, 500);

      // 3. Resolve o preapproval id conforme o tipo de evento. Só tratamos
      //    eventos de assinatura; "payment"/outros tipos são ignorados (sem 500).
      const evLower = eventType.toLowerCase();
      let preapprovalId: string | null = null;
      if (evLower.includes("authorized_payment")) {
        // Pagamento recorrente: resolve o preapproval via authorized_payment.
        if (dataId) {
          try {
            const ap = (await fetchAuthorizedPayment(String(dataId))) as Record<string, unknown>;
            const fromPreapproval = (ap.preapproval as Record<string, unknown> | undefined)?.id;
            preapprovalId = String(ap.preapproval_id ?? fromPreapproval ?? "") || null;
          } catch {
            preapprovalId = null;
          }
        }
      } else if (evLower.includes("preapproval")) {
        preapprovalId = dataId ? String(dataId) : null;
      }

      if (!preapprovalId) {
        await admin
          .from("billing_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", eventRow.id);
        return c.json({ ok: true, ignored: true, reason: "unhandled_event_or_no_preapproval" });
      }

      // 4. Estado atual no MP
      const mp = (await fetchPreapproval(preapprovalId)) as PreapprovalJson;

      // 5. Acha a assinatura (por preapproval id; fallback por external_reference)
      let { data: sub } = await admin
        .from("subscriptions")
        .select("id, organization_id, plan_code, metadata")
        .eq("provider", "mercadopago")
        .or(
          `provider_preapproval_id.eq.${preapprovalId},provider_subscription_id.eq.${preapprovalId}`,
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) {
        const ext = tryParseJson(mp.external_reference);
        const orgId = ext?.organization_id ? String(ext.organization_id) : null;
        const planCode = ext?.plan_code ? String(ext.plan_code) : null;
        if (orgId) {
          const q = admin
            .from("subscriptions")
            .select("id, organization_id, plan_code, metadata")
            .eq("provider", "mercadopago")
            .eq("organization_id", orgId)
            .order("updated_at", { ascending: false })
            .limit(1);
          if (planCode) q.eq("plan_code", planCode);
          const { data: fb } = await q.maybeSingle();
          sub = fb ?? null;
        }
      }

      if (!sub) {
        await admin
          .from("billing_events")
          .update({
            processed: false,
            processed_at: new Date().toISOString(),
            error: `subscription_not_found for ${preapprovalId}`,
          })
          .eq("id", eventRow.id);
        return c.json({ ok: false, error: "subscription_not_found" }, 404);
      }

      // 6. Reconcilia
      const { status } = await reconcile(admin, sub, mp, {
        eventType,
        providerEventId,
      });

      await admin
        .from("billing_events")
        .update({ processed: true, processed_at: new Date().toISOString(), error: null })
        .eq("id", eventRow.id);

      return c.json({ ok: true, status });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      console.error("[billing] mp webhook error:", resp);
      return c.json({ error: "webhook_failed" }, 500);
    }
  });

  // -------------------------------------------------------------------------
  // POST /webhook/revenuecat — iOS (StoreKit) + Android (Play Billing) via RevenueCat.
  // Público (--no-verify-jwt); validação por header Authorization configurado no
  // painel do RevenueCat (env REVENUECAT_WEBHOOK_AUTH). app_user_id = user.id
  // (setado no identify do AppShell). Fonte de verdade do estado de assinatura IAP.
  // -------------------------------------------------------------------------
  app.post("/webhook/revenuecat", async (c) => {
    try {
      // 1. Auth do webhook (header configurado no RevenueCat).
      const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH")?.trim();
      const gotAuth = c.req.header("authorization")?.trim();
      if (expectedAuth) {
        if (gotAuth !== expectedAuth) return c.json({ error: "invalid_auth" }, 401);
      } else {
        console.warn(
          "[revenuecat] REVENUECAT_WEBHOOK_AUTH ausente — aceitando sem validar. Configure pra proteger.",
        );
      }

      const raw = await c.req.raw.clone().text().catch(() => "");
      const body = tryParseJson(raw) ?? {};
      const event = (body as Record<string, unknown>).event as
        | Record<string, unknown>
        | undefined;
      if (!event) return c.json({ ok: true, ignored: true, reason: "no_event" });

      const type = String(event.type ?? "unknown");
      if (type.toUpperCase() === "TEST") return c.json({ ok: true, test: true });

      const appUserId = event.app_user_id ? String(event.app_user_id) : null;
      const productId = event.product_id ? String(event.product_id) : null;
      const expRaw = event.expiration_at_ms;
      const expirationAtMs =
        typeof expRaw === "number" ? expRaw : expRaw ? Number(expRaw) : null;
      const eventId = String(
        event.id ?? `${type}:${appUserId ?? "?"}:${event.event_timestamp_ms ?? ""}`,
      );

      const admin = getSupabaseAdmin();

      // 2. Idempotência.
      const { data: existing } = await admin
        .from("billing_events")
        .select("id, processed")
        .eq("provider", "revenuecat")
        .eq("provider_event_id", eventId)
        .maybeSingle();
      if (existing?.processed) return c.json({ ok: true, duplicate: true });

      const { data: eventRow, error: evErr } = await admin
        .from("billing_events")
        .upsert(
          {
            provider: "revenuecat",
            event_type: type,
            provider_event_id: eventId,
            payload: { body },
            processed: false,
          },
          { onConflict: "provider,provider_event_id" },
        )
        .select("id")
        .single();
      if (evErr) return c.json({ error: "event_persist_failed" }, 500);

      const markProcessed = (error: string | null = null) =>
        admin
          .from("billing_events")
          .update({ processed: !error, processed_at: new Date().toISOString(), error })
          .eq("id", eventRow.id);

      // 3. Resolve org + um user (created_by) via app_user_id (= user.id do identify).
      if (!appUserId) {
        await markProcessed();
        return c.json({ ok: true, ignored: true, reason: "no_app_user_id" });
      }
      let orgId: string | null = null;
      let createdBy: string | null = null;
      const { data: meta } = await admin
        .from("users_meta")
        .select("organization_id, user_id")
        .eq("user_id", appUserId)
        .maybeSingle();
      if (meta?.organization_id) {
        orgId = meta.organization_id as string;
        createdBy = meta.user_id as string;
      } else {
        // Fallback: app_user_id pode ser o organization_id direto.
        const { data: org } = await admin
          .from("organizations")
          .select("id")
          .eq("id", appUserId)
          .maybeSingle();
        if (org?.id) {
          orgId = org.id as string;
          const { data: owner } = await admin
            .from("users_meta")
            .select("user_id")
            .eq("organization_id", orgId)
            .eq("role", "owner")
            .limit(1)
            .maybeSingle();
          createdBy = (owner?.user_id as string | undefined) ?? null;
        }
      }
      if (!orgId || !createdBy) {
        await markProcessed(`org_or_user_not_found for app_user_id ${appUserId}`);
        return c.json({ ok: false, error: "org_not_found" }, 404);
      }

      // 4. Status + plano (product_id == plan_code: gerentia_pro_monthly/_yearly).
      const { status, cancelAtPeriodEnd } = mapRcEvent(type, expirationAtMs);
      const planCode = productId;
      const periodEnd = expirationAtMs
        ? new Date(expirationAtMs).toISOString()
        : null;
      const store = event.store ? String(event.store) : "app_store";
      const provider = "revenuecat"; // um provider pros dois stores (store fica no metadata)

      // 5. Upsert da subscription (acha por org+revenuecat; update senão insert).
      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, metadata")
        .eq("organization_id", orgId)
        .eq("provider", provider)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const metadata = {
        ...((sub?.metadata as Record<string, unknown> | null) || {}),
        provider_status_raw: type,
        rc_store: store,
        rc_event: event,
        last_webhook: {
          event_type: type,
          provider_event_id: eventId,
          received_at: new Date().toISOString(),
        },
      };

      const fields = {
        plan_code: planCode,
        status,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        provider_subscription_id: appUserId,
        last_event_at: new Date().toISOString(),
        metadata,
      };

      if (sub) {
        await admin.from("subscriptions").update(fields).eq("id", sub.id);
      } else {
        await admin.from("subscriptions").insert({
          organization_id: orgId,
          created_by: createdBy,
          provider,
          ...fields,
        });
      }

      // 6. Reflete na org pro gating rápido.
      const orgPatch: Record<string, unknown> = {
        subscription_status: status,
        subscription_current_period_end: periodEnd,
      };
      if (isAccessEnabled(status) && planCode) orgPatch.plan_code = planCode;
      await admin.from("organizations").update(orgPatch).eq("id", orgId);

      await markProcessed();
      return c.json({ ok: true, status, provider });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      console.error("[billing] revenuecat webhook error:", resp);
      return c.json({ error: "webhook_failed" }, 500);
    }
  });
}
