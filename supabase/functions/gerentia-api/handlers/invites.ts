import type { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getUserClient, requireFarmAdmin } from "../lib/userClient.ts";

/**
 * Convites por codigo de 6 digitos (admin/owner only).
 * Padrao espelhado do WhatsApp linking que ja funciona.
 *
 * - POST /invites: gera codigo TTL 7d com role + CCs pre-atribuidos.
 * - GET /invites: lista convites pendentes da org.
 * - DELETE /invites/:id: revoga convite.
 * - GET /invites/lookup/:code (PUBLICO): a JoinPage usa pra mostrar "Convite valido pra X".
 *
 * Consumo do convite acontece no trigger handle_new_farm_user via raw_user_meta_data
 * (campo 'farm_invite_code') quando o convidado faz signup.
 */
export function mountInviteRoutes(app: Hono) {
  app.get("/invites", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const { data, error } = await client
        .from("farm_org_invites")
        .select("*")
        .eq("organization_id", auth.organizationId!)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ invites: data || [] });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/invites", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);
      const role = body.role === "admin" ? "admin" : "member";
      const cost_center_ids: string[] = Array.isArray(body.cost_center_ids)
        ? (body.cost_center_ids as string[]).filter((x) => typeof x === "string")
        : [];

      // Gera codigo unico (ate 5 tentativas).
      let code = "";
      for (let i = 0; i < 5; i++) {
        const cand = String(Math.floor(100000 + Math.random() * 900000));
        const { data: ex } = await client
          .from("farm_org_invites")
          .select("id")
          .eq("code", cand)
          .maybeSingle();
        if (!ex) {
          code = cand;
          break;
        }
      }
      if (!code) return c.json({ error: "code_gen_failed" }, 500);

      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await client
        .from("farm_org_invites")
        .insert({
          organization_id: auth.organizationId!,
          code,
          invited_by: auth.user!.id,
          invited_name: typeof body.invited_name === "string" ? body.invited_name : null,
          invited_email: typeof body.invited_email === "string" ? body.invited_email : null,
          role,
          cost_center_ids,
          expires_at: expiresAt,
        })
        .select()
        .single();
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ invite: data }, 201);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.delete("/invites/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;
      const id = c.req.param("id");
      const { error } = await client.from("farm_org_invites").delete().eq("id", id);
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // Endpoint PUBLICO (sem auth) — usado pela JoinPage pre-signup pra mostrar a quem
  // o convite pertence. Nao expoe cost_center_ids nem invited_by (so o suficiente
  // pra UI de boas-vindas).
  app.get("/invites/lookup/:code", async (c) => {
    const code = c.req.param("code");
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return c.json({ error: "config" }, 500);
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await admin
      .from("farm_org_invites")
      .select("organization_id, role, invited_name, expires_at, used")
      .eq("code", code)
      .maybeSingle();
    if (!data) return c.json({ error: "not_found" }, 404);
    if (data.used) return c.json({ error: "already_used" }, 410);
    if (new Date(data.expires_at) < new Date()) return c.json({ error: "expired" }, 410);
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", data.organization_id)
      .maybeSingle();
    return c.json({
      organization_name: org?.name || "Organizacao",
      role: data.role,
      invited_name: data.invited_name,
    });
  });
}
