// Helpers de segurança das bordas públicas (webhook, cron).

/** Comparação de strings em tempo constante — evita timing attacks em segredos. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * Verifica a assinatura `X-Hub-Signature-256` da Meta: HMAC-SHA256 do corpo CRU
 * (exatamente os bytes recebidos) com o App Secret. A Meta manda
 * `sha256=<hex>`. Sem isso, qualquer um que saiba a URL forja eventos.
 */
export async function verifyMetaSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const computed = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return timingSafeEqual(computed, expected);
  } catch (e) {
    console.error("[security] verifyMetaSignature error:", e);
    return false;
  }
}
