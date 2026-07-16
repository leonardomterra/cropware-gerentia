import type { Hono } from "npm:hono";
import { requireCronSecret } from "../lib/cronGuard.ts";
import { getUserClient, requireMaster } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { sendTemplate, submitTemplate } from "../lib/whatsapp.ts";
import { secret } from "../lib/env.ts";

const TEMPLATE_DUE = "farm_alerta_vencimento";
const TEMPLATE_SUMMARY = "farm_resumo_semanal";
// Lembrete de tarefa (to-do). Pre-submetido aqui; o cron que usa fica na Etapa 2b.
const TEMPLATE_TASK = "farm_lembrete_tarefa";
const TEMPLATE_LANG = "pt_BR";

/** Pequeno helper pra moeda BR. Templates Meta nao aceitam "R$ " no parametro
 * de body, entao vamos passar so o valor formatado: "1.250,00". */
function fmtBR(v: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function ddmm(yyyymmdd: string): string {
  const [, m, d] = yyyymmdd.split("-");
  return `${d}/${m}`;
}

function relativeDay(dueDate: string, todayDate: string): { kind: "due_today" | "due_in_1d" | "due_in_3d" | "overdue"; label: string } {
  const due = new Date(dueDate + "T00:00:00Z").getTime();
  const today = new Date(todayDate + "T00:00:00Z").getTime();
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return { kind: "overdue", label: `venceu em ${ddmm(dueDate)}` };
  if (diff === 0) return { kind: "due_today", label: "hoje" };
  if (diff === 1) return { kind: "due_in_1d", label: "amanhã" };
  return { kind: "due_in_3d", label: `em ${diff} dias` };
}

export function mountCronRoutes(app: Hono) {
  // V2 stub mantido.
  app.post("/cron/mark-overdue", (c) => {
    const denied = requireCronSecret(c);
    if (denied) return denied;
    return c.json({ error: "not_implemented", todo: "V2_overdue" }, 501);
  });

  /**
   * R3.1 - Alertas proativos de vencimento.
   * Disparado por pg_cron diariamente 09:00 UTC via pg_net.http_post.
   * Sequencia: query receipts pendentes com due_date <= today+3
   *   -> filtra os ja alertados nesse kind via farm_alert_log
   *   -> lookup phone via farm_whatsapp_links pelo created_by
   *   -> envia Meta template
   *   -> insere farm_alert_log row.
   */
  /**
   * Resolve QUEM recebe. Devolve dois alvos distintos de proposito:
   *
   * - notifyUserId: dono do item (created_by). So' cai pro owner da org quando
   *   nao ha' created_by. Notificacao in-app nao depende de telefone, entao ela
   *   deve ir pra quem criou — nao pro owner.
   * - phone/phoneUserId: telefone do criador; se ele nao tiver WhatsApp, cai pro
   *   owner. Preserva EXATAMENTE o comportamento historico do alerta WhatsApp.
   *
   * O owner so' e' buscado quando faz falta (evita 1 query extra por item).
   */
  async function resolveTarget(
    // deno-lint-ignore no-explicit-any
    admin: any,
    createdBy: string | null,
    organizationId: string,
  ): Promise<{ notifyUserId: string | null; phone: string | null; phoneUserId: string | null }> {
    // deno-lint-ignore no-explicit-any
    const phoneOf = async (uid: string): Promise<string | null> => {
      const { data: link } = await admin
        .from("farm_whatsapp_links")
        .select("phone_number, is_active")
        .eq("user_id", uid)
        .eq("is_active", true)
        .maybeSingle();
      return (link?.phone_number as string | undefined) ?? null;
    };

    let notifyUserId = createdBy;
    let phoneUserId = createdBy;
    let phone = createdBy ? await phoneOf(createdBy) : null;

    if (!phone || !notifyUserId) {
      const { data: owner } = await admin
        .from("users_meta")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("role", "owner")
        .maybeSingle();
      const ownerId = (owner?.user_id as string | undefined) ?? null;
      if (!notifyUserId) notifyUserId = ownerId;
      if (!phone && ownerId) {
        phone = await phoneOf(ownerId);
        phoneUserId = ownerId;
      }
    }
    return { notifyUserId, phone, phoneUserId };
  }

  /**
   * Insere a notificacao de forma IDEMPOTENTE — o cron roda todo dia e reveria o
   * mesmo vencimento. Dedup pelo unique (user_id, receipt_id|task_id, kind).
   * Retorna true so' quando criou de fato.
   */
  async function upsertNotification(
    // deno-lint-ignore no-explicit-any
    admin: any,
    row: Record<string, unknown>,
    onConflict: string,
  ): Promise<boolean> {
    const { data, error } = await admin
      .from("farm_notifications")
      .upsert(row, { onConflict, ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[cron alerts] notify insert:", error);
      return false;
    }
    return (data?.length ?? 0) > 0;
  }

  app.post("/cron/process-alerts", async (c) => {
    const denied = requireCronSecret(c);
    if (denied) return denied;

    const admin = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const horizonDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    // Janela: de 7 dias atras (pra ainda avisar vencido) ate 3 dias a frente.
    const backDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    // Pega despesas a_pagar/vencido com due_date no horizonte. Receitas a_receber
    // tambem entram (avisa que esta proxima do vencimento da entrada).
    const { data: due, error } = await admin
      .from("farm_receipts")
      .select("id, organization_id, created_by, direction, vendor, description, category, total_value, due_date, status")
      .in("status", ["a_pagar", "a_receber", "vencido"])
      .eq("is_estimated", false)
      .not("due_date", "is", null)
      .lte("due_date", horizonDate)
      .gte("due_date", backDate)
      .limit(500);
    if (error) {
      console.error("[cron alerts] query:", error);
      return c.json({ error: error.message }, 500);
    }

    let sent = 0, skipped = 0, failed = 0, notified = 0;
    for (const r of due || []) {
      const { kind, label } = relativeDay(r.due_date as string, today);
      const vendor = r.vendor || r.description || r.category || "lancamento";
      const valor = fmtBR(Number(r.total_value) || 0);

      // 1) Resolve o alvo ANTES de qualquer dedup de canal. Isso e' o que torna
      //    os canais independentes: antes, o dedup do WhatsApp e o "sem
      //    telefone -> continue" rodavam primeiro, entao quem NAO tem WhatsApp
      //    vinculado era descartado e nunca recebia nada — justamente quem so'
      //    tem o canal in-app.
      const { notifyUserId, phone, phoneUserId } = await resolveTarget(
        admin,
        r.created_by as string | null,
        r.organization_id as string,
      );

      // 2) Notificacao in-app: independe de telefone e de alert_log.
      if (notifyUserId) {
        const created = await upsertNotification(admin, {
          organization_id: r.organization_id,
          user_id: notifyUserId,
          kind,
          title: String(vendor).toUpperCase(),
          body: kind === "overdue" ? `R$ ${valor} — ${label}` : `R$ ${valor} — vence ${label}`,
          receipt_id: r.id,
        }, "user_id,receipt_id,kind");
        if (created) notified++;
      }

      // 3) WhatsApp: comportamento INALTERADO — so' com telefone e so' se ainda
      //    nao houve alerta pra (receipt, kind).
      if (!phone || !phoneUserId) { skipped++; continue; }
      const { data: existing } = await admin
        .from("farm_alert_log")
        .select("id")
        .eq("receipt_id", r.id)
        .eq("alert_kind", kind)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      let errMsg: string | null = null;
      try {
        await sendTemplate(phone, TEMPLATE_DUE, TEMPLATE_LANG, [vendor, valor, label]);
        sent++;
      } catch (e) {
        errMsg = e instanceof Error ? e.message : String(e);
        console.error("[cron alerts] send fail:", errMsg);
        failed++;
      }

      await admin.from("farm_alert_log").insert({
        receipt_id: r.id,
        user_id: phoneUserId,
        phone_number: phone,
        alert_kind: kind,
        error: errMsg,
      });
    }

    // ---- Tarefas: so' notificacao in-app (sem WhatsApp — os lembretes por
    // template estao parados, ver docs/FUTURAS-FEATURES.md). Mesmo cron, sem
    // schedule novo. `reminded_at` fica intocado (e' gancho do push futuro).
    const { data: dueTasks, error: taskErr } = await admin
      .from("farm_tasks")
      .select("id, organization_id, created_by, title, due_date, total_value")
      .eq("done", false)
      .not("due_date", "is", null)
      .lte("due_date", horizonDate)
      .gte("due_date", backDate)
      .limit(500);
    if (taskErr) console.error("[cron alerts] task query:", taskErr);

    for (const t of dueTasks || []) {
      const { kind, label } = relativeDay(t.due_date as string, today);
      const userId = t.created_by as string | null;
      if (!userId) continue; // created_by e' not null no schema; defensivo
      // Com valor, o corpo fica igual ao das contas ("R$ 500,00 — vence amanha").
      // Sem valor (o lembrete e' opcionalmente valorado), cai no rotulo generico.
      const v = Number(t.total_value);
      const prefix = Number.isFinite(v) && v > 0 ? `R$ ${fmtBR(v)}` : "Lembrete";
      const created = await upsertNotification(admin, {
        organization_id: t.organization_id,
        user_id: userId,
        kind,
        title: String(t.title || "lembrete").toUpperCase(),
        body: kind === "overdue" ? `${prefix} — ${label}` : `${prefix} — vence ${label}`,
        task_id: t.id,
      }, "user_id,task_id,kind");
      if (created) notified++;
    }

    // ---- Limpeza do dedup persistente do webhook (farm_wa_seen_messages). As
    // linhas so' servem pra barrar a reentrega da Meta (janela de minutos/horas);
    // depois de ~24h nenhum retry chega mais. Apaga as antigas pra tabela nao
    // crescer sem limite. Mesmo cron (roda 1x/dia), SEM schedule novo. Best-effort:
    // erro aqui nao afeta os alertas ja enviados.
    const seenCutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { error: purgeErr } = await admin
      .from("farm_wa_seen_messages")
      .delete()
      .lt("created_at", seenCutoff);
    if (purgeErr) console.error("[cron alerts] purge seen messages:", purgeErr);

    return c.json({
      ok: true,
      sent,
      skipped,
      failed,
      notified,
      processed: (due || []).length,
      tasksProcessed: (dueTasks || []).length,
    });
  });

  /**
   * R3.2 - Resumo semanal. Disparado por pg_cron sextas 18:00 UTC (15h BRT).
   * Calcula totais da semana corrente por org com WhatsApp vinculado.
   */
  app.post("/cron/weekly-summary", async (c) => {
    const denied = requireCronSecret(c);
    if (denied) return denied;
    const admin = getSupabaseAdmin();

    // Acha todos os links WhatsApp ativos (1 por user com app vinculado).
    const { data: links, error } = await admin
      .from("farm_whatsapp_links")
      .select("phone_number, organization_id, user_id, user_name")
      .eq("is_active", true);
    if (error) return c.json({ error: error.message }, 500);

    const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    let sent = 0, failed = 0;
    for (const link of links || []) {
      // Agrega receitas/despesas da semana pra essa org.
      const { data: rs } = await admin
        .from("farm_receipts")
        .select("direction, total_value, status")
        .eq("organization_id", link.organization_id)
        .gte("transaction_date", weekStart);
      let inc = 0, exp = 0, pend = 0;
      for (const r of rs || []) {
        const v = Number(r.total_value) || 0;
        if (r.direction === "income") inc += v;
        else exp += v;
        if (r.status === "a_pagar" || r.status === "vencido") pend += v;
      }
      const nome = (link.user_name as string | null) || "voce";
      try {
        await sendTemplate(link.phone_number as string, TEMPLATE_SUMMARY, TEMPLATE_LANG, [
          nome, fmtBR(inc), fmtBR(exp), fmtBR(pend),
        ]);
        sent++;
      } catch (e) {
        console.error("[cron summary] send fail:", e);
        failed++;
      }
    }
    return c.json({ ok: true, sent, failed });
  });

  /**
   * One-shot: submete os templates Meta pra aprovacao. Guard via verify_token
   * (mesmo padrao do antigo wa-subscribe). Remover apos uso.
   */
  // Lista status atual dos templates da WABA (usa token + WABA_ID do env, nao
  // expoe nada). Guard pelo verify_token. Retorna name, status, category,
  // rejected_reason, quality_score.
  app.get("/admin/list-templates", async (c) => {
    const auth = await requireMaster(getUserClient(c.req.raw));
    if (auth.error) return auth.error;
    const waba = secret("WHATSAPP_GERENTIA_BOT_WABA_ID");
    const token = secret("WHATSAPP_GERENTIA_BOT_TOKEN");
    if (!waba || !token) return c.json({ error: "config_missing" }, 500);
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${waba}/message_templates?fields=name,status,category,language,rejected_reason,quality_score&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.text();
    if (!res.ok) return c.json({ error: "graph_error", status: res.status, body }, 500);
    return c.json(JSON.parse(body));
  });

  app.get("/admin/submit-templates", async (c) => {
    const auth = await requireMaster(getUserClient(c.req.raw));
    if (auth.error) return auth.error;
    const results: Array<{ name: string; status: string; error?: string }> = [];

    const dueTpl = {
      name: TEMPLATE_DUE,
      language: TEMPLATE_LANG,
      category: "UTILITY",
      components: [{
        type: "BODY",
        text: "🔔 gerentia.app\n\nConta com {{1}} (R$ {{2}}) vence {{3}}.\n\nDetalhes no app.",
        example: { body_text: [["Cemig", "850,00", "amanha"]] },
      }],
    };
    try {
      const r = await submitTemplate(dueTpl);
      results.push({ name: TEMPLATE_DUE, status: r.status });
    } catch (e) {
      results.push({ name: TEMPLATE_DUE, status: "error", error: e instanceof Error ? e.message : String(e) });
    }

    const summaryTpl = {
      name: TEMPLATE_SUMMARY,
      language: TEMPLATE_LANG,
      category: "UTILITY",
      components: [{
        type: "BODY",
        text: "📊 Resumo semanal gerentia.app\n\nOla, {{1}}!\n\nEntradas: R$ {{2}}\nSaidas: R$ {{3}}\nPendente: R$ {{4}}\n\nVeja detalhes no app.",
        example: { body_text: [["Leonardo", "12.500,00", "8.300,00", "2.150,00"]] },
      }],
    };
    try {
      const r = await submitTemplate(summaryTpl);
      results.push({ name: TEMPLATE_SUMMARY, status: r.status });
    } catch (e) {
      results.push({ name: TEMPLATE_SUMMARY, status: "error", error: e instanceof Error ? e.message : String(e) });
    }

    // Lembrete de tarefa (to-do) — pre-submissao p/ o cron da Etapa 2b.
    const taskTpl = {
      name: TEMPLATE_TASK,
      language: TEMPLATE_LANG,
      category: "UTILITY",
      components: [{
        type: "BODY",
        text: "🔔 gerentia.app\n\nLembrete: {{1}} vence {{2}}.\n\nDetalhes no app.",
        example: { body_text: [["renovar o seguro", "amanhã"]] },
      }],
    };
    try {
      const r = await submitTemplate(taskTpl);
      results.push({ name: TEMPLATE_TASK, status: r.status });
    } catch (e) {
      results.push({ name: TEMPLATE_TASK, status: "error", error: e instanceof Error ? e.message : String(e) });
    }

    return c.json({ ok: true, results });
  });
}
