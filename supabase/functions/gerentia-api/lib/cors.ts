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
    // Reflete a origin só se estiver na allowlist; senão retorna null (bloqueia).
    origin: (origin) => {
      if (!origin) return null;
      return allowed.includes(origin.replace(/\/$/, "")) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-cron-secret"],
    maxAge: 86400,
  });
}
