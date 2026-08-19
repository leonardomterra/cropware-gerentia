import type { Hono } from "npm:hono";
import { getUserClient, requireMaster } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { logAdminAction } from "../lib/adminAudit.ts";

/**
 * Painel MASTER — exportação de dados (Etapa 6 de docs/ORGANIZACOES-E-PERFIS.md).
 *
 * Backup sob demanda, em JSON, de uma organização inteira ou de uma pessoa.
 * Serve pra três coisas concretas: suporte ("o que sumiu?"), pedido de LGPD
 * ("me manda tudo que vocês têm meu") e rede de segurança antes de mexer em
 * vínculo de organização.
 *
 *   GET /admin/export/org/:id    tudo da organização
 *   GET /admin/export/user/:id   só o que a pessoa cadastrou (na org atual dela)
 *
 * Não é backup agendado — é o botão. Rotina automática só se a operação pedir.
 */

// Teto por tabela: o export é síncrono e cabe numa resposta. Se algum cliente
// passar disso, vira paginação/streaming — mas aí já é outro problema.
const MAX_ROWS = 20000;

export function mountAdminExportRoutes(app: Hono) {
  app.get("/admin/export/org/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const orgId = c.req.param("id");
      const admin = getSupabaseAdmin();

      const { data: organization } = await admin
        .from("organizations").select("*").eq("id", orgId).maybeSingle();
      if (!organization) return c.json({ error: "not_found" }, 404);

      const table = (name: string) =>
        admin.from(name).select("*").eq("organization_id", orgId).limit(MAX_ROWS);

      const [
        members, costCenters, categories, receipts, items, tasks, recurring, former,
      ] = await Promise.all([
        admin.from("users_meta").select("*").eq("organization_id", orgId),
        table("farm_cost_centers"),
        table("farm_categories"),
        table("farm_receipts"),
        table("farm_receipt_items"),
        table("farm_tasks"),
        table("farm_recurring_receipts"),
        table("farm_org_former_members"),
      ]);

      // E-mail não vive em users_meta: sem ele o backup não identifica ninguém.
      const people = [];
      // deno-lint-ignore no-explicit-any
      for (const m of (members.data as any[]) ?? []) {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id);
        people.push({ ...m, email: u?.user?.email ?? null });
      }

      await logAdminAction(admin, c, auth.user, "export_org", { id: orgId }, {
        receipts: receipts.data?.length ?? 0,
      });

      return c.json({
        exported_at: new Date().toISOString(),
        exported_by: auth.user?.email ?? null,
        scope: "organization",
        organization,
        members: people,
        cost_centers: costCenters.data ?? [],
        categories: categories.data ?? [],
        receipts: receipts.data ?? [],
        receipt_items: items.data ?? [],
        tasks: tasks.data ?? [],
        recurring_receipts: recurring.data ?? [],
        former_members: former.data ?? [],
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.get("/admin/export/user/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const userId = c.req.param("id");
      const admin = getSupabaseAdmin();

      const { data: meta } = await admin
        .from("users_meta").select("*").eq("user_id", userId).maybeSingle();
      if (!meta) return c.json({ error: "not_found" }, 404);

      const { data: u } = await admin.auth.admin.getUserById(userId);
      const orgId = meta.organization_id as string;

      const mine = (name: string) =>
        admin.from(name).select("*")
          .eq("organization_id", orgId).eq("created_by", userId).limit(MAX_ROWS);

      const [receipts, tasks, recurring, organization] = await Promise.all([
        mine("farm_receipts"),
        mine("farm_tasks"),
        mine("farm_recurring_receipts"),
        admin.from("organizations").select("id, name, kind").eq("id", orgId).maybeSingle(),
      ]);

      // Itens vêm pelos lançamentos da pessoa (a tabela não tem created_by —
      // o item herda o dono do lançamento pai, igual à regra da RLS).
      // deno-lint-ignore no-explicit-any
      const receiptIds = ((receipts.data as any[]) ?? []).map((r) => r.id as string);
      let items: unknown[] = [];
      if (receiptIds.length > 0) {
        const { data } = await admin
          .from("farm_receipt_items").select("*")
          .in("receipt_id", receiptIds).limit(MAX_ROWS);
        items = data ?? [];
      }

      await logAdminAction(admin, c, auth.user, "export_user",
        { id: userId, email: u?.user?.email ?? null }, {
          receipts: receipts.data?.length ?? 0,
        });

      return c.json({
        exported_at: new Date().toISOString(),
        exported_by: auth.user?.email ?? null,
        scope: "user",
        user: { ...meta, email: u?.user?.email ?? null },
        organization: organization.data,
        receipts: receipts.data ?? [],
        receipt_items: items,
        tasks: tasks.data ?? [],
        recurring_receipts: recurring.data ?? [],
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
