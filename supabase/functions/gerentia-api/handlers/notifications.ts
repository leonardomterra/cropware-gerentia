import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";

/**
 * Notificacoes in-app (farm_notifications) — leitura, baixa e limpeza.
 *
 * PESSOAIS: toda rota filtra por user_id. A RLS ja e' por user_id, mas o filtro
 * explicito documenta a intencao e protege caso a policy mude.
 *
 * NAO existe POST de criacao: quem produz e' o cron (/cron/process-alerts) via
 * service_role (que bypassa RLS/grants). Coerente com a migration, que nao da
 * grant de insert pro authenticated. O usuario so' le, marca lida e limpa.
 */

const LIST_LIMIT = 100;

export function mountNotificationRoutes(app: Hono) {
  // Lista + contador de nao-lidas na MESMA chamada: o badge do menu e a pagina
  // compartilham o mesmo fetch (evita um round-trip so' pro contador).
  app.get("/notifications", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const { data, error } = await client
        .from("farm_notifications")
        .select("*")
        .eq("user_id", auth.user!.id)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (error) return c.json({ error: error.message }, 400);

      // Count separado (head): a lista tem teto, entao contar nela erraria o
      // badge de quem tiver mais de LIST_LIMIT nao-lidas.
      const { count, error: countErr } = await client
        .from("farm_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user!.id)
        .is("read_at", null);
      if (countErr) return c.json({ error: countErr.message }, 400);

      return c.json({ notifications: data ?? [], unread: count ?? 0 });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // Marcar UMA como lida. Rota dedicada em vez de PATCH com whitelist: o unico
  // campo mutavel e' read_at, entao a intencao fica explicita.
  app.post("/notifications/:id/read", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const { data, error } = await client
        .from("farm_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", auth.user!.id)
        .select()
        .maybeSingle();
      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);
      return c.json({ notification: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // Marcar TODAS as nao-lidas. Nao colide com /:id/read (2 segmentos vs 3).
  app.post("/notifications/read-all", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const { error } = await client
        .from("farm_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", auth.user!.id)
        .is("read_at", null);
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.delete("/notifications/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const { data: owned } = await client
        .from("farm_notifications")
        .select("id")
        .eq("id", id)
        .eq("user_id", auth.user!.id)
        .maybeSingle();
      if (!owned) return c.json({ error: "not_found" }, 404);
      const { error } = await client.from("farm_notifications").delete().eq("id", id);
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
