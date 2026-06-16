import { cors } from "npm:hono/cors";

/**
 * CORS para o app web. O webhook do WhatsApp é server-to-server (Meta), então
 * CORS não o afeta — isto só governa o frontend no navegador.
 *
 * Se GERENTIA_ALLOWED_ORIGINS estiver setada (lista separada por vírgula),
 * só essas origens são refletidas no Access-Control-Allow-Origin. Sem ela,
 * fail-open com "*" pra não quebrar o app antes de configurar.
 */
export function corsMiddleware() {
  const raw = Deno.env.get("GERENTIA_ALLOWED_ORIGINS")?.trim();
  if (!raw) {
    console.warn("[cors] GERENTIA_ALLOWED_ORIGINS ausente — CORS aberto (*). Configure pra restringir.");
    return cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["authorization", "content-type", "x-cron-secret"],
      maxAge: 86400,
    });
  }

  const allowed = raw.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  return cors({
    // Reflete a origin se estiver na allowlist OU for localhost/127.0.0.1 (dev).
    origin: (origin) => {
      if (!origin) return null;
      const o = origin.replace(/\/$/, "");
      if (allowed.includes(o)) return origin;
      // Dev local: libera qualquer porta de localhost/127.0.0.1. Sem risco de
      // CSRF aqui porque a API usa Bearer token (não cookie) — uma página
      // localhost não consegue ler o token do app em gerentia.app.
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-cron-secret"],
    maxAge: 86400,
  });
}
