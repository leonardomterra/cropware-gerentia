import type { Hono } from "npm:hono";
import { getUserClient, requireMaster } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { retratoDeSaida } from "../lib/backupSaida.ts";
import { logAdminAction } from "../lib/adminAudit.ts";

/**
 * Painel MASTER — gestão de ORGANIZAÇÕES (gerentia.app).
 * Ver docs/ORGANIZACOES-E-PERFIS.md §6 (Etapa 4).
 *
 * Gateado por requireMaster (email em MASTER_EMAILS) e operando via service_role
 * (bypassa RLS de propósito: o master é quem monta a organização do cliente).
 *
 * Rotas:
 *   GET    /admin/orgs                       lista + assentos em uso
 *   GET    /admin/orgs/:id                   detalhe + membros + ex-membros
 *   POST   /admin/orgs                       cria organização com equipe
 *   PATCH  /admin/orgs/:id                   nome, tipo, assentos, plano, trial
 *   POST   /admin/orgs/:id/members           vincula usuário existente (por e-mail)
 *   PATCH  /admin/orgs/:id/members/:userId   troca perfil / transfere titularidade
 *   DELETE /admin/orgs/:id/members/:userId   desvincula (dados FICAM na organização)
 *
 * Toda ação sensível cai no farm_admin_audit.
 */

const ROLES = ["owner", "admin", "member", "viewer"];

/** Cria o centro de custo padrão de uma organização nova (o app quebra sem um). */
// deno-lint-ignore no-explicit-any
async function seedDefaultCostCenter(admin: any, orgId: string) {
  await admin.from("farm_cost_centers").insert({
    organization_id: orgId,
    slug: "geral",
    name: "Geral",
    is_default: true,
    color: "#64748b",
  });
}

/**
 * Move tudo que é VÍNCULO (não dado) do usuário para outra organização.
 * O link do WhatsApp é o item crítico: se ficar apontando pra org antiga, a
 * pessoa continua lançando lá pelo bot sem nem perceber.
 */
// deno-lint-ignore no-explicit-any
async function moveUserBindings(
  admin: any,
  userId: string,
  fromOrg: string,
  toOrg: string,
) {
  await admin
    .from("farm_user_cost_centers")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", fromOrg);

  // farm_wa_pending é chaveada por telefone, não por usuário: descobre os
  // números da pessoa antes de limpar o rascunho em andamento (um wizard aberto
  // apontando pra org antiga gravaria no lugar errado ao ser confirmado).
  const { data: links } = await admin
    .from("farm_whatsapp_links")
    .select("phone_number")
    .eq("user_id", userId);
  // deno-lint-ignore no-explicit-any
  const phones = ((links as any[]) ?? []).map((l) => l.phone_number as string);
  if (phones.length > 0) {
    await admin.from("farm_wa_pending").delete().in("phone_number", phones);
  }

  await admin
    .from("farm_whatsapp_links")
    .update({ organization_id: toOrg })
    .eq("user_id", userId);
}

/**
 * Traz os DADOS da pessoa junto com ela para a organização nova.
 *
 * O centro de custo e as categorias customizadas são por organização, então o
 * lançamento não pode simplesmente trocar de `organization_id`: o CC antigo não
 * existe do outro lado. A regra aqui é: CC vira o padrão do destino (a pessoa
 * reclassifica depois se quiser) e categoria customizada é copiada, senão a
 * lista mostraria o slug cru no lugar do nome.
 *
 * O anexo não precisa de nada: a chave do R2 é só um identificador, e quem lê
 * passa pelo lançamento (que já terá mudado de org).
 */
