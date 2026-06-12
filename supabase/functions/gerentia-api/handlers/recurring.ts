import type { Hono } from "npm:hono";
import { getUserClient, requireFarmAdmin, requireFarmUser } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { userCanAccessCC } from "../lib/cc.ts";

/**
 * CRUD de farm_recurring_receipts (R1.3).
 *
 * Leitura: qualquer membro da org. Escrita/pause/run-now: owner/admin.
 * O cron job pg_cron 'farm-process-recurring' chama farm_process_recurring()
 * todo dia as 07 UTC — esses endpoints apenas administram as definicoes.
 */
export function mountRecurringRoutes(app: Hono) {
  app.get("/recurring", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const { data, error } = await client
        .from("farm_recurring_receipts")
        .select("*")
        .eq("organization_id", auth.organizationId!)
        .order("active", { ascending: false })
        .order("next_run_date", { ascending: true });
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ recurring: data ?? [] });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/recurring", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

      const name = String(body.name || "").trim().slice(0, 80);
      const totalValue = Number(body.total_value);
      const direction = body.direction === "income" ? "income" : "expense";
      const dayOfMonth = Math.max(1, Math.min(28, Math.floor(Number(body.day_of_month) || 1)));
      if (!name) return c.json({ error: "name obrigatorio" }, 400);
      if (!Number.isFinite(totalValue) || totalValue <= 0) {
        return c.json({ error: "total_value obrigatorio (> 0)" }, 400);
      }

      // CC: usa o que veio, ou default do user. Valida acesso.
      const admin = getSupabaseAdmin();
      let costCenterId: string | null = typeof body.cost_center_id === "string"
        ? body.cost_center_id
        : null;
      if (costCenterId) {
        const ok = await userCanAccessCC(admin, auth.user!.id, costCenterId);
        if (!ok) return c.json({ error: "no_access_to_cost_center" }, 403);
      }

      // next_run_date: proxima ocorrencia do day_of_month a partir de hoje.
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7); // YYYY-MM
      let nextRun = `${thisMonth}-${String(dayOfMonth).padStart(2, "0")}`;
      if (nextRun < today) {
        // Pula pra proximo mes.
        const d = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
        nextRun = d.toISOString().slice(0, 10);
      }

      const row = {
        organization_id: auth.organizationId,
        created_by: auth.user!.id,
        cost_center_id: costCenterId,
        name,
        direction,
        total_value: totalValue,
        category: typeof body.category === "string" ? body.category : null,
        vendor: typeof body.vendor === "string" ? body.vendor : null,
        description: typeof body.description === "string" ? body.description : null,
        payment_method: typeof body.payment_method === "string" ? body.payment_method : null,
        frequency: "monthly",
        day_of_month: dayOfMonth,
        next_run_date: nextRun,
        active: body.active !== false,
      };

      const { data, error } = await client
        .from("farm_recurring_receipts")
        .insert(row)
        .select()
        .single();
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ recurring: data }, 201);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.patch("/recurring/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

      const ALLOWED = [
        "name", "cost_center_id", "direction", "total_value", "category",
        "vendor", "description", "payment_method", "day_of_month",
        "next_run_date", "active",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of ALLOWED) if (k in body) patch[k] = body[k];
      if (Object.keys(patch).length === 0) {
        return c.json({ error: "no_fields_to_update" }, 400);
      }

      if (typeof patch.cost_center_id === "string") {
        const admin = getSupabaseAdmin();
        const ok = await userCanAccessCC(admin, auth.user!.id, patch.cost_center_id);
        if (!ok) return c.json({ error: "no_access_to_cost_center" }, 403);
      }
      if (typeof patch.day_of_month === "number") {
        patch.day_of_month = Math.max(1, Math.min(28, Math.floor(patch.day_of_month)));
      }

      patch.updated_at = new Date().toISOString();
      const { data, error } = await client
        .from("farm_recurring_receipts")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);
      return c.json({ recurring: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.delete("/recurring/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const { error, count } = await client
        .from("farm_recurring_receipts")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) return c.json({ error: error.message }, 400);
      if (!count) return c.json({ error: "not_found" }, 404);
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // Disparo manual da geracao (admin) — util pra testar sem esperar 07 UTC.
  app.post("/recurring/run-now", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.rpc("farm_process_recurring");
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ ok: true, processed: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
