import type { Hono } from "npm:hono";
import { getUserClient, requireCanWrite, requireFarmUser } from "../lib/userClient.ts";
import { resolveFarmPlot } from "../lib/vinculoDoCampo.ts";

/** Tipos da agenda (fase 3 da unificação; check em farm_tasks_kind_check). */
const KINDS = ["lembrete", "reuniao", "visita", "deslocamento", "manutencao", "outro"];
/** "14:30" ou "14:30:00" → "14:30"; o resto vira null. */
function parseTime(v: unknown): string | null {
  return typeof v === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v.slice(0, 5) : null;
}
const texto = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) || null : null;

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
 *
 * Lembrete continua PESSOAL por padrao mesmo pro gestor (que pela RLS poderia
 * ver os da equipe) — um to-do alheio na lista so atrapalha. Quem quiser o
 * consolidado pede ?scope=all. Lancamento e o contrario: e dado da empresa, e
 * por isso /receipts ja devolve a equipe inteira pro gestor.
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
      // ?scope=all: gestor/convidado veem os lembretes da equipe (a RLS decide
      // se pode). Sem o parametro, so os proprios.
      const scopeAll = new URL(c.req.url).searchParams.get("scope") === "all";
      let q = client
        .from("farm_tasks")
        .select("*")
        .eq("organization_id", auth.organizationId!);
      if (!(scopeAll && auth.canReadAll)) q = q.eq("created_by", auth.user!.id);
      const { data, error } = await q
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
      const auth = await requireCanWrite(client);
      if (auth.error) return auth.error;
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

      const title = String(body.title || "").trim().slice(0, 120);
      if (!title) return c.json({ error: "title obrigatorio" }, 400);
      const priority = PRIORITIES.includes(body.priority) ? body.priority : "normal";
      // Fazenda/talhão (agenda do Field): validados pela RLS de quem pede.
      const vinculo = await resolveFarmPlot(client, body.farm_id, body.plot_id);
      if ("error" in vinculo) return c.json({ error: vinculo.error }, 400);

      const row = {
        organization_id: auth.organizationId,
        created_by: auth.user!.id,
        title,
        notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null,
        due_date: typeof body.due_date === "string" && body.due_date ? body.due_date : null,
        priority,
        done: body.done === true,
        // Agenda (fase 3): hora, tipo, local e onde.
        due_time: parseTime(body.due_time),
        kind: KINDS.includes(body.kind) ? body.kind : "lembrete",
        location: texto(body.location, 200),
        farm_id: vinculo.farm_id,
        plot_id: vinculo.plot_id,
        // Financeiros — opcionais (o lembrete pode nascer sem valor definido).
        total_value: parseValue(body.total_value),
        cost_center_id: typeof body.cost_center_id === "string" && body.cost_center_id
          ? body.cost_center_id
          : null,
        // Explicito, e nao pelo default da coluna: quem le este handler ve que
        // "criado pela tela" e uma decisao, nao um acaso do schema.
        source: "manual",
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
      const auth = await requireCanWrite(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

      const ALLOWED = [
        "title", "notes", "due_date", "done", "priority",
        "total_value", "cost_center_id", "due_time", "kind", "location",
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
      if ("due_time" in patch) patch.due_time = parseTime(patch.due_time);
      if ("kind" in patch && !KINDS.includes(patch.kind as string)) delete patch.kind;
      if ("location" in patch) patch.location = texto(patch.location, 200);
      // Fazenda/talhão: os dois juntos, como nos lançamentos.
      if ("farm_id" in body || "plot_id" in body) {
        const vinculo = await resolveFarmPlot(client, body.farm_id, body.plot_id);
        if ("error" in vinculo) return c.json({ error: vinculo.error }, 400);
        patch.farm_id = vinculo.farm_id;
        patch.plot_id = vinculo.plot_id;
      }
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
      const auth = await requireCanWrite(client);
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
