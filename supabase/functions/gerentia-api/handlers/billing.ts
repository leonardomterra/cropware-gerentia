import type { Hono } from "npm:hono";

/**
 * Webhooks de billing - Mercado Pago (web) + RevenueCat (iOS IAP).
 * Stubs no commit 7. Implementacao real apos commit 9 (loop receipts) -
 * provavelmente commits V2+ quando comecar a cobrar de verdade.
 *
 * Ambas as rotas precisam ser publicas (verify_jwt=false no deploy).
 * Validacao de assinatura/secret e responsabilidade interna de cada handler.
 */
export function mountBillingRoutes(app: Hono) {
  app.post("/webhook/mp", (c) =>
    c.json({ error: "not_implemented", todo: "V2_billing" }, 501),
  );
  app.post("/webhook/revenuecat", (c) =>
    c.json({ error: "not_implemented", todo: "V2_billing" }, 501),
  );
}
