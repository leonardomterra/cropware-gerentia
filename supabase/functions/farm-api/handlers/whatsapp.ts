import type { Hono } from "npm:hono";

/**
 * Webhook WhatsApp Business (Meta). Stub no commit 7.
 *
 * PNID filter e ESSENCIAL aqui ja que dividimos numero/WABA com o
 * Cropware atual (decisao V1, ver project_farm_supabase.md). Sem filtro,
 * webhook do CDM dispara handler do Farm e vice-versa.
 *
 * Quando implementar:
 * - Validar header de assinatura da Meta
 * - Filtrar PNID: payload.entry[0].changes[0].value.metadata.phone_number_id
 *   == Deno.env.get("WHATSAPP_FARM_BOT_PNID")
 * - Se nao bater, ignorar silenciosamente (200 com {ok: true, ignored: true})
 * - Se bater, processar: baixar midia, OCR, criar farm_receipts, responder bot
 */
export function mountWhatsappRoutes(app: Hono) {
  app.get("/webhook/whatsapp", (c) => {
    // Endpoint de verificacao Meta (challenge GET)
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    const expectedToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
      return c.text(challenge ?? "", 200);
    }
    return c.json({ error: "forbidden" }, 403);
  });

  app.post("/webhook/whatsapp", (c) =>
    c.json({ error: "not_implemented", todo: "commit_9_whatsapp" }, 501),
  );

  app.post("/integrations/generate-code", (c) =>
    c.json({ error: "not_implemented", todo: "commit_9_whatsapp" }, 501),
  );
}
