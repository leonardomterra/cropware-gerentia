import type { Context, Hono } from "npm:hono";
import { getUserClient, requireMaster } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { isMasterUser } from "../lib/masterUsers.ts";

/**
 * Registra uma ação sensível do painel MASTER em farm_admin_audit. Nunca lança:
 * auditoria não pode derrubar a ação em si (best-effort), só loga falha.
 */
async function logAdminAction(
  // deno-lint-ignore no-explicit-any
  admin: any,
  c: Context,
  actor: { id?: string; email?: string | null },
  action: string,
  target: { id?: string | null; email?: string | null },
  detail?: Record<string, unknown>,
) {
  try {
    const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    await admin.from("farm_admin_audit").insert({
      actor_user_id: actor.id ?? null,
      actor_email: actor.email ?? null,
      action,
      target_user_id: target.id ?? null,
      target_email: target.email ?? null,
      detail: detail ?? null,
      ip: fwd || c.req.header("cf-connecting-ip") || null,
      user_agent: c.req.header("user-agent") ?? null,
    });
  } catch (e) {
    console.error("[admin audit] falha ao registrar:", e);
  }
}

/**
 * Painel MASTER de gestão de usuários (gerentia.app).
 * Gateado por requireMaster (email em MASTER_EMAILS). Opera via service_role
 * (bypassa RLS) + auth.admin.*. Projeto dedicado => listUsers só traz usuários
 * do gerentia (sem mistura com Studio).
 *
 * Fase 1: listar, criar, editar, suspender, reset de senha, excluir.
 * Masters são protegidos (não dá pra suspender/excluir master nem a si mesmo).
 */
