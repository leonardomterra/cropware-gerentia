import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";

/**
 * Rotas de farm_receipts. Auth via JWT do user; RLS scopes por org.
 *
 * GET /receipts?status=&category=&direction=&from=&to=&search=&limit=
 * POST /receipts
 * PATCH /receipts/:id
 * DELETE /receipts/:id
 *
 * Scan via /receipts/scan vem no commit 8c.
 */
export function mountReceiptRoutes(app: Hono) {
  app.get("/receipts", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const q = new URL(c.req.url).searchParams;
      const status = q.get("status");
      const category = q.get("category");
      const direction = q.get("direction");
      const search = q.get("search")?.trim();
      const from = q.get("from");
      const to = q.get("to");
      const limit = Math.min(Number(q.get("limit") ?? 100), 500);

      let query = client
        .from("farm_receipts")
        .select("*")
        .order("transaction_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (category) query = query.eq("category", category);
      if (direction) query = query.eq("direction", direction);
      if (from) query = query.gte("transaction_date", from);
      if (to) query = query.lte("transaction_date", to);
      if (search) {
        const safe = search.replace(/[%,]/g, "");
        query = query.or(
          `vendor.ilike.%${safe}%,description.ilike.%${safe}%,invoice_number.ilike.%${safe}%`,
        );
      }

      const { data, error } = await query;
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ receipts: data ?? [] });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/receipts", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return c.json({ error: "invalid_body" }, 400);
      }

      const totalValue = Number(body.total_value);
      if (!body.doc_type || !Number.isFinite(totalValue)) {
        return c.json(
          { error: "doc_type e total_value sao obrigatorios" },
          400,
        );
      }

      const row = {
        organization_id: auth.organizationId,
        created_by: auth.user!.id,
        farm_id: body.farm_id ?? null,
        doc_type: String(body.doc_type),
        direction: body.direction ?? "expense",
        status: body.status ?? "a_pagar",
        total_value: totalValue,
        currency: body.currency ?? "BRL",
        transaction_date: body.transaction_date ?? null,
        due_date: body.due_date ?? null,
        paid_date: body.paid_date ?? null,
        vendor: body.vendor ?? null,
        vendor_cnpj: body.vendor_cnpj ?? null,
        payment_method: body.payment_method ?? null,
        description: body.description ?? null,
        category: body.category ?? null,
        invoice_number: body.invoice_number ?? null,
        notes: body.notes ?? null,
        source: body.source ?? "manual",
        ai_confidence: body.ai_confidence ?? null,
        ai_raw: body.ai_raw ?? null,
      };

      const { data, error } = await client
        .from("farm_receipts")
        .insert(row)
        .select()
        .single();

      if (error) return c.json({ error: error.message }, 400);
      return c.json({ receipt: data }, 201);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.patch("/receipts/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return c.json({ error: "invalid_body" }, 400);
      }

      // Whitelist - nao deixa user trocar org_id, created_by, id, timestamps
      const ALLOWED = [
        "farm_id",
        "doc_type",
        "direction",
        "status",
        "total_value",
        "currency",
        "transaction_date",
        "due_date",
        "paid_date",
        "vendor",
        "vendor_cnpj",
        "payment_method",
        "description",
        "category",
        "invoice_number",
        "notes",
        "ai_confidence",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of ALLOWED) {
        if (k in body) patch[k] = body[k];
      }
      if (Object.keys(patch).length === 0) {
        return c.json({ error: "no_fields_to_update" }, 400);
      }

      const { data, error } = await client
        .from("farm_receipts")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);
      return c.json({ receipt: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.delete("/receipts/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const { error, count } = await client
        .from("farm_receipts")
        .delete({ count: "exact" })
        .eq("id", id);

      if (error) return c.json({ error: error.message }, 400);
      if (!count) return c.json({ error: "not_found" }, 404);
      return c.json({ ok: true, deleted: count });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/receipts/scan", (c) =>
    c.json({ error: "not_implemented", todo: "commit_8c" }, 501),
  );
}
