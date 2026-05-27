import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { extractReceiptFromImage } from "../lib/gemini.ts";
import { uploadToR2 } from "../lib/r2.ts";
import { runFarmAi } from "../lib/farmAi.ts";
import {
  bytesToBase64,
  downloadMedia,
  sendButtons,
  sendText,
} from "../lib/whatsapp.ts";

/**
 * Webhook WhatsApp Business (Meta) do Farm — Fase A.
 *
 * Fluxo da joia: usuario manda foto/PDF do recibo -> OCR Gemini -> bot mostra
 * os campos -> usuario confirma no chat -> cria farm_receipts (source=whatsapp).
 *
 * PNID filter e ESSENCIAL: a Meta entrega na mesma URL webhooks de qualquer
 * numero da WABA. So processamos o numero do Farm (WHATSAPP_FARM_BOT_PNID).
 *
 * Webhook e publico (deploy --no-verify-jwt) -> tudo via service_role.
 * Conversa livre (function calling Gemini) fica pra Fase B.
 */

const APP_URL = "https://farm.cropware.com.br";
const OCR_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

// Dedup em memoria: Meta retenta se a resposta demora. Guarda ids recentes.
const seenMessageIds = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60_000;
function alreadyHandled(id: string): boolean {
  const now = Date.now();
  for (const [k, ts] of seenMessageIds) {
    if (now - ts > DEDUP_TTL_MS) seenMessageIds.delete(k);
  }
  if (seenMessageIds.has(id)) return true;
  seenMessageIds.set(id, now);
  return false;
}

// Roda trabalho pesado fora do ciclo da resposta quando o runtime permite;
// senao aguarda (dedup garante que o retry da Meta nao reprocessa).
function runBackground(work: Promise<unknown>): Promise<void> | void {
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er && typeof er.waitUntil === "function") {
    er.waitUntil(work.catch((e: unknown) => console.error("[wa bg]", e)));
    return;
  }
  return work.then(() => {}).catch((e) => console.error("[wa bg]", e));
}

// ---------- state helpers (service_role) ----------

interface LinkedUser {
  user_id: string;
  organization_id: string;
  user_name: string | null;
}

// deno-lint-ignore no-explicit-any
async function getLinkedUser(admin: any, phone: string): Promise<LinkedUser | null> {
  const { data } = await admin
    .from("farm_whatsapp_links")
    .select("user_id, organization_id, user_name, is_active")
    .eq("phone_number", phone)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return {
    user_id: data.user_id,
    organization_id: data.organization_id,
    user_name: data.user_name,
  };
}

// deno-lint-ignore no-explicit-any
async function setPending(admin: any, phone: string, kind: string, data: unknown, ttlMs = 10 * 60_000) {
  await admin.from("farm_wa_pending").upsert({
    phone_number: phone,
    kind,
    data,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  });
}

// deno-lint-ignore no-explicit-any
async function getPending(admin: any, phone: string): Promise<{ kind: string; data: any } | null> {
  const { data } = await admin
    .from("farm_wa_pending")
    .select("kind, data, expires_at")
    .eq("phone_number", phone)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await admin.from("farm_wa_pending").delete().eq("phone_number", phone);
    return null;
  }
  return { kind: data.kind, data: data.data };
}

// deno-lint-ignore no-explicit-any
async function clearPending(admin: any, phone: string) {
  await admin.from("farm_wa_pending").delete().eq("phone_number", phone);
}

// deno-lint-ignore no-explicit-any
async function tryLinkByCode(admin: any, phone: string, code: string): Promise<LinkedUser | null> {
  const { data: row } = await admin
    .from("farm_whatsapp_link_codes")
    .select("*")
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!row) return null;

  await admin.from("farm_whatsapp_links").upsert({
    phone_number: phone,
    user_id: row.user_id,
    organization_id: row.organization_id,
    user_name: row.user_name,
    is_active: true,
    linked_at: new Date().toISOString(),
  }, { onConflict: "phone_number" });
  await admin.from("farm_whatsapp_link_codes").update({ used: true }).eq("id", row.id);

  return { user_id: row.user_id, organization_id: row.organization_id, user_name: row.user_name };
}

// ---------- formatação ----------

