import type { Hono } from "npm:hono";
import { getUserClient, requireFarmAdmin, requireFarmUser } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { listUserCostCenters } from "../lib/cc.ts";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32) || "cc";
}

/**
 * CRUD de centros de custo.
 * - GET /cost-centers: todos os CCs visiveis pro user (admin -> org inteira; member -> subset).
 * - POST /cost-centers (admin): cria CC novo (limite de 6 ativos enforced via trigger DB).
 * - PATCH /cost-centers/:id (admin): nome, cor, icone, is_default.
 * - POST /cost-centers/:id/archive (admin): soft-delete (nao apaga; libera slot do limite).
 */
export function mountCostCenterRoutes(app: Hono) {
  app.get("/cost-centers", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const admin = getSupabaseAdmin();
      const list = await listUserCostCenters(admin, auth.user!.id, auth.organizationId!);
      return c.json({ cost_centers: list });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/cost-centers", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const body = await c.req.json().catch(() => null);
      if (!body?.name || typeof body.name !== "string") {
        return c.json({ error: "name obrigatorio" }, 400);
      }
      const slug = (body.slug && typeof body.slug === "string")
        ? slugify(body.slug)
        : slugify(body.name);
      const { data, error } = await client
        .from("farm_cost_centers")
        .insert({
          organization_id: auth.organizationId,
          slug,
          name: String(body.name).trim().slice(0, 60),
          color: typeof body.color === "string" ? body.color : null,
          icon: typeof body.icon === "string" ? body.icon : null,
          is_default: false,
        })
        .select()
        .single();
      if (error) {
        if ((error.message || "").includes("Limite de 6")) {
          return c.json({ error: "max_cost_centers_reached", message: error.message }, 409);
        }
        if ((error as { code?: string }).code === "23505") {
          return c.json({ error: "duplicate_slug" }, 409);
        }
        return c.json({ error: error.message }, 400);
      }
      return c.json({ cost_center: data }, 201);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.patch("/cost-centers/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);
      const ALLOWED = ["name", "color", "icon", "is_default"];
      const patch: Record<string, unknown> = {};
      for (const k of ALLOWED) {
        if (k in body) patch[k] = body[k];
      }
      if (Object.keys(patch).length === 0) {
        return c.json({ error: "no_fields_to_update" }, 400);
      }
      // Se setando is_default=true, desetar nos outros da org (so 1 default por org).
      if (patch.is_default === true) {
        await client
          .from("farm_cost_centers")
          .update({ is_default: false })
          .eq("organization_id", auth.organizationId!)
          .neq("id", id);
      }
      const { data, error } = await client
        .from("farm_cost_centers")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);
      return c.json({ cost_center: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/cost-centers/:id/archive", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const { data: cc } = await client
        .from("farm_cost_centers")
        .select("is_default")
        .eq("id", id)
        .maybeSingle();
      if (!cc) return c.json({ error: "not_found" }, 404);
      if (cc.is_default) {
        return c.json({ error: "cannot_archive_default" }, 400);
      }
      const { error } = await client
        .from("farm_cost_centers")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