export function mountAdminRoutes(app: Hono) {
  // GET /admin/users — lista todos os usuários + org + trial.
  app.get("/admin/users", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const admin = getSupabaseAdmin();

      const { data: list, error } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (error) return c.json({ error: error.message }, 400);

      const { data: metas } = await admin
        .from("users_meta")
        .select(
          "user_id, full_name, role, phone, whatsapp_linked_at, created_at, organization_id, organizations(name, trial_ends_at, plan_code)",
        );
      const metaById: Record<string, any> = {};
      // deno-lint-ignore no-explicit-any
      for (const m of (metas as any[]) ?? []) metaById[m.user_id] = m;

      const users = (list?.users ?? []).map((u) => {
        const m = metaById[u.id];
        const org = m?.organizations ?? null;
        return {
          id: u.id,
          email: u.email ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          created_at: u.created_at,
          // deno-lint-ignore no-explicit-any
          banned_until: (u as any).banned_until ?? null,
          is_master: isMasterUser(u.email),
          full_name: m?.full_name ?? (u.user_metadata?.full_name ?? null),
          role: m?.role ?? null,
          phone: m?.phone ?? null,
          organization_id: m?.organization_id ?? null,
          organization_name: org?.name ?? null,
          trial_ends_at: org?.trial_ends_at ?? null,
          plan_code: org?.plan_code ?? null,
        };
      });

      return c.json({ users });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // POST /admin/users — cria conta nova (own org). password OU invite.
  // user_metadata.farm_signup dispara o trigger handle_new_farm_user
  // (cria org + users_meta owner + farm + CCs default).
  app.post("/admin/users", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => null);
      if (!body?.email) return c.json({ error: "email_required" }, 400);

      const admin = getSupabaseAdmin();
      const metadata = {
        farm_signup: true,
        full_name: body.full_name ?? "",
        farm_name: body.farm_name ?? body.organization_name ?? "Minha Fazenda",
        phone: body.phone ?? undefined,
        cpf: body.cpf ?? undefined,
      };

      if (body.invite) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(
          body.email,
          { data: metadata },
        );
        if (error) return c.json({ error: error.message }, 400);
        return c.json({ ok: true, user_id: data.user?.id, invited: true });
      }

      if (!body.password) return c.json({ error: "password_required" }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) return c.json({ error: error.message }, 400);

      return c.json({ ok: true, user_id: data.user?.id });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // PATCH /admin/users/:id — nome/role/phone (users_meta), email/senha (auth),
  // trial_ends_at (org do usuário).
  app.patch("/admin/users/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return c.json({ error: "invalid_body" }, 400);
      }
      const admin = getSupabaseAdmin();

      // auth.users (email/senha)
      // deno-lint-ignore no-explicit-any
      const authUpdate: any = {};
      if (body.email) authUpdate.email = body.email;
      if (body.password) authUpdate.password = body.password;
      if (Object.keys(authUpdate).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(id, authUpdate);
        if (error) return c.json({ error: error.message }, 400);
      }

      // users_meta
      // deno-lint-ignore no-explicit-any
      const metaUpdate: any = {};
      if (typeof body.full_name === "string") {
        metaUpdate.full_name = body.full_name.trim();
      }
      if (body.role && ["owner", "admin", "member"].includes(body.role)) {
        metaUpdate.role = body.role;
      }
      if (typeof body.phone === "string") metaUpdate.phone = body.phone;
      if (Object.keys(metaUpdate).length > 0) {
        const { error } = await admin
          .from("users_meta")
          .update(metaUpdate)
          .eq("user_id", id);
        if (error) return c.json({ error: error.message }, 400);
      }

      // trial na organização do usuário
      if (body.trial_ends_at !== undefined) {
        const { data: m } = await admin
          .from("users_meta")
          .select("organization_id")
          .eq("user_id", id)
          .maybeSingle();
        if (m?.organization_id) {
          await admin
            .from("organizations")
            .update({ trial_ends_at: body.trial_ends_at })
            .eq("id", m.organization_id);
        }
      }

      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // POST /admin/users/:id/reset-password — gera senha aleatória e devolve.
  app.post("/admin/users/:id/reset-password", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const admin = getSupabaseAdmin();
      const newPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 12) +
        "Aa1!";
      const { error } = await admin.auth.admin.updateUserById(id, {
        password: newPassword,
      });
      if (error) return c.json({ error: error.message }, 400);
      await logAdminAction(admin, c, auth.user, "reset_password", { id });
      return c.json({ ok: true, password: newPassword });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // POST /admin/users/:id/suspend — { suspended: bool } via ban_duration nativo.
  app.post("/admin/users/:id/suspend", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const body = await c.req.json().catch(() => ({}));
      const suspended = !!body.suspended;

      const admin = getSupabaseAdmin();
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (isMasterUser(u?.user?.email)) {
        return c.json({ error: "cannot_suspend_master" }, 400);
      }

      const { error } = await admin.auth.admin.updateUserById(id, {
        ban_duration: suspended ? "876000h" : "none",
      });
      if (error) return c.json({ error: error.message }, 400);
      await logAdminAction(admin, c, auth.user, suspended ? "suspend" : "unsuspend", { id, email: u?.user?.email });
      return c.json({ ok: true, suspended });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // POST /admin/users/:id/impersonate — gera magic link (hashed_token) do alvo
  // pro frontend trocar a sessão (startImpersonation). Não impersona masters.
  app.post("/admin/users/:id/impersonate", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const admin = getSupabaseAdmin();
      const { data: u } = await admin.auth.admin.getUserById(id);
      const email = u?.user?.email;
      if (!email) return c.json({ error: "user_not_found" }, 404);
      if (isMasterUser(email)) {
        return c.json({ error: "cannot_impersonate_master" }, 400);
      }

      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      // deno-lint-ignore no-explicit-any
      const hashed = (data as any)?.properties?.hashed_token;
      if (error || !hashed) {
        return c.json({ error: error?.message || "link_failed" }, 400);
      }

      const { data: m } = await admin
        .from("users_meta")
        .select("full_name")
        .eq("user_id", id)
        .maybeSingle();

      // Ação mais crítica do painel — sempre auditada.
      await logAdminAction(admin, c, auth.user, "impersonate", { id, email });

      return c.json({
        hashed_token: hashed,
        target_email: email,
        target_name: m?.full_name ?? "",
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // DELETE /admin/users/:id — exclui o usuário (users_meta cai por cascade FK).
  app.delete("/admin/users/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const admin = getSupabaseAdmin();

      const { data: u } = await admin.auth.admin.getUserById(id);
      if (isMasterUser(u?.user?.email)) {
        return c.json({ error: "cannot_delete_master" }, 400);
      }
      if (u?.user?.id === auth.user?.id) {
        return c.json({ error: "cannot_delete_self" }, 400);
      }

      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return c.json({ error: error.message }, 400);
      await logAdminAction(admin, c, auth.user, "delete_user", { id, email: u?.user?.email });
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
