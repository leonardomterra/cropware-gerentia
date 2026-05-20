import type { Context } from "npm:hono";

/**
 * Valida header x-cron-secret contra env FARM_CRON_SECRET.
 *
 * O secret e setado no vault.decrypted_secrets (ver migration 0006 do
 * blueprint, ainda nao aplicada) e o pg_cron usa quando dispara o job.
 *
 * NUNCA hardcodar no command do pg_cron - vaza em logs/inspect.
 */
export function requireCronSecret(c: Context): Response | null {
  const expected = Deno.env.get("FARM_CRON_SECRET");
  if (!expected) {
    console.error("[cronGuard] FARM_CRON_SECRET not configured in edge env");
    return c.json({ error: "cron_not_configured" }, 503);
  }
  const provided = c.req.header("x-cron-secret");
  if (provided !== expected) {
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}
