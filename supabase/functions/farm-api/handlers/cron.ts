import type { Hono } from "npm:hono";
import { requireCronSecret } from "../lib/cronGuard.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { sendTemplate, submitTemplate } from "../lib/whatsapp.ts";

const TEMPLATE_DUE = "farm_alerta_vencimento";
const TEMPLATE_SUMMARY = "farm_resumo_semanal";
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
  if (diff === 1) return { kind: "due_in_1d", label: "amanha" };
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
  app.post("/cron/process-alerts", async (c) => {
    const denied = requireCronSecret(c);
    if (denied) return denied;

    const admin = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const horizonDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    // Pega despesas a_pagar/vencido com due_date no horizonte. Receitas a_receber
    // tambem entram (avisa que esta proxima do vencimento da entrada).
    const { data: due, error } = await admin
      .from("farm_receipts")
      .select("id, organization_id, created_by, direction, vendor, description, category, total_value, due_date, status")
      .in("status", ["a_pagar", "a_receber", "vencido"])
      .not("due_date", "is", null)
      .lte("due_date", horizonDate)
      .gte("due_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
      .limit(500);
    if (error) {
      console.error("[cron alerts] query:", error);
      return c.json({ error: error.message }, 500);
    }

    let sent = 0, skipped = 0, failed = 0;
    for (const r of due || []) {
      const { kind, label } = relativeDay(r.due_date as string, today);

      // Ja alertado nesse kind?
      const { data: existing } = await admin
        .from("farm_alert_log")
        .select("id")
        .eq("receipt_id", r.id)
        .eq("alert_kind", kind)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      // Acha telefone vinculado (created_by). Fallback: owner da org.
      let phone: string | null = null;
      let userId = r.created_by as string | null;
      if (userId) {
        const { data: link } = await admin
          .from("farm_whatsapp_links")
          .select("phone_number, is_active")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        phone = (link?.phone_number as string | undefined) ?? null;
      }
      if (!phone) {
        const { data: owner } = await admin
          .from("users_meta")
          .select("user_id")
          .eq("organization_id", r.organization_id)
          .eq("role", "owner")
          .maybeSingle();
        if (owner) {
          userId = owner.user_id as string;
          const { data: link } = await admin
            .from("farm_whatsapp_links")
            .select("phone_number, is_active")
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle();
          phone = (link?.phone_number as string | undefined) ?? null;
        }
      }
      if (!phone || !userId) { skipped++; continue; }

      const vendor = r.vendor || r.description || r.category || "lancamento";
      const valor = fmtBR(Number(r.total_value) || 0);

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
        user_id: userId,
        phone_number: phone,
        alert_kind: kind,
        error: errMsg,
      });
    }

    return c.json({ ok: true, sent, skipped, failed, processed: (due || []).length });
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
  app.get("/admin/submit-templates", async (c) => {
    const key = c.req.query("key");
    if (key !== Deno.env.get("WHATSAPP_VERIFY_TOKEN")) {
      return c.json({ error: "forbidden" }, 403);
    }
    const results: Array<{ name: string; status: string; error?: string }> = [];

    const dueTpl = {
      name: TEMPLATE_DUE,
      language: TEMPLATE_LANG,
      category: "UTILITY",
      components: [{
        type: "BODY",
        text: "🔔 Cropware Farm\n\nConta com {{1}} (R$ {{2}}) vence {{3}}.\n\nDetalhes no app.",
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
        text: "📊 Resumo semanal Cropware Farm\n\nOla, {{1}}!\n\nEntradas: R$ {{2}}\nSaidas: R$ {{3}}\nPendente: R$ {{4}}\n\nVeja detalhes no app.",
        example: { body_text: [["Leonardo", "12.500,00", "8.300,00", "2.150,00"]] },
      }],
    };
    try {
      const r = await submitTemplate(summaryTpl);
      results.push({ name: TEMPLATE_SUMMARY, status: r.status });
    } catch (e) {
      results.push({ name: TEMPLATE_SUMMARY, status: "error", error: e instanceof Error ? e.message : String(e) });
    }

    return c.json({ ok: true, results });
  });
}
