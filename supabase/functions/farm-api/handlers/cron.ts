import type { Hono } from "npm:hono";
import { requireCronSecret } from "../lib/cronGuard.ts";

/**
 * Jobs disparados via pg_cron (HTTP POST com header x-cron-secret).
 *
 * V2: mark_overdue diario - varre farm_receipts com due_date < today e
 * status='a_pagar', muda pra 'vencido', opcionalmente notifica via WhatsApp.
 *
 * V3+: resumo_semanal (sextas 18h), detect_duplicates, etc.
 */
export function mountCronRoutes(app: Hono) {
  app.post("/cron/mark-overdue", (c) => {
    const denied = requireCronSecret(c);
    if (denied) return denied;
    return c.json({ error: "not_implemented", todo: "V2_overdue" }, 501);
  });
}
