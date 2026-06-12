import { cors } from "npm:hono/cors";

/**
 * CORS aberto pra todas as origens. Em producao com dominio custom,
 * podemos restringir via env GERENTIA_ALLOWED_ORIGINS.
 */
export function corsMiddleware() {
  return cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-cron-secret"],
    maxAge: 86400,
  });
}
