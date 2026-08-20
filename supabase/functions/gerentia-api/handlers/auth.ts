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
      const [allowed, costCenters, orgRes, metaRes, waRes] = await Promise.all([
        getAllowedCostCenterIds(admin, auth.user!.id, auth.organizationId!),
        listUserCostCenters(admin, auth.user!.id, auth.organizationId!),
        admin
          .from("organizations")
          .select("id, name, kind, seats_limit, trial_started_at, trial_ends_at")
          .eq("id", auth.organizationId!)
          .maybeSingle(),
        admin
          .from("users_meta")
          .select("full_name, phone")
          .eq("user_id", auth.user!.id)
          .maybeSingle(),
        // O vinculo do WhatsApp vem de farm_whatsapp_links, a tabela que a
        // integracao REALMENTE usa (webhook, IA, cron). users_meta tem uma
        // coluna whatsapp_linked_at que ninguem nunca escreveu: em 20/08/2026
        // ela estava NULL para os 14 usuarios da base, entao este campo sempre
        // respondeu "nao vinculado" mesmo com o WhatsApp funcionando. So
        // apareceu quando a tela de Conta passou a mostrar o status.
        admin
          .from("farm_whatsapp_links")
          .select("user_id", { head: true, count: "exact" })
          .eq("user_id", auth.user!.id),
      ]);

      // Assentos ocupados: so faz sentido (e so e exposto) pra quem gerencia.
      let seatsUsed: number | null = null;
      if (auth.role === "owner" || auth.role === "admin") {
        const { count } = await admin
          .from("users_meta")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", auth.organizationId!);
        seatsUsed = count ?? null;
      }

      return c.json({
        user: {
          id: auth.user!.id,
          email: auth.user!.email,
          full_name: metaRes.data?.full_name ?? null,
          phone: metaRes.data?.phone ?? null,
          whatsapp_linked: (waRes.count ?? 0) > 0,
        },
        role: auth.role,
        organization: orgRes.data ? { ...orgRes.data, seats_used: seatsUsed } : null,
        // A UI NAO recalcula regra de acesso: consome isto. A fonte de verdade
        // continua sendo a RLS — ver docs/ORGANIZACOES-E-PERFIS.md §5.
        permissions: {
          can_read_all: auth.canReadAll,
          can_write: auth.canWrite,
          can_write_others: false,
          can_manage_team: auth.role === "owner" || auth.role === "admin",
        },
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