// deno-lint-ignore no-explicit-any
async function moveUserData(
  admin: any,
  userId: string,
  fromOrg: string,
  toOrg: string,
) {
  const { data: destCcs } = await admin
    .from("farm_cost_centers")
    .select("id, is_default")
    .eq("organization_id", toOrg)
    .is("archived_at", null);
  // deno-lint-ignore no-explicit-any
  const list = (destCcs as any[]) ?? [];
  const destCc = (list.find((c) => c.is_default) ?? list[0])?.id ?? null;

  // Categorias customizadas em uso: copia as que faltam no destino.
  const { data: mine } = await admin
    .from("farm_receipts")
    .select("category")
    .eq("organization_id", fromOrg)
    .eq("created_by", userId);
  // deno-lint-ignore no-explicit-any
  const slugs = [
    ...new Set(((mine as any[]) ?? []).map((r) => r.category).filter(Boolean)),
  ];
  if (slugs.length > 0) {
    const { data: custom } = await admin
      .from("farm_categories")
      .select("*")
      .eq("organization_id", fromOrg)
      .in("slug", slugs);
    const { data: already } = await admin
      .from("farm_categories")
      .select("slug")
      .eq("organization_id", toOrg)
      .in("slug", slugs);
    // deno-lint-ignore no-explicit-any
    const have = new Set(((already as any[]) ?? []).map((c) => c.slug));
    // deno-lint-ignore no-explicit-any
    const toCopy = ((custom as any[]) ?? []).filter((c) => !have.has(c.slug));
    if (toCopy.length > 0) {
      await admin.from("farm_categories").insert(
        toCopy.map(({ id: _id, created_at: _c, ...rest }) => ({
          ...rest,
          organization_id: toOrg,
        })),
      );
    }
  }

  // Lançamentos primeiro: os ids guiam a mudança dos itens (que não têm dono
  // próprio — herdam o do pai, igual à regra da RLS).
  const { data: movedReceipts } = await admin
    .from("farm_receipts")
    .update({ organization_id: toOrg })
    .eq("organization_id", fromOrg)
    .eq("created_by", userId)
    .select("id");
  // deno-lint-ignore no-explicit-any
  const receiptIds = ((movedReceipts as any[]) ?? []).map(
    (r) => r.id as string,
  );

  if (receiptIds.length > 0) {
    await admin
      .from("farm_receipt_items")
      .update({ organization_id: toOrg })
      .in("receipt_id", receiptIds);
    // CC só onde existia: quem não classificou continua sem classificação.
    if (destCc) {
      await admin
        .from("farm_receipts")
        .update({ cost_center_id: destCc })
        .in("id", receiptIds)
        .not("cost_center_id", "is", null);
      await admin
        .from("farm_receipt_items")
        .update({ cost_center_id: destCc })
        .in("receipt_id", receiptIds)
        .not("cost_center_id", "is", null);
    }
  }

  const moved: Record<string, number> = { receipts: receiptIds.length };
  for (const t of ["farm_tasks", "farm_recurring_receipts"]) {
    const { data } = await admin
      .from(t)
      .update({ organization_id: toOrg })
      .eq("organization_id", fromOrg)
      .eq("created_by", userId)
      .select("id");
    // deno-lint-ignore no-explicit-any
    const ids = ((data as any[]) ?? []).map((x) => x.id as string);
    moved[t] = ids.length;
    if (destCc && ids.length > 0) {
      await admin
        .from(t)
        .update({ cost_center_id: destCc })
        .in("id", ids)
        .not("cost_center_id", "is", null);
    }
  }

  return moved;
}

