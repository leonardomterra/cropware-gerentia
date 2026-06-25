/**
 * Mercado Pago — assinaturas (preapproval) para o gerentia.app.
 *
 * Padrão herdado do Cropware (make-server-875c00b5): cria preapproval, busca
 * estado, valida a assinatura HMAC-SHA256 do webhook e mapeia o status do MP
 * pro vocabulário interno. Segredos via `secret()` (GERENTIA_* com fallback FARM_*).
 *
 * Env esperado:
 *   GERENTIA_MP_ACCESS_TOKEN   Bearer da API do MP
 *   GERENTIA_MP_WEBHOOK_SECRET segredo p/ validar a assinatura do webhook
 *   GERENTIA_MP_BACK_URL       (opcional) URL de retorno pós-checkout
 */
import { secret } from "./env.ts";

const MP_API = "https://api.mercadopago.com";

export function getMpToken(): string | undefined {
  return secret("GERENTIA_MP_ACCESS_TOKEN");
}

export function getMpWebhookSecret(): string | undefined {
  return secret("GERENTIA_MP_WEBHOOK_SECRET");
}

export function getMpBackUrl(): string | undefined {
  return secret("GERENTIA_MP_BACK_URL");
}

/** Vocabulário interno de status de assinatura. */
export type SubStatus =
  | "pending"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "paused";

/** Mapeia o status do preapproval do MP pro interno. */
export function mapMpStatus(status: string | null | undefined): SubStatus {
  const v = String(status || "").toLowerCase();
  if (!v) return "pending";
  if (["authorized", "active", "approved"].includes(v)) return "active";
  if (v === "pending") return "pending";
  if (v === "paused") return "paused";
  if (["cancelled", "canceled"].includes(v)) return "canceled";
  if (v === "expired") return "expired";
  return "pending";
}

/** Acesso liberado enquanto a assinatura está ativa. */
export function isAccessEnabled(status: SubStatus): boolean {
  return status === "active";
}

interface CreatePreapprovalInput {
  reason: string;
  payerEmail: string;
  amount: number; // em reais (transaction_amount)
  currency: string; // BRL
  interval: "monthly" | "yearly";
  externalReference: string;
  backUrl?: string;
}

/** Cria um preapproval (assinatura recorrente) no MP. Retorna o JSON do MP. */
export async function createPreapproval(input: CreatePreapprovalInput) {
  const token = getMpToken();
  if (!token) throw new Error("mp_not_configured");

  const body = {
    reason: input.reason,
    external_reference: input.externalReference,
    payer_email: input.payerEmail,
    auto_recurring: {
      frequency: input.interval === "yearly" ? 12 : 1,
      frequency_type: "months",
      transaction_amount: input.amount,
      currency_id: input.currency || "BRL",
      start_date: new Date().toISOString(),
    },
    back_url: input.backUrl || getMpBackUrl() || undefined,
    status: "pending",
  };

  const resp = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`mp_create_failed ${resp.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

/** Busca o estado atual de um preapproval no MP. */
export async function fetchPreapproval(preapprovalId: string) {
  const token = getMpToken();
  if (!token) throw new Error("mp_not_configured");
  const resp = await fetch(
    `${MP_API}/preapproval/${encodeURIComponent(preapprovalId)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`mp_fetch_failed ${resp.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

/** Busca um authorized_payment (evento subscription_authorized_payment). */
export async function fetchAuthorizedPayment(authorizedPaymentId: string) {
  const token = getMpToken();
  if (!token) throw new Error("mp_not_configured");
  const resp = await fetch(
    `${MP_API}/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`mp_authpay_failed ${resp.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Validação de assinatura do webhook (x-signature: ts=...,v1=...)
// Manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
// ---------------------------------------------------------------------------

function parseSignatureHeader(header: string | null) {
  const out: { ts: string | null; v1: string | null } = { ts: null, v1: null };
  if (!header) return out;
  for (const part of header.split(",")) {
    const [rawK, rawV] = part.split("=", 2);
    const k = String(rawK || "").trim().toLowerCase();
    const val = String(rawV || "").trim();
    if (k === "ts" && val) out.ts = val;
    if (k === "v1" && val) out.v1 = val.toLowerCase();
  }
  return out;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const l = String(a || "").toLowerCase();
  const r = String(b || "").toLowerCase();
  if (!l || !r || l.length !== r.length) return false;
  let mismatch = 0;
  for (let i = 0; i < l.length; i += 1) {
    mismatch |= l.charCodeAt(i) ^ r.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SignatureCheck {
  enabled: boolean;
  valid: boolean;
  reason: string;
}

/**
 * Valida a assinatura do webhook do MP. Se o segredo não estiver configurado,
 * retorna { enabled:false, valid:true } (modo permissivo p/ ambiente sem
 * segredo) — em produção, configure GERENTIA_MP_WEBHOOK_SECRET.
 */
export async function verifyWebhookSignature(
  req: Request,
  fallbackDataId?: string | null,
): Promise<SignatureCheck> {
  const webhookSecret = getMpWebhookSecret();
  if (!webhookSecret) {
    return { enabled: false, valid: true, reason: "secret_not_configured" };
  }

  const url = new URL(req.url);
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id") || "";
  const { ts, v1 } = parseSignatureHeader(xSignature);
  const dataId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    fallbackDataId ||
    "";

  if (!ts || !v1 || !xRequestId || !dataId) {
    return { enabled: true, valid: false, reason: "missing_signature_parts" };
  }

  const manifest = `id:${String(dataId).trim().toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const expected = await hmacSha256Hex(webhookSecret, manifest);
  const valid = timingSafeEqualHex(expected, v1);
  return { enabled: true, valid, reason: valid ? "ok" : "mismatch" };
}
