import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { extractReceiptFromImage, transcribeAudio } from "../lib/gemini.ts";
import { uploadToR2 } from "../lib/r2.ts";
import { applyCreateReceipt, applyMarkPaid, askDateButtons, fmtDateBR, parseDateBR, runFarmAi, todayBR, yesterdayBR, type LinkedUser } from "../lib/farmAi.ts";
import { getAllowedCostCenterIds, listUserCostCenters } from "../lib/cc.ts";
import {
  bytesToBase64,
  downloadMedia,
  sendButtons,
  sendList,
  sendText,
} from "../lib/whatsapp.ts";

/**
 * Webhook WhatsApp Business (Meta) do Farm.
 *
 * Fluxo da joia: foto/PDF -> OCR -> bot mostra dados + CC -> usuario confirma
 * (ou troca o CC) -> cria farm_receipts (source=whatsapp).
 *
 * RBAC + CC: bot respeita os centros de custo permitidos pro user via
 * lib/cc.ts. Member ve/cria so nos CCs liberados; owner/admin ve tudo.
 *
 * PNID filter, dedup, background processing, safety net por mensagem.
 */

const APP_URL = "https://farm.cropware.com.br";
const OCR_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

// Dedup em memoria: Meta retenta se a resposta demora.
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

// deno-lint-ignore no-explicit-any
async function getLinkedUser(admin: any, phone: string): Promise<LinkedUser | null> {
  const { data } = await admin
    .from("farm_whatsapp_links")
    .select("user_id, organization_id, user_name, is_active")
    .eq("phone_number", phone)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  const userId = data.user_id as string;
  const orgId = data.organization_id as string;

  const { data: meta } = await admin
    .from("users_meta")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  const role = (meta?.role as "owner" | "admin" | "member" | null) || "member";

  const [allowed, ccs] = await Promise.all([
    getAllowedCostCenterIds(admin, userId, orgId),
    listUserCostCenters(admin, userId, orgId),
  ]);

  return {
    user_id: userId,
    organization_id: orgId,
    user_name: data.user_name ?? null,
    role,
    allowed_cost_center_ids: allowed,
    cost_centers: ccs,
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

  return await getLinkedUser(admin, phone);
}

// ---------- formatação ----------

function fmtBRL(v: number | null): string {
  if (v === null || v === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/** Itens validos da OCR (total finito >= 0). 2+ => recibo itemizado. */
// deno-lint-ignore no-explicit-any
function ocrItems(e: any): any[] {
  const raw = Array.isArray(e?.line_items) ? e.line_items : [];
  return raw.filter(
    // deno-lint-ignore no-explicit-any
    (li: any) => li && Number.isFinite(Number(li.total_value)) && Number(li.total_value) >= 0,
  );
}

/** Soma dos itens, arredondada uma vez. */
// deno-lint-ignore no-explicit-any
function ocrItemsTotal(items: any[]): number {
  return Number(items.reduce((s, li) => s + Number(li.total_value), 0).toFixed(2));
}

// deno-lint-ignore no-explicit-any
function receiptSummary(e: any, ccName: string | null, showCC: boolean): string {
  const items = ocrItems(e);
  const itemized = items.length >= 2;
  const total = itemized ? ocrItemsTotal(items) : e.total_value;

  const lines = [
    "*" + (e.direction === "income" ? "Receita" : "Despesa") + "* - " + fmtBRL(total),
    e.vendor ? "Fornecedor: " + e.vendor : null,
    // Com itens, a categoria vem por item (mostrada no bloco abaixo).
    !itemized && e.category ? "Categoria: " + e.category : null,
    e.transaction_date ? "Data: " + e.transaction_date : null,
    e.payment_method ? "Pagamento: " + e.payment_method : null,
    e.invoice_number ? "Documento: " + e.invoice_number : null,
    e.description ? "Descricao: " + e.description : null,
    showCC && ccName ? "Centro: " + ccName : null,
  ].filter(Boolean);

  let itemsBlock = "";
  if (itemized) {
    // Limite o numero de itens mostrados (body interativo do WhatsApp ~1024).
    const MAX_SHOWN = 8;
    const rows = items.slice(0, MAX_SHOWN).map((li) => {
      const name = li.description || li.category || "item";
      const cat = li.category ? " (" + li.category + ")" : "";
      return "• " + name + cat + " - " + fmtBRL(Number(li.total_value));
    });
    if (items.length > MAX_SHOWN) {
      rows.push("• … +" + (items.length - MAX_SHOWN) + " item(ns)");
    }
    itemsBlock = "\n\n*Itens (" + items.length + "):*\n" + rows.join("\n");
  }

  const conf = typeof e.confidence === "number"
    ? " _(confianca " + Math.round(e.confidence * 100) + "%)_"
    : "";
  return "📄 *Recibo lido*" + conf + "\n\n" + lines.join("\n") + itemsBlock +
    "\n\nConfirma o lancamento?";
}

function confirmButtons(showChangeCC: boolean) {
  const buttons: Array<{ id: string; title: string }> = [
    { id: "rcpt_ok", title: "✅ Confirmar" },
  ];
  if (showChangeCC) buttons.push({ id: "rcpt_change_cc", title: "🏷️ Mudar centro" });
  buttons.push({ id: "rcpt_edit", title: "✏️ Editar no app" });
  return buttons;
}

const PHOTO_DATE_BUTTONS = [
  { id: "cr_date:hoje", title: "Hoje" },
  { id: "cr_date:ontem", title: "Ontem" },
  { id: "cr_date:custom", title: "Outra data" },
];

/**
 * Insere farm_receipts a partir do pending receipt_confirm (foto/PDF).
 * Aceita override de data quando a OCR nao extraiu.
 */
// deno-lint-ignore no-explicit-any
async function savePhotoReceipt(admin: any, p: any, dateOverride: string | null, linked: LinkedUser | null): Promise<string | null> {
  const e = p.extracted;
  const direction = e.direction === "income" ? "income" : "expense";

  // Itens da OCR: 2+ => recibo itemizado (total = soma, header cat/cc nulos,
  // cada item com sua categoria; o CC escolhido vale pra todos os itens).
  const items = ocrItems(e);
  const itemized = items.length >= 2;
  const total = itemized
    ? ocrItemsTotal(items)
    : (Number.isFinite(e.total_value) ? e.total_value : 0);

  const { data: inserted, error } = await admin.from("farm_receipts").insert({
    organization_id: p.organization_id,
    created_by: p.user_id,
    doc_type: e.doc_type || "outro",
    direction,
    status: direction === "income" ? "a_receber" : "a_pagar",
    total_value: total,
    currency: "BRL",
    transaction_date: dateOverride ?? e.transaction_date ?? null,
    vendor: e.vendor ?? null,
    vendor_cnpj: e.vendor_cnpj ?? null,
    payment_method: e.payment_method ?? null,
    description: e.description ?? null,
    category: itemized ? null : (e.category ?? null),
    invoice_number: e.invoice_number ?? null,
    cost_center_id: itemized ? null : (p.cost_center_id ?? null),
    item_count: itemized ? items.length : 0,
    attachment_key: p.attachment_key ?? null,
    attachment_mime: p.attachment_mime ?? null,
    source: "whatsapp",
    ai_confidence: typeof e.confidence === "number" ? e.confidence : null,
    ai_raw: e,
  }).select("id").single();
  if (error || !inserted) {
    console.error("[wa] insert photo receipt failed:", error);
    return null;
  }

  if (itemized) {
    const rows = items.map((li, i) => ({
      receipt_id: inserted.id,
      organization_id: p.organization_id,
      position: i,
      description: typeof li.description === "string" ? li.description : null,
      category: typeof li.category === "string" ? li.category : null,
      // CC escolhido pro recibo inteiro vale pra cada item.
      cost_center_id: p.cost_center_id ?? null,
      quantity: Number.isFinite(Number(li.quantity)) ? Number(li.quantity) : null,
      unit_value: Number.isFinite(Number(li.unit_value)) ? Number(li.unit_value) : null,
      total_value: Number(li.total_value),
    }));
    const { error: itErr } = await admin.from("farm_receipt_items").insert(rows);
    if (itErr) {
      // Sem transacao multi-statement: compensa apagando o cabecalho.
      console.error("[wa] insert items failed, rolling back:", itErr);
      await admin.from("farm_receipts").delete().eq("id", inserted.id);
      return null;
    }
  }

  const ccTail = p.cost_center_name && (linked?.cost_centers.length ?? 0) > 1
    ? "\nCentro: " + p.cost_center_name : "";
  const finalDate = dateOverride ?? e.transaction_date ?? null;
  const dateTail = finalDate ? "\nData: " + fmtDateBR(finalDate) : "";
  const head = itemized
    ? items.length + " itens"
    : (e.category || e.doc_type);
  return "✅ Lancamento salvo!\n" + fmtBRL(total) + " - " +
    head + ccTail + dateTail + "\n\nVer no app: " + APP_URL;
}

// ---------- mensagem -> ação ----------

// deno-lint-ignore no-explicit-any
async function handleMessage(admin: any, msg: any): Promise<void> {
  const from: string = msg.from;
  const linked = await getLinkedUser(admin, from);

  // 1) Botões / lista interativos
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
      // Se a OCR nao extraiu data, pergunta antes de salvar.
      if (!p.extracted?.transaction_date) {
        await setPending(admin, from, "photo_select_date", p);
        await sendButtons(from, "Qual a data desse lançamento?", PHOTO_DATE_BUTTONS);
        return;
      }
      const ok = await savePhotoReceipt(admin, p, null, linked);
      await clearPending(admin, from);
      if (!ok) { await sendText(from, "❌ Nao consegui salvar o lancamento. Tenta de novo ou usa o app."); return; }
      await sendText(from, ok);
      return;
    }

    if (actionId === "rcpt_edit") {
      await clearPending(admin, from);
      await sendText(from, "✏️ Sem problema. Abre o app pra lancar/editar manual: " + APP_URL);
      return;
    }

    // Seleção de CC vinda do execCreateReceipt (texto/audio com >1 CCs)
    if (actionId.startsWith("cr_cc:")) {
      const ccId = actionId.slice("cr_cc:".length);
      const pending = await getPending(admin, from);
      if (!pending || pending.kind !== "create_select_cc" || !linked) {
        await sendText(from, "⏳ Esse pedido expirou. Manda de novo.");
        return;
      }
      const cc = linked.cost_centers.find((c) => c.id === ccId);
      if (!cc) { await sendText(from, "Esse centro nao ta na sua lista."); return; }
      // Se data ja veio do Gemini, salva direto; senao pergunta data.
      if (pending.data.args.transaction_date) {
        await clearPending(admin, from);
        const reply = await applyCreateReceipt(admin, linked, pending.data.args, cc);
        await sendText(from, reply);
      } else {
        await askDateButtons(admin, from, pending.data.args, cc.id);
      }
      return;
    }

    // Seleção de data: cr_date:hoje | ontem | custom (cobre create + photo)
    if (actionId.startsWith("cr_date:")) {
      const which = actionId.slice("cr_date:".length);
      const pending = await getPending(admin, from);
      if (!pending || (pending.kind !== "create_select_date" && pending.kind !== "photo_select_date")) {
        await sendText(from, "⏳ Esse pedido expirou.");
        return;
      }
      if (which === "custom") {
        // Muda pra modo input de texto (mesmo data shape)
        const nextKind = pending.kind === "create_select_date" ? "create_input_date" : "photo_input_date";
        await setPending(admin, from, nextKind, pending.data);
        await sendText(from, "Beleza, me diz a data.\n\nEx: *25/03/26*, *25/03*, *ontem*, *anteontem*, *dia 25*, *terça*, *amanhã*, *próxima sexta*...\n\n_Ou manda 'cancelar' pra abortar._");
        return;
      }
      const date = which === "hoje" ? todayBR() : yesterdayBR();
      if (pending.kind === "create_select_date" && linked) {
        const cc = linked.cost_centers.find((c) => c.id === pending.data.cc_id);
        if (!cc) { await sendText(from, "Centro saiu da lista. Tenta de novo."); await clearPending(admin, from); return; }
        await clearPending(admin, from);
        const args = { ...pending.data.args, transaction_date: date };
        const reply = await applyCreateReceipt(admin, linked, args, cc);
        await sendText(from, reply);
      } else {
        // photo_select_date
        const ok = await savePhotoReceipt(admin, pending.data, date, linked);
        await clearPending(admin, from);
        if (!ok) { await sendText(from, "❌ Nao consegui salvar."); return; }
        await sendText(from, ok);
      }
      return;
    }

    // Trocar CC do recibo pendente
    if (actionId === "rcpt_change_cc") {
      const pending = await getPending(admin, from);
      if (!pending || pending.kind !== "receipt_confirm" || !linked) {
        await sendText(from, "⏳ Esse recibo expirou. Manda a foto de novo.");
        return;
      }
      const ccs = linked.cost_centers;
      if (ccs.length < 2) {
        await sendText(from, "Voce so tem 1 centro de custo — nao tem o que trocar.");
        return;
      }
      await sendList(from, "Em qual centro lancar?", "Escolher centro", [{
        rows: ccs.map((c) => ({
          id: "rcpt_cc:" + c.id,
          title: c.name,
          description: c.id === pending.data.cost_center_id ? "(atual)" : undefined,
        })),
      }]);
      return;
    }

    // Seleção de CC na lista
    if (actionId.startsWith("rcpt_cc:")) {
      const newCCId = actionId.slice("rcpt_cc:".length);
      const pending = await getPending(admin, from);
      if (!pending || pending.kind !== "receipt_confirm" || !linked) {
        await sendText(from, "⏳ Esse recibo expirou. Manda a foto de novo.");
        return;
      }
      const cc = linked.cost_centers.find((c) => c.id === newCCId);
      if (!cc) {
        await sendText(from, "Esse centro nao ta na sua lista.");
        return;
      }
      await setPending(admin, from, "receipt_confirm", {
        ...pending.data,
        cost_center_id: cc.id,
        cost_center_name: cc.name,
      });
      await sendButtons(
        from,
        receiptSummary(pending.data.extracted, cc.name, true),
        confirmButtons(true),
      );
      return;
    }

    return;
  }

  // 2) Texto
  if (msg.type === "text") {
    const text: string = (msg.text?.body || "").trim();
    const lower = text.toLowerCase();

    if (["menu", "ajuda", "/menu", "oi", "ola"].includes(lower)) {
      await sendText(
        from,
        linked
          ? "👋 Sou o assistente financeiro da *Cropware Farm*.\n\n- Manda uma *foto* ou *PDF* de recibo/nota/boleto que eu leio e lanco.\n- Ou me fala por texto: paguei 850 de diesel / quanto tenho a pagar / meus ultimos lancamentos."
          : "👋 Ola! Pra usar o assistente da *Cropware Farm*, primeiro vincule sua conta.\n\nNo app: *Conta -> WhatsApp*, gere um codigo de 6 digitos e me envie aqui.",
      );
      return;
    }

    if (/^\d{6}$/.test(text)) {
      if (linked) {
        await sendText(from, "✅ Seu WhatsApp ja esta vinculado. Manda uma foto de recibo pra comecar.");
        return;
      }
      const newLink = await tryLinkByCode(admin, from, text);
      if (newLink) {
        await sendText(
          from,
          "✅ *Conta vinculada!*" + (newLink.user_name ? " Ola, " + newLink.user_name + "." : "") +
            "\n\nAgora e so mandar foto/PDF de recibos que eu lanco pra voce.",
        );
      } else {
        await sendText(from, "❌ Codigo invalido ou expirado. Gere um novo no app: *Conta -> WhatsApp*.");
      }
      return;
    }

    if (!linked) {
      await sendText(
        from,
        "🔒 Pra eu te ajudar, vincule sua conta primeiro: gere um codigo de 6 digitos no app (*Conta -> WhatsApp*) e me envie aqui.",
      );
      return;
    }

    // Cancelar a qualquer momento se houver pending
    const lowerText = text.toLowerCase().trim();

    // Input de data livre (cr_date:custom selecionado): parse via Gemini.
    if (lowerText !== "" && (lowerText === "cancelar" || lowerText === "voltar")) {
      const pending = await getPending(admin, from);
      if (pending) {
        await clearPending(admin, from);
        await sendText(from, "Ok, cancelei.");
        return;
      }
    }
    {
      const pending = await getPending(admin, from);
      if (pending && (pending.kind === "create_input_date" || pending.kind === "photo_input_date")) {
        const parsed = await parseDateBR(text);
        if (!parsed.ok) {
          await sendText(from, `🤔 ${parsed.reason}. Tenta outra vez (ex: *25/03/26*, *ontem*, *dia 25*) ou manda *cancelar*.`);
          return;
        }
        if (pending.kind === "create_input_date") {
          const cc = linked?.cost_centers.find((c) => c.id === pending.data.cc_id);
          if (!cc) { await clearPending(admin, from); await sendText(from, "Centro saiu da sua lista. Tenta de novo."); return; }
          await clearPending(admin, from);
          const args = { ...pending.data.args, transaction_date: parsed.date };
          const reply = await applyCreateReceipt(admin, linked!, args, cc);
          await sendText(from, reply);
        } else {
          const ok = await savePhotoReceipt(admin, pending.data, parsed.date, linked);
          await clearPending(admin, from);
          if (!ok) { await sendText(from, "❌ Nao consegui salvar."); return; }
          await sendText(from, ok);
        }
        return;
      }
    }

    // Desambiguacao de mark_receipt_paid: user respondeu "1", "2", etc apos
    // o bot listar varias contas pendentes (pending kind='pay_select').
    const numericMatch = /^[1-9]\d?$/.test(text) ? Number(text) : null;
    if (numericMatch !== null) {
      const pending = await getPending(admin, from);
      if (pending?.kind === "pay_select") {
        const ids: string[] = Array.isArray(pending.data?.ids) ? pending.data.ids : [];
        const idx = numericMatch - 1;
        if (idx < 0 || idx >= ids.length) {
          await sendText(from, "Numero fora do intervalo. Manda outro, ou 'cancelar'.");
          return;
        }
        const receiptId = ids[idx];
        const { data: row } = await admin
          .from("farm_receipts")
          .select("id, direction, vendor, description, category, total_value, status")
          .eq("id", receiptId)
          .maybeSingle();
        await clearPending(admin, from);
        if (!row) {
          await sendText(from, "Essa conta sumiu — talvez tenha sido apagada. Tenta de novo.");
          return;
        }
        if (row.status === "pago" || row.status === "recebido") {
          await sendText(from, "Essa conta ja estava como " + row.status + ". 😉");
          return;
        }
        const reply = await applyMarkPaid(admin, row);
        await sendText(from, reply);
        return;
      }
    }

    const reply = await runFarmAi(admin, linked, text, from);
    if (reply) await sendText(from, reply); // "" = execCreate ja despachou botoes
    return;
  }

  // 3) Imagem / documento -> OCR + CC
  if (msg.type === "image" || msg.type === "document") {
    if (!linked) {
      await sendText(
        from,
        "📸 Recebi seu arquivo, mas preciso que vincule sua conta primeiro. Gere um codigo de 6 digitos no app e me envie.",
      );
      return;
    }
    const media = msg.type === "image" ? msg.image : msg.document;
    const mime: string = media?.mime_type || "image/jpeg";
    if (!OCR_MIMES.has(mime)) {
      await sendText(from, "📎 Recebi o arquivo, mas so consigo ler imagem ou PDF (recebi " + mime + ").");
      return;
    }
    if (linked.cost_centers.length === 0) {
      await sendText(from, "Voce ainda nao tem nenhum centro de custo liberado. Pede pro admin antes de mandar recibo.");
      return;
    }

    await sendText(from, "📄 Lendo o documento...");
    let buf: ArrayBuffer;
    try {
      buf = await downloadMedia(media.id);
    } catch (e) {
      console.error("[wa] download failed:", e);
      await sendText(from, "⚠️ Nao consegui baixar o arquivo. Reenvia em alguns segundos.");
      return;
    }
    if (buf.byteLength > 10 * 1024 * 1024) {
      await sendText(from, "📄 Arquivo acima de 10MB. Manda uma foto mais leve ou paginas separadas.");
      return;
    }
    const base64 = bytesToBase64(buf);
    const ocr = await extractReceiptFromImage(base64, mime);
    if (!ocr.ok) {
      console.error("[wa] ocr failed:", ocr.error);
      await sendText(from, "🤔 Li o arquivo mas nao consegui extrair os dados. Tenta uma foto mais nitida, ou lanca manual no app.");
      return;
    }

    // CC default do user pra esse recibo. Se >1 CC, oferece "Mudar centro".
    const defaultCC = linked.cost_centers.find((c) => c.is_default) || linked.cost_centers[0];
    const yyyymm = new Date().toISOString().slice(0, 7);
    const ext = mime === "application/pdf" ? "pdf" : (mime.split("/")[1] || "jpg");
    const key = "org-" + linked.organization_id + "/" + yyyymm + "/" + crypto.randomUUID() + "." + ext;
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
      cost_center_id: defaultCC.id,
      cost_center_name: defaultCC.name,
    });

    const showCC = linked.cost_centers.length > 1;
    await sendButtons(
      from,
      receiptSummary(ocr.data, defaultCC.name, showCC),
      confirmButtons(showCC),
    );
    return;
  }

  // 4) Audio (mensagem de voz) -> transcricao Gemini -> runFarmAi
  if (msg.type === "audio") {
    if (!linked) {
      await sendText(
        from,
        "🎙️ Recebi seu audio, mas preciso que vincule sua conta primeiro. Gere um codigo de 6 digitos no app e me envie.",
      );
      return;
    }
    const audio = msg.audio;
    const mime: string = audio?.mime_type?.split(";")[0]?.trim() || "audio/ogg";
    await sendText(from, "🎙️ Ouvindo seu audio...");
    let buf: ArrayBuffer;
    try {
      buf = await downloadMedia(audio.id);
    } catch (e) {
      console.error("[wa] audio download failed:", e);
      await sendText(from, "⚠️ Nao consegui baixar o audio. Tenta de novo em alguns segundos.");
      return;
    }
    if (buf.byteLength > 10 * 1024 * 1024) {
      await sendText(from, "🎙️ Audio acima de 10MB. Manda algo mais curto, por favor.");
      return;
    }
    const tr = await transcribeAudio(bytesToBase64(buf), mime);
    if (!tr.ok) {
      console.error("[wa] transcribe failed:", tr.error);
      await sendText(from, "🤔 Ouvi o audio mas nao consegui entender. Tenta de novo, ou manda por texto.");
      return;
    }
    if (!tr.transcript || tr.transcript === "[inaudivel]") {
      await sendText(from, "🤔 Nao deu pra entender o audio. Tenta falar mais perto do microfone, ou manda por texto.");
      return;
    }
    await sendText(from, "🎙️ Entendi: _" + tr.transcript + "_");
    const reply = await runFarmAi(admin, linked, tr.transcript, from);
    if (reply) await sendText(from, reply);
    return;
  }

  await sendText(from, "🙂 Por enquanto eu processo *fotos, PDFs e audios* de recibos/financas, e converso por texto.");
}

export function mountWhatsappRoutes(app: Hono) {
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

  app.post("/integrations/generate-code", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const { data: meta } = await client
        .from("users_meta").select("full_name").eq("user_id", auth.user!.id).maybeSingle();
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

  app.post("/webhook/whatsapp", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.entry) return c.json({ ok: true });
    const myPnid = Deno.env.get("WHATSAPP_FARM_BOT_PNID");
    const incomingPnid = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (myPnid && incomingPnid && incomingPnid !== myPnid) {
      return c.json({ ok: true, ignored: true, reason: "foreign_pnid" });
    }
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