export function mountAdminOrgRoutes(app: Hono) {
  // GET /admin/orgs — lista com assentos em uso.
  app.get("/admin/orgs", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const admin = getSupabaseAdmin();
      const { data: orgs, error } = await admin
        .from("organizations")
        .select(
          "id, name, cnpj, kind, seats_limit, plan_code, subscription_status, trial_ends_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) return c.json({ error: error.message }, 400);

      const { data: metas } = await admin
        .from("users_meta")
        .select("organization_id, role");
      const used: Record<string, number> = {};
      // deno-lint-ignore no-explicit-any
      for (const m of (metas as any[]) ?? []) {
        used[m.organization_id] = (used[m.organization_id] ?? 0) + 1;
      }

      const list = (orgs ?? []).map((o) => ({
        ...o,
        seats_used: used[o.id] ?? 0,
        seats_limit: o.seats_limit ?? 1,
      }));
      return c.json({ organizations: list });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // GET /admin/orgs/:id — detalhe + membros (com e-mail) + quem já saiu.
  app.get("/admin/orgs/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const admin = getSupabaseAdmin();

      const { data: org, error } = await admin
        .from("organizations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) return c.json({ error: error.message }, 400);
      if (!org) return c.json({ error: "not_found" }, 404);

      const { data: metas } = await admin
        .from("users_meta")
        .select("user_id, full_name, role, phone, created_at")
        .eq("organization_id", id)
        .order("created_at", { ascending: true });

      // deno-lint-ignore no-explicit-any
      const rows = (metas as any[]) ?? [];
      const members = [];
      for (const m of rows) {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id);
        const { count } = await admin
          .from("farm_receipts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", id)
          .eq("created_by", m.user_id);
        members.push({
          user_id: m.user_id,
          full_name: m.full_name,
          email: u?.user?.email ?? null,
          role: m.role,
          phone: m.phone,
          receipts: count ?? 0,
          created_at: m.created_at,
        });
      }

      const { data: former } = await admin
        .from("farm_org_former_members")
        .select("user_id, full_name, removed_at")
        .eq("organization_id", id)
        .order("removed_at", { ascending: false });

      return c.json({
        organization: {
          ...org,
          seats_limit: org.seats_limit ?? 1,
          seats_used: rows.length,
        },
        members,
        former_members: former ?? [],
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // POST /admin/orgs — cria a organização do cliente (com equipe).
  app.post("/admin/orgs", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => null);
      const name = String(body?.name ?? "").trim();
      if (!name) return c.json({ error: "name_required" }, 400);

      const seats = Number(body?.seats_limit);
      const admin = getSupabaseAdmin();
      const { data: org, error } = await admin
        .from("organizations")
        .insert({
          name,
          cnpj: body?.cnpj ? String(body.cnpj).replace(/\D/g, "") : null,
          type: "farm",
          kind: body?.kind === "individual" ? "individual" : "company",
          seats_limit:
            Number.isFinite(seats) && seats > 0 ? Math.floor(seats) : 5,
          plan_code: body?.plan_code ?? null,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: body?.trial_ends_at ?? null,
        })
        .select()
        .single();
      if (error) return c.json({ error: error.message }, 400);

      await seedDefaultCostCenter(admin, org.id);
      await logAdminAction(
        admin,
        c,
        auth.user,
        "create_org",
        { id: org.id },
        {
          name,
          seats_limit: org.seats_limit,
        },
      );
      return c.json({ organization: org }, 201);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // PATCH /admin/orgs/:id
  app.patch("/admin/orgs/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object")
        return c.json({ error: "invalid_body" }, 400);

      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string" && body.name.trim())
        patch.name = body.name.trim();
      if (typeof body.cnpj === "string")
        patch.cnpj = body.cnpj.replace(/\D/g, "") || null;
      if (body.kind === "company" || body.kind === "individual")
        patch.kind = body.kind;
      if (body.seats_limit !== undefined) {
        const n = Number(body.seats_limit);
        if (!Number.isFinite(n) || n < 1)
          return c.json({ error: "invalid_seats_limit" }, 400);
        patch.seats_limit = Math.floor(n);
      }
      if ("plan_code" in body) patch.plan_code = body.plan_code || null;
      if ("trial_ends_at" in body)
        patch.trial_ends_at = body.trial_ends_at || null;
      if (Object.keys(patch).length === 0)
        return c.json({ error: "no_fields_to_update" }, 400);

      const admin = getSupabaseAdmin();

      // Não deixa baixar o teto abaixo de quem já está dentro — o excedente não
      // teria como ser expulso sozinho, e a org ficaria num estado inválido.
      if (patch.seats_limit !== undefined) {
        const { count } = await admin
          .from("users_meta")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", id);
        if ((count ?? 0) > (patch.seats_limit as number)) {
          return c.json(
            {
              error: "seats_below_current_members",
              seats_used: count ?? 0,
            },
            400,
          );
        }
      }

      const { data, error } = await admin
        .from("organizations")
        .update(patch)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);

      await logAdminAction(admin, c, auth.user, "update_org", { id }, patch);
      return c.json({ organization: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * POST /admin/orgs/:id/members — vincula um usuário JÁ EXISTENTE (por e-mail).
   *
   * Caso do assinante avulso que vira funcionário: ele TEM histórico. O
   * endpoint recusa com 409 + a contagem, e a UI decide entre as duas saídas:
   *   move_data=true  traz os lançamentos junto (o padrão que a pessoa espera —
   *                   senão ela perde o próprio histórico, já que a org antiga
   *                   fica sem ninguém dentro)
   *   confirm=true    deixa o histórico na organização antiga
   */
  app.post("/admin/orgs/:id/members", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const orgId = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      const email = String(body?.email ?? "")
        .trim()
        .toLowerCase();
      let role =
        ROLES.includes(body?.role) && body.role !== "owner"
          ? body.role
          : "member";
      if (!email) return c.json({ error: "email_required" }, 400);

      const admin = getSupabaseAdmin();

      // Organização recém-criada não tem titular: a primeira pessoa a entrar
      // vira owner. Org sem dono é um estado torto — o cron de alertas, por
      // exemplo, procura o owner quando não sabe pra quem notificar.
      const { count: ownerCount } = await admin
        .from("users_meta")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", "owner");
      if ((ownerCount ?? 0) === 0) role = "owner";

      const { data: org } = await admin
        .from("organizations")
        .select("id, name, seats_limit")
        .eq("id", orgId)
        .maybeSingle();
      if (!org) return c.json({ error: "org_not_found" }, 404);

      const { count: seatsUsed } = await admin
        .from("users_meta")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", orgId);
      if ((seatsUsed ?? 0) >= (org.seats_limit ?? 1)) {
        return c.json(
          {
            error: "seats_limit_reached",
            seats_limit: org.seats_limit ?? 1,
            seats_used: seatsUsed ?? 0,
          },
          400,
        );
      }

      // auth.admin não busca por e-mail: varre a lista (base pequena e dedicada).
      const { data: list } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const target = (list?.users ?? []).find(
        (u) => (u.email ?? "").toLowerCase() === email,
      );
      if (!target) return c.json({ error: "user_not_found" }, 404);

      const { data: meta } = await admin
        .from("users_meta")
        .select("organization_id, full_name, role")
        .eq("user_id", target.id)
        .maybeSingle();
      if (meta?.organization_id === orgId) {
        return c.json({ error: "already_member" }, 400);
      }

      let leftBehind = 0;
      if (meta?.organization_id) {
        const { count } = await admin
          .from("farm_receipts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", meta.organization_id)
          .eq("created_by", target.id);
        leftBehind = count ?? 0;
        if (
          leftBehind > 0 &&
          body?.confirm !== true &&
          body?.move_data !== true
        ) {
          const { data: oldOrg } = await admin
            .from("organizations")
            .select("name")
            .eq("id", meta.organization_id)
            .maybeSingle();
          return c.json(
            {
              error: "user_has_data",
              receipts: leftBehind,
              current_organization: oldOrg?.name ?? null,
            },
            409,
          );
        }
      }

      const previousOrg = meta?.organization_id ?? null;
      if (meta) {
        const { error } = await admin
          .from("users_meta")
          .update({ organization_id: orgId, role })
          .eq("user_id", target.id);
        if (error) return c.json({ error: error.message }, 400);
      } else {
        const { error } = await admin.from("users_meta").insert({
          user_id: target.id,
          organization_id: orgId,
          role,
          full_name: target.user_metadata?.full_name ?? "",
        });
        if (error) return c.json({ error: error.message }, 400);
      }

      let movedData: Record<string, number> | null = null;
      if (previousOrg) {
        await moveUserBindings(admin, target.id, previousOrg, orgId);
        if (body?.move_data === true) {
          movedData = await moveUserData(admin, target.id, previousOrg, orgId);
          leftBehind = 0; // não sobrou nada lá atrás
        } else if (leftBehind > 0) {
          // Histórico ficou pra trás: registra como ex-membro de lá, pra a lista
          // da org antiga continuar sabendo de quem era o lançamento.
          await admin.from("farm_org_former_members").upsert(
            {
              organization_id: previousOrg,
              user_id: target.id,
              full_name: meta?.full_name ?? null,
              removed_by: auth.user?.id ?? null,
            },
            { onConflict: "organization_id,user_id" },
          );
        }
      }
      await admin
        .from("farm_org_former_members")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", target.id);

      await logAdminAction(
        admin,
        c,
        auth.user,
        "org_add_member",
        { id: target.id, email: target.email },
        {
          organization_id: orgId,
          role,
          previous_organization_id: previousOrg,
          receipts_left_behind: leftBehind,
          moved_data: movedData,
        },
      );
      return c.json({
        ok: true,
        receipts_left_behind: leftBehind,
        moved_data: movedData,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * PATCH /admin/orgs/:id/members/:userId — troca o perfil.
   * role=owner transfere a titularidade: o titular atual vira gestor (admin),
   * porque organização com dois titulares não tem dono.
   */
  app.patch("/admin/orgs/:id/members/:userId", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const orgId = c.req.param("id");
      const userId = c.req.param("userId");
      const body = await c.req.json().catch(() => null);
      const role = body?.role;
      if (!ROLES.includes(role)) return c.json({ error: "invalid_role" }, 400);

      const admin = getSupabaseAdmin();
      const { data: meta } = await admin
        .from("users_meta")
        .select("user_id, role")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!meta) return c.json({ error: "not_found" }, 404);

      if (role === "owner" && meta.role !== "owner") {
        await admin
          .from("users_meta")
          .update({ role: "admin" })
          .eq("organization_id", orgId)
          .eq("role", "owner");
      }
      if (role !== "owner" && meta.role === "owner") {
        return c.json({ error: "transfer_ownership_first" }, 400);
      }

      const { error } = await admin
        .from("users_meta")
        .update({ role })
        .eq("user_id", userId)
        .eq("organization_id", orgId);
      if (error) return c.json({ error: error.message }, 400);

      await logAdminAction(
        admin,
        c,
        auth.user,
        "org_set_role",
        { id: userId },
        {
          organization_id: orgId,
          from: meta.role,
          to: role,
        },
      );
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * DELETE /admin/orgs/:id/members/:userId — desvincula.
   *
   * Decisão de produto (docs/ORGANIZACOES-E-PERFIS.md §3): os lançamentos FICAM
   * com a organização. A pessoa sai para uma conta avulsa nova e vazia — nunca
   * fica sem organização, senão o app dela responde "sem organização" e trava.
   */
  app.delete("/admin/orgs/:id/members/:userId", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const orgId = c.req.param("id");
      const userId = c.req.param("userId");
      const admin = getSupabaseAdmin();

      const { data: meta } = await admin
        .from("users_meta")
        .select("user_id, full_name, role")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!meta) return c.json({ error: "not_found" }, 404);
      if (meta.role === "owner") {
        return c.json({ error: "transfer_ownership_first" }, 400);
      }

      // RETRATO ANTES DE DESVINCULAR. Aqui nada é apagado — os lançamentos
      // ficam com a organização (decisão 3 de ORGANIZACOES-E-PERFIS §3) —, mas
      // os VÍNCULOS mudam de dono e a pessoa sai para uma organização nova.
      // Desfazer isso na mão depois é trabalhoso; o retrato torna reversível.
      // Falhou o backup, não desvincula.
      let retrato;
      try {
        retrato = await retratoDeSaida(admin, userId, auth.user?.id ?? null);
      } catch (e) {
        return c.json(
          {
            error: "backup_de_saida_falhou",
            detalhe: e instanceof Error ? e.message : String(e),
            aviso: "Desvínculo abortado: sem backup, não há como desfazer.",
          },
          500,
        );
      }

      const { data: newOrg, error: orgErr } = await admin
        .from("organizations")
        .insert({
          name: meta.full_name?.trim() || "Minha conta",
          type: "farm",
          kind: "individual",
          seats_limit: 1,
        })
        .select()
        .single();
      if (orgErr) return c.json({ error: orgErr.message }, 400);
      await seedDefaultCostCenter(admin, newOrg.id);

      const { error } = await admin
        .from("users_meta")
        .update({ organization_id: newOrg.id, role: "owner" })
        .eq("user_id", userId);
      if (error) return c.json({ error: error.message }, 400);

      await moveUserBindings(admin, userId, orgId, newOrg.id);
      await admin.from("farm_org_former_members").upsert(
        {
          organization_id: orgId,
          user_id: userId,
          full_name: meta.full_name,
          removed_by: auth.user?.id ?? null,
        },
        { onConflict: "organization_id,user_id" },
      );

      await logAdminAction(
        admin,
        c,
        auth.user,
        "org_remove_member",
        { id: userId },
        {
          backup: retrato.chave,
          organization_id: orgId,
          new_organization_id: newOrg.id,
        },
      );
      return c.json({ ok: true, new_organization_id: newOrg.id });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
