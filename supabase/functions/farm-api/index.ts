// Cropware Farm - edge function principal.
// Deploy: verify_jwt=false porque temos webhooks publicos (MP, RC, WhatsApp, cron).
// Auth e validado dentro de cada handler quando necessario.

import { Hono } from "npm:hono";
import { logger } from "npm:hono/logger";
import { corsMiddleware } from "./lib/cors.ts";

import { mountAuthRoutes } from "./handlers/auth.ts";
import { mountReceiptRoutes } from "./handlers/receipts.ts";
import { mountUserRoutes } from "./handlers/users.ts";
import { mountBillingRoutes } from "./handlers/billing.ts";
import { mountWhatsappRoutes } from "./handlers/whatsapp.ts";
import { mountCronRoutes } from "./handlers/cron.ts";
import { mountCostCenterRoutes } from "./handlers/costCenters.ts";
import { mountMemberRoutes } from "./handlers/members.ts";
import { mountInviteRoutes } from "./handlers/invites.ts";
import { mountRecurringRoutes } from "./handlers/recurring.ts";

const app = new Hono().basePath("/farm-api");

app.use("*", corsMiddleware());
app.use("*", logger());

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "farm-api",
    version: "0.6.1",
    ts: new Date().toISOString(),
  }),
);

mountAuthRoutes(app);
mountReceiptRoutes(app);
mountUserRoutes(app);
mountBillingRoutes(app);
mountWhatsappRoutes(app);
mountCronRoutes(app);
mountCostCenterRoutes(app);
mountMemberRoutes(app);
mountInviteRoutes(app);
mountRecurringRoutes(app);

app.onError((err, c) => {
  console.error("[farm-api] unhandled error:", err);
  return c.json({ error: "internal_error", message: err.message }, 500);
});

app.notFound((c) =>
  c.json({ error: "not_found", path: c.req.path }, 404),
);

Deno.serve(app.fetch);
