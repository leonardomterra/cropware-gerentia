import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";

/**
 * CRUD de farm_tasks — os "Lembretes" da aba Pendencias.
 *
 * Escopo FINANCEIRO (decisao 15/07): o to-do geral foi adiado pra um app
 * proprio. Por isso o lembrete tem total_value e cost_center_id — ambos
 * OPCIONAIS, porque ele costuma nascer de um "anota: X" no WhatsApp, onde o
 * usuario ainda nao sabe o valor.
 *
 * PESSOAIS: todo usuario da org cria/edita os seus (requireFarmUser, NAO admin
 * — diferente de recurring). A lista filtra por created_by e as escritas tambem
 * exigem created_by; a RLS mantem o escopo por organizacao.
 */

const PRIORITIES = ["low", "normal", "high"];

/** numero > 0 ou null. Aceita number e string ("500.50"). */
// deno-lint-ignore no-explicit-any
function parseValue(raw: any): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function mountTaskRoutes(app: Hono) {
  app.get("/tasks", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const { data, error } = await client
        .from("farm_tasks")
        .select("*")
        .eq("organization_id", auth.organizationId!)
        .eq("created_by", auth.user!.id)
        .order("done", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ tasks: data ?? [] });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/tasks", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

      const title = String(body.title || "").trim().slice(0, 120);
      if (!title) return c.json({ error: "title obrigatorio" }, 400);
      const priority = PRIORITIES.includes(body.priority) ? body.priority : "normal";

      const row = {
        organization_id: auth.organizationId,
        created_by: auth.user!.id,
        title,
        notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null,
        due_date: typeof body.due_date === "string" && body.due_date ? body.due_date : null,
        priority,
        done: body.done === true,
        // Financeiros — opcionais (o lembrete pode nascer sem valor definido).
        total_value: parseValue(body.total_value),
        cost_center_id: typeof body.cost_center_id === "string" && body.cost_center_id
          ? body.cost_center_id
          : null,
      };
      const { data, error } = await client.from("farm_tasks").insert(row).select().single();
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ task: data }, 201);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.patch("/tasks/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

      const ALLOWED = [
        "title", "notes", "due_date", "done", "priority",
        "total_value", "cost_center_id",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of ALLOWED) if (k in body) patch[k] = body[k];

      if ("title" in patch) {
        const t = String(patch.title || "").trim().slice(0, 120);
        if (!t) return c.json({ error: "title_vazio" }, 400);
        patch.title = t;
      }
      if ("notes" in patch) {
        patch.notes = typeof patch.notes === "string" ? (patch.notes as string).trim().slice(0, 1000) || null : null;
      }
      if ("priority" in patch && !PRIORITIES.includes(patch.priority as string)) delete patch.priority;
      if ("due_date" in patch && !patch.due_date) patch.due_date = null;
      if ("total_value" in patch) patch.total_value = parseValue(patch.total_value);
      if ("cost_center_id" in patch && !patch.cost_center_id) patch.cost_center_id = null;
      if (Object.keys(patch).length === 0) return c.json({ error: "no_fields_to_update" }, 400);

      const { data, error } = await client
        .from("farm_tasks")
        .update(patch)
        .eq("id", id)
        .eq("created_by", auth.user!.id)
        .select()
        .maybeSingle();
      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);
      return c.json({ task: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.delete("/tasks/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const { data: owned } = await client
        .from("farm_tasks")
        .select("id")
        .eq("id", id)
        .eq("created_by", auth.user!.id)
        .maybeSingle();
      if (!owned) return c.json({ error: "not_found" }, 404);
      const { error } = await client.from("farm_tasks").delete().eq("id", id);
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
