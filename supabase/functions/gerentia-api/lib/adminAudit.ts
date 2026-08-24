import type { Context } from "npm:hono";

/**
 * Registra uma ação sensível do painel MASTER em farm_admin_audit. Nunca lança:
 * auditoria não pode derrubar a ação em si (best-effort), só loga falha.
 */
export async function logAdminAction(
  // deno-lint-ignore no-explicit-any
  admin: any,
  c: Context,
  actor: { id?: string; email?: string | null } | null,
  action: string,
  target: { id?: string | null; email?: string | null },
  detail?: Record<string, unknown>,
) {
  try {
    const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    // `insert()` do supabase-js NÃO lança: devolve { error }. Sem checar, o
    // catch abaixo nunca dispara e uma auditoria que falha some sem deixar
    // rastro — foi assim que `delete_user` nunca chegou a ser registrado.
    const { error } = await admin.from("farm_admin_audit").insert({
      actor_user_id: actor?.id ?? null,
      actor_email: actor?.email ?? null,
      action,
      target_user_id: target.id ?? null,
      target_email: target.email ?? null,
      detail: detail ?? null,
      ip: fwd || c.req.header("cf-connecting-ip") || null,
      user_agent: c.req.header("user-agent") ?? null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[admin audit] falha ao registrar:", e);
  }
}
