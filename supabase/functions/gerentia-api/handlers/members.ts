import type { Hono } from "npm:hono";
import { getUserClient, requireFarmAdmin } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";

/**
 * Gestao de membros da organizacao (admin/owner only).
 * - GET /members: lista membros (com role + CCs atribuidos + status WhatsApp).
 * - PATCH /members/:userId: troca role (admin<->member) e/ou substitui set de CCs.
 * - DELETE /members/:userId: remove membro da org (cascade limpa fucc).
 *
 * Regras: owner nao pode ser modificado/removido por esses endpoints (mexer com owner
 * exige fluxo separado de transferencia em V2).
 */
export function mountMemberRoutes(app: Hono) {
  app.get("/members", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;

      const { data: metas, error: metasErr } = await client
        .from("users_meta")
        .select("user_id, full_name, role, phone, whatsapp_linked_at, created_at")
        .eq("organization_id", auth.organizationId!)
        .order("created_at", { ascending: true });
      if (metasErr) return c.json({ error: metasErr.message }, 400);

      const admin = getSupabaseAdmin();
      // deno-lint-ignore no-explicit-any
      const list = metas as any[] || [];
      const emails: Record<string, string | null> = {};
      for (const m of list) {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id);
        emails[m.user_id] = u?.user?.email ?? null;
      }

      const { data: fuccRows } = await client
        .from("farm_user_cost_centers")
        .select("user_id, cost_center_id")
        .eq("organization_id", auth.organizationId!);
      const ccsByUser: Record<string, string[]> = {};
      // deno-lint-ignore no-explicit-any
      for (const r of (fuccRows as any[]) || []) {
        (ccsByUser[r.user_id] ||= []).push(r.cost_center_id);
      }

      const members = list.map((m) => ({
        user_id: m.user_id,
        full_name: m.full_name,
        email: emails[m.user_id],
        role: m.role,
        phone: m.phone,
        whatsapp_linked: !!m.whatsapp_linked_at,
        cost_center_ids: (m.role === "owner" || m.role === "admin")
          ? "all" as const
          : (ccsByUser[m.user_id] || []),
        created_at: m.created_at,
      }));
      return c.json({ members });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.patch("/members/:userId", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;

      const userId = c.req.param("userId");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

      const { data: tgt } = await client
        .from("users_meta")
        .select("user_id, role")
        .eq("user_id", userId)
        .eq("organization_id", auth.organizationId!)
        .maybeSingle();
      if (!tgt) return c.json({ error: "not_found" }, 404);
      if (tgt.role === "owner") return c.json({ error: "cannot_modify_owner" }, 400);

      if (body.role && ["admin", "member"].includes(body.role)) {
        const { error: roleErr } = await client
          .from("users_meta")
          .update({ role: body.role })
          .eq("user_id", userId)
          .eq("organization_id", auth.organizationId!);
        if (roleErr) return c.json({ error: roleErr.message }, 400);
      }

      if (Array.isArray(body.cost_center_ids)) {
        await client
          .from("farm_user_cost_centers")
          .delete()
          .eq("user_id", userId)
          .eq("organization_id", auth.organizationId!);
        if (body.cost_center_ids.length > 0) {
          const rows = (body.cost_center_ids as string[]).map((cc_id) => ({
            user_id: userId,
            cost_center_id: cc_id,
            organization_id: auth.organizationId!,
          }));
          const { error } = await client.from("farm_user_cost_centers").insert(rows);
          if (error) return c.json({ error: error.message }, 400);
        }
      }

      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.delete("/members/:userId", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmAdmin(client);
      if (auth.error) return auth.error;

      const userId = c.req.param("userId");
      const { data: tgt } = await client
        .from("users_meta")
        .select("role")
        .eq("user_id", userId)
        .eq("organization_id", auth.organizationId!)
        .maybeSingle();
      if (!tgt) return c.json({ error: "not_found" }, 404);
      if (tgt.role === "owner") return c.json({ error: "cannot_remove_owner" }, 400);

      const { error } = await client.from("users_meta").delete().eq("user_id", userId);
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