function fmtBRL(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// deno-lint-ignore no-explicit-any
function receiptSummary(e: any): string {
  const lines = [
    `*${e.direction === "income" ? "Receita" : "Despesa"}* — ${fmtBRL(e.total_value)}`,
    e.vendor ? `Fornecedor: ${e.vendor}` : null,
    e.category ? `Categoria: ${e.category}` : null,
    e.transaction_date ? `Data: ${e.transaction_date}` : null,
    e.payment_method ? `Pagamento: ${e.payment_method}` : null,
    e.invoice_number ? `Documento: ${e.invoice_number}` : null,
    e.description ? `Descrição: ${e.description}` : null,
  ].filter(Boolean);
  const conf = typeof e.confidence === "number" ? ` _(confiança ${Math.round(e.confidence * 100)}%)_` : "";
  return `📄 *Recibo lido*${conf}\n\n${lines.join("\n")}\n\nConfirma o lançamento?`;
}

// ---------- mensagem -> ação ----------

// deno-lint-ignore no-explicit-any
async function handleMessage(admin: any, msg: any): Promise<void> {
  const from: string = msg.from;
  const linked = await getLinkedUser(admin, from);

  // 1) Botões interativos (confirmação de recibo)
  if (msg.type === "interactive") {
    const i = msg.interactive;
    const actionId = i?.button_reply?.id || i?.list_reply?.id || "";
    if (actionId === "rcpt_ok") {
      const pending = await getPending(admin, from);
      if (!pending || pending.kind !== "receipt_confirm") {
        await sendText(from, "⏳ Esse recibo expirou. Manda a foto de novo.");
        return;
      }
      const p = pending.data;
      const e = p.extracted;
      const direction = e.direction === "income" ? "income" : "expense";
      const { error } = await admin.from("farm_receipts").insert({
        organization_id: p.organization_id,
        created_by: p.user_id,
        doc_type: e.doc_type || "outro",
        direction,
        status: direction === "income" ? "a_receber" : "a_pagar",
        total_value: Number.isFinite(e.total_value) ? e.total_value : 0,
        currency: "BRL",
        transaction_date: e.transaction_date ?? null,
        vendor: e.vendor ?? null,
        vendor_cnpj: e.vendor_cnpj ?? null,
        payment_method: e.payment_method ?? null,
        description: e.description ?? null,
        category: e.category ?? null,
        invoice_number: e.invoice_number ?? null,
        attachment_key: p.attachment_key ?? null,
        attachment_mime: p.attachment_mime ?? null,
        source: "whatsapp",
        ai_confidence: typeof e.confidence === "number" ? e.confidence : null,
        ai_raw: e,
      });
      await clearPending(admin, from);
      if (error) {
        console.error("[wa] insert receipt failed:", error);
        await sendText(from, "❌ Não consegui salvar o lançamento. Tenta de novo ou usa o app.");
        return;
      }
      await sendText(from, `✅ Lançamento salvo!\n${fmtBRL(e.total_value)} — ${e.category || e.doc_type}\n\nVer no app: ${APP_URL}`);
      return;
    }
    if (actionId === "rcpt_edit") {
      await clearPending(admin, from);
      await sendText(from, `✏️ Sem problema. Abre o app pra lançar/editar manual: ${APP_URL}`);
      return;
    }
    return;
  }

  // 2) Texto
  if (msg.type === "text") {
    const text: string = (msg.text?.body || "").trim();
    const lower = text.toLowerCase();

    if (["menu", "ajuda", "/menu", "oi", "olá", "ola"].includes(lower)) {
      await sendText(
        from,
        linked
          ? "👋 Sou o assistente financeiro da *Cropware Farm*.\n\n• Manda uma *foto* ou *PDF* de recibo/nota/boleto que eu leio e lanço.\n• Ou me fala por texto: _\"paguei 850 de diesel\"_, _\"quanto tenho a pagar?\"_, _\"meus últimos lançamentos\"_."
          : "👋 Olá! Pra usar o assistente da *Cropware Farm*, primeiro vincule sua conta.\n\nNo app: *Configurações → Integrações → WhatsApp*, gere um código de 6 dígitos e me envie aqui.",
      );
      return;
    }

    // Código de vínculo (6 dígitos)
    if (/^\d{6}$/.test(text)) {
      if (linked) {
        await sendText(from, "✅ Seu WhatsApp já está vinculado. Manda uma foto de recibo pra começar.");
        return;
      }
      const newLink = await tryLinkByCode(admin, from, text);
      if (newLink) {
        await sendText(from, `✅ *Conta vinculada!*${newLink.user_name ? ` Olá, ${newLink.user_name}.` : ""}\n\nAgora é só mandar foto/PDF de recibos que eu lanço pra você.`);
      } else {
        await sendText(from, "❌ Código inválido ou expirado. Gere um novo no app: *Configurações → Integrações → WhatsApp*.");
      }
      return;
    }

    if (!linked) {
      await sendText(from, "🔒 Pra eu te ajudar, vincule sua conta primeiro: gere um código de 6 dígitos no app (*Configurações → Integrações → WhatsApp*) e me envie aqui.");
      return;
    }

    // Texto livre de usuário vinculado → IA financeira (Fase B, Gemini function calling)
    const reply = await runFarmAi(admin, linked, text);
    await sendText(from, reply);
    return;
  }

  // 3) Imagem / documento -> OCR de recibo
  if (msg.type === "image" || msg.type === "document") {
    if (!linked) {
      await sendText(from, "📸 Recebi seu arquivo, mas preciso que vincule sua conta primeiro. Gere um código de 6 dígitos no app e me envie.");
      return;
    }

    const media = msg.type === "image" ? msg.image : msg.document;
    const mime: string = media?.mime_type || "image/jpeg";
    if (!OCR_MIMES.has(mime)) {
      await sendText(from, `📎 Recebi o arquivo, mas só consigo ler imagem ou PDF (recebi ${mime}).`);
      return;
    }

    await sendText(from, "📄 Lendo o documento...");

    let buf: ArrayBuffer;
    try {
      buf = await downloadMedia(media.id);
    } catch (e) {
      console.error("[wa] download failed:", e);
      await sendText(from, "⚠️ Não consegui baixar o arquivo. Reenvia em alguns segundos.");
      return;
    }
    if (buf.byteLength > 10 * 1024 * 1024) {
      await sendText(from, "📄 Arquivo acima de 10MB. Manda uma foto mais leve ou páginas separadas.");
      return;
    }

    const base64 = bytesToBase64(buf);
    const ocr = await extractReceiptFromImage(base64, mime);
    if (!ocr.ok) {
      console.error("[wa] ocr failed:", ocr.error);
      await sendText(from, "🤔 Li o arquivo mas não consegui extrair os dados. Tenta uma foto mais nítida, ou lança manual no app.");
      return;
    }

    // OCR ok -> guarda o doc no R2 e abre a confirmação no chat
    const yyyymm = new Date().toISOString().slice(0, 7);
    const ext = mime === "application/pdf" ? "pdf" : (mime.split("/")[1] || "jpg");
    const key = `org-${linked.organization_id}/${yyyymm}/${crypto.randomUUID()}.${ext}`;
    try {
      await uploadToR2(key, buf, mime);
    } catch (e) {
      console.error("[wa] R2 upload failed:", e);
      await sendText(from, "⚠️ Li os dados mas falhei ao guardar o arquivo. Tenta de novo.");
      return;
    }

    await setPending(admin, from, "receipt_confirm", {
      extracted: ocr.data,
      attachment_key: key,
      attachment_mime: mime,
      user_id: linked.user_id,
      organization_id: linked.organization_id,
    });

    await sendButtons(from, receiptSummary(ocr.data), [
      { id: "rcpt_ok", title: "✅ Confirmar" },
      { id: "rcpt_edit", title: "✏️ Editar no app" },
    ]);
    return;
  }

  // 4) Outros tipos (áudio, localização, etc.) — fora do escopo da Fase A
  await sendText(from, "🙂 Por enquanto eu processo *fotos e PDFs* de recibos. Áudio e conversa livre chegam nas próximas fases.");
}

export function mountWhatsappRoutes(app: Hono) {
  // Verificação do webhook (Meta challenge GET)
  app.get("/webhook/whatsapp", (c) => {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    const expected = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (mode === "subscribe" && token && expected && token === expected) {
      return c.text(challenge ?? "", 200);
    }
    return c.json({ error: "forbidden" }, 403);
  });

  // App web (autenticado) gera código de 6 dígitos pra vincular WhatsApp
  app.post("/integrations/generate-code", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const { data: meta } = await client
        .from("users_meta").select("full_name").eq("user_id", auth.user!.id).maybeSingle();

      // limpa códigos antigos não usados desse user
      await client.from("farm_whatsapp_link_codes")
        .delete().eq("user_id", auth.user!.id).eq("used", false);

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      const { error } = await client.from("farm_whatsapp_link_codes").insert({
        code,
        user_id: auth.user!.id,
        organization_id: auth.organizationId,
        user_name: meta?.full_name ?? null,
        expires_at: expiresAt,
      });
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ code, expires_at: expiresAt });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  // Webhook principal (mensagens recebidas)
  app.post("/webhook/whatsapp", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.entry) return c.json({ ok: true });

    // PNID filter — só o número do Farm
    const myPnid = Deno.env.get("WHATSAPP_FARM_BOT_PNID");
    const incomingPnid = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (myPnid && incomingPnid && incomingPnid !== myPnid) {
      return c.json({ ok: true, ignored: true, reason: "foreign_pnid" });
    }

    // Coleta + dedup das mensagens
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [];
    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        for (const m of change.value?.messages || []) {
          if (m.id && alreadyHandled(m.id)) continue;
          messages.push(m);
        }
      }
    }
    if (messages.length === 0) return c.json({ ok: true });

    const admin = getSupabaseAdmin();
    const work = (async () => {
      for (const m of messages) {
        try {
          await handleMessage(admin, m);
        } catch (e) {
          console.error("[wa] handleMessage error:", e);
          try {
            await sendText(m.from, "⚠️ Tive um problema processando isso. Tenta de novo em alguns segundos.");
          } catch { /* nunca trava */ }
        }
      }
    })();

    const maybe = runBackground(work);
    if (maybe) await maybe;
    return c.json({ ok: true });
  });

  // Webhook da Salvy — captura o SMS de verificação da Meta (número virtual não
  // tem SIM, SMS só chega aqui). Guarda o último pra leitura durante o registro.
  // TODO produção: verificar assinatura svix-signature com SALVY_WEBHOOK_SECRET.
  app.post("/webhook/salvy-sms", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "invalid" }, 400);
    if (body.type === "sms.received") {
      console.log("[salvy-sms] recebido:", JSON.stringify(body.data ?? body).slice(0, 300));
      const admin = getSupabaseAdmin();
      await admin.from("farm_wa_pending").upsert({
        phone_number: "salvy:last-sms",
        kind: "salvy_sms",
        data: body.data ?? body,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
    }
    return c.json({ ok: true });
  });
}
