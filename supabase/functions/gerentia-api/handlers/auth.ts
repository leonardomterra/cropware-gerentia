import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { getAllowedCostCenterIds, listUserCostCenters } from "../lib/cc.ts";

/**
 * Auth utilities.
 * - GET /auth/me: hidrata FarmUser no boot (perfil + role + organizacao + CCs).
 *   Unico endpoint que o frontend chama no startup pra resolver tudo.
 */
export function mountAuthRoutes(app: Hono) {
  app.get("/auth/me", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const admin = getSupabaseAdmin();
      const [allowed, costCenters, orgRes, metaRes] = await Promise.all([
        getAllowedCostCenterIds(admin, auth.user!.id, auth.organizationId!),
        listUserCostCenters(admin, auth.user!.id, auth.organizationId!),
        admin
          .from("organizations")
          .select("id, name, trial_started_at, trial_ends_at")
          .eq("id", auth.organizationId!)
          .maybeSingle(),
        admin
          .from("users_meta")
          .select("full_name, phone, whatsapp_linked_at")
          .eq("user_id", auth.user!.id)
          .maybeSingle(),
      ]);

      return c.json({
        user: {
          id: auth.user!.id,
          email: auth.user!.email,
          full_name: metaRes.data?.full_name ?? null,
          phone: metaRes.data?.phone ?? null,
          whatsapp_linked: !!metaRes.data?.whatsapp_linked_at,
        },
        role: auth.role,
        organization: orgRes.data,
        allowed_cost_center_ids: allowed, // "all" | string[]
        cost_centers: costCenters,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // POST /auth/signup: ainda nao centralizado. Signup acontece via supabase.auth.signUp
  // direto do cliente, e o trigger handle_new_farm_user faz o setup (owner ou consumo
  // de invite). Manter stub aqui pra futura centralizacao.
  app.post("/auth/signup", (c) =>
    c.json({ error: "not_implemented_use_supabase_auth_direct" }, 501),
  );
}
