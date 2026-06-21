import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { extractReceiptFromImage, transcribeAudio } from "../lib/gemini.ts";
import { uploadToR2 } from "../lib/r2.ts";
import { secret } from "../lib/env.ts";
import { verifyMetaSignature } from "../lib/security.ts";
import { applyMarkPaid, fmtDateBR, parseDateBR, runFarmAi, todayBR, yesterdayBR, type LinkedUser, type WizardDraft } from "../lib/farmAi.ts";
import { listVisibleCategories, snapCategory } from "../lib/categories.ts";
import { getAllowedCostCenterIds, listUserCostCenters } from "../lib/cc.ts";
import {
  bytesToBase64,
  downloadMedia,
  sendButtons,
  sendList,
  sendText,
} from "../lib/whatsapp.ts";

/**
 * Webhook WhatsApp Business (Meta) do gerentia.app.
 *
 * Fluxo da joia: foto/PDF -> OCR -> bot mostra dados + CC -> usuario confirma
 * (ou troca o CC) -> cria farm_receipts (source=whatsapp).
 *
 * RBAC + CC: bot respeita os centros de custo permitidos pro user via
 * lib/cc.ts. Member ve/cria so nos CCs liberados; owner/admin ve tudo.
 *
 * PNID filter, dedup, background processing, safety net por mensagem.
 */

const APP_URL = "https://gerentia.app";
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

// Rate limit por telefone: cada mensagem dispara Gemini (custo real), então um
// flood (spam ou abuso) precisa de teto. Janela deslizante em memória.
const rateHits = new Map<string, number[]>();
const rateNotified = new Map<string, number>(); // pra avisar o flood só 1x/janela
const RATE_MAX = 15;
const RATE_WINDOW_MS = 60_000;
function checkRate(phone: string): { ok: boolean; notify: boolean } {
  const now = Date.now();
  // Poda buckets antigos pra não vazar memória.
  for (const [k, arr] of rateHits) {
    const kept = arr.filter((t) => now - t < RATE_WINDOW_MS);
    if (kept.length === 0) rateHits.delete(k);
    else rateHits.set(k, kept);
  }
  for (const [k, ts] of rateNotified) {
    if (now - ts > RATE_WINDOW_MS) rateNotified.delete(k);
  }
  const arr = rateHits.get(phone) ?? [];
  if (arr.length >= RATE_MAX) {
    const last = rateNotified.get(phone) ?? 0;
    const notify = now - last > RATE_WINDOW_MS;
    if (notify) rateNotified.set(phone, now);
    return { ok: false, notify };
  }
  arr.push(now);
  rateHits.set(phone, arr);
  return { ok: true, notify: false };
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
    e.vendor ? "Origem: " + e.vendor : null,
    // Com itens, a categoria vem por item (mostrada no bloco abaixo).
    !itemized && e.category ? "Categoria: " + e.category : null,
    e.transaction_date ? "Data: " + e.transaction_date : null,
    e.payment_method ? "Pagamento: " + (PAY_LABEL[e.payment_method] || e.payment_method) : null,
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
  return "Recibo lido" + conf + "\n\n" + lines.join("\n") + itemsBlock +
    "\n\nConfirma o lançamento?";
}

function confirmButtons(showChangeCC: boolean) {
  const buttons: Array<{ id: string; title: string }> = [
    { id: "rcpt_ok", title: "Confirmar" },
  ];
  if (showChangeCC) buttons.push({ id: "rcpt_change_cc", title: "Mudar centro" });
  buttons.push({ id: "rcpt_edit", title: "Editar no app" });
  return buttons;
}

const PHOTO_DATE_BUTTONS = [
  { id: "cr_date:hoje", title: "Hoje" },
  { id: "cr_date:ontem", title: "Ontem" },
  { id: "cr_date:custom", title: "Outra data" },
];

const PAY_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

// Perguntado quando a forma de pagamento de uma despesa não é identificada
// (ajuda a marcar cartão de crédito p/ anti-duplicidade com a fatura).
const PHOTO_PAY_BUTTONS = [
  { id: "cw_pay:cartao_credito", title: "Crédito" },
  { id: "cw_pay:cartao_debito", title: "Débito" },
  { id: "cw_pay:pix", title: "Pix" },
  { id: "cw_pay:dinheiro", title: "Dinheiro" },
  { id: "cw_pay:boleto", title: "Boleto" },
];

// Mesma pergunta no wizard de texto/voz (ids próprios "cw_wpay:" + opção Pular).
const WIZ_PAY_BUTTONS = [
  { id: "cw_wpay:cartao_credito", title: "Crédito" },
  { id: "cw_wpay:cartao_debito", title: "Débito" },
  { id: "cw_wpay:pix", title: "Pix" },
  { id: "cw_wpay:dinheiro", title: "Dinheiro" },
  { id: "cw_wpay:boleto", title: "Boleto" },
  { id: "cw_wpay:skip", title: "Pular" },
];

// ---------- Wizard de criação guiado (categoria -> status -> centro -> data -> confirmar) ----------

const STATUS_LABEL: Record<string, string> = {
  a_pagar: "A pagar", pago: "Pago", a_receber: "A receber",
  recebido: "Recebido", vencido: "Vencido", cancelado: "Cancelado",
};

interface WizState { draft: WizardDraft; steps: string[]; step: number; queue: WizardDraft[]; seq: number; total: number }

/** Decide as etapas faltantes (só o que o usuário não deixou claro) e inicia.
 *  Quando há vários lançamentos numa mensagem, anuncia "Lançamento N de M". */
// deno-lint-ignore no-explicit-any
async function startCreateWizard(admin: any, linked: LinkedUser, from: string, drafts: WizardDraft[], seq: number, total: number) {
  const [draft, ...queue] = drafts;
  if (!draft.cost_center_id && linked.cost_centers.length === 1) {
    draft.cost_center_id = linked.cost_centers[0].id;
  }
  const steps: string[] = [];
  // Categoria sempre confirma: mostra a sugestão da IA (com opção de trocar) ou,
  // se não inferiu nada, pergunta do que se trata.
  steps.push("category");
  if (!draft.status) steps.push("status");
  if (!draft.cost_center_id && linked.cost_centers.length > 1) steps.push("cost_center");
  // Camada extra (anti-duplicidade cartão): pergunta a forma de pagamento numa
  // DESPESA quando a IA não captou do texto. Receita não precisa.
  if (draft.direction !== "income" && !draft.payment_method) steps.push("payment");
  // Data de LANÇAMENTO = hoje (automática), nunca perguntada. Já o VENCIMENTO
  // (due_date) só faz sentido em conta a pagar/receber: pergunta se não veio no
  // texto. Quando o status ainda é desconhecido, incluímos e pulamos depois se
  // virar "pago".
  if (!draft.due_date && draft.status !== "pago" && draft.status !== "recebido") steps.push("vencimento");
  if (!draft.vendor) steps.push("origem");
  steps.push("notes");
  steps.push("confirm");
  const wiz: WizState = { draft, steps, step: 0, queue, seq, total };
  await setPending(admin, from, "create_wizard", wiz);
  if (total > 1) {
    const label = draft.category_name || (draft.direction === "income" ? "Receita" : "Despesa");
    await sendText(from, "Lançamento " + seq + " de " + total + ": *" + label + " — " + fmtBRL(draft.total_value) + "*");
  }
  await sendWizardStep(admin, linked, from, wiz);
}

/** Pergunta da etapa atual. */
// deno-lint-ignore no-explicit-any
async function sendWizardStep(_admin: any, linked: LinkedUser, from: string, wiz: WizState) {
  const d = wiz.draft;
  const step = wiz.steps[wiz.step];
  if (step === "category") {
    if (d.category) {
      // IA inferiu: mostra a sugestão pra confirmar ou trocar (como [Hoje]/[Outra data]).
      await sendButtons(from, "Categoria: *" + (d.category_name || "Outros") + "* — é essa?", [
        { id: "cw_cat:ok", title: "É essa" },
        { id: "cw_cat:other", title: "Outra" },
      ]);
    } else {
      await sendText(from, "Do que se trata essa " + (d.direction === "income" ? "receita" : "despesa") + "? Ex: diesel, energia, ração, peças, salário...");
    }
    return;
  }
  if (step === "status") {
    if (d.direction === "income") {
      await sendButtons(from, "Esse valor já foi recebido ou está a receber?", [
        { id: "cw_status:recebido", title: "Já recebi" },
        { id: "cw_status:areceber", title: "A receber" },
      ]);
    } else {
      await sendButtons(from, "Esse lançamento já foi pago ou está a pagar?", [
        { id: "cw_status:pago", title: "Já paguei" },
        { id: "cw_status:apagar", title: "A pagar" },
      ]);
    }
    return;
  }
  if (step === "cost_center") {
    const ccs = linked.cost_centers;
    const body = "Em qual centro de custo?";
    if (ccs.length <= 3) {
      await sendButtons(from, body, ccs.map((c) => ({ id: "cw_cc:" + c.id, title: c.name })));
    } else {
      await sendList(from, body, "Centros", [{ rows: ccs.map((c) => ({ id: "cw_cc:" + c.id, title: c.name })) }]);
    }
    return;
  }
  if (step === "vencimento") {
    await sendButtons(from, "Quando?", [
      { id: "cw_venc:hoje", title: "Hoje" },
      { id: "cw_venc:custom", title: "Outra data" },
    ]);
    return;
  }
  if (step === "payment") {
    await sendButtons(from, "Como foi pago? 💳", WIZ_PAY_BUTTONS);
    return;
  }
  if (step === "origem") {
    const q = d.direction === "income" ? "De quem veio? (nome, ou toque Pular)" : "Pra quem foi? (nome, ou toque Pular)";
    await sendButtons(from, q, [{ id: "cw_origem:skip", title: "Pular" }]);
    return;
  }
  if (step === "notes") {
    await sendButtons(from, "Quer adicionar uma observação?", [
      { id: "cw_notes:no", title: "Não" },
      { id: "cw_notes:yes", title: "Sim" },
    ]);
    return;
  }
  await sendButtons(from, wizardSummary(d, linked), [
    { id: "cw_confirm", title: "Confirmar" },
    { id: "cw_cancel", title: "Cancelar" },
  ]);
}

/** Formata o lançamento em negrito + citação (blockquote), 1 campo por linha. */
function formatLaunch(title: string, d: WizardDraft, linked: LinkedUser, status: string, date: string): string {
  const ccName = d.cost_center_id ? (linked.cost_centers.find((c) => c.id === d.cost_center_id)?.name ?? null) : null;
  const open = status === "a_pagar" || status === "a_receber";
  const lines = [
    "*" + title + "*",
    "*Tipo:* " + (d.direction === "income" ? "Receita" : "Despesa"),
    "*Valor:* " + fmtBRL(d.total_value),
    "*Categoria:* " + (d.category_name || "Outros"),
    "*Status:* " + (STATUS_LABEL[status] ?? status),
    "*Data:* " + fmtDateBR(date),
    (d.due_date && open) ? "*Vence:* " + fmtDateBR(d.due_date) : null,
    (ccName && linked.cost_centers.length > 1) ? "*Centro:* " + ccName : null,
    d.vendor ? "*Origem:* " + d.vendor : null,
    d.payment_method ? "*Pagamento:* " + (PAY_LABEL[d.payment_method] || d.payment_method) : null,
    d.notes ? "*Obs:* " + d.notes : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function wizardSummary(d: WizardDraft, linked: LinkedUser): string {
  const status = d.status ?? (d.direction === "income" ? "a_receber" : "a_pagar");
  const date = d.transaction_date ?? todayBR();
  return formatLaunch("Confirmar lançamento:", d, linked, status, date);
}

/** Aplica a resposta e vai pra próxima etapa (ou finaliza). */
// deno-lint-ignore no-explicit-any
async function advanceWizard(admin: any, linked: LinkedUser, from: string, wiz: WizState) {
  wiz.step++;
  // Conta já paga/recebida não tem vencimento: pula a etapa se sobrou.
  while (
    wiz.step < wiz.steps.length && wiz.steps[wiz.step] === "vencimento" &&
    (wiz.draft.status === "pago" || wiz.draft.status === "recebido")
  ) {
    wiz.step++;
  }
  if (wiz.step < wiz.steps.length) {
    await setPending(admin, from, "create_wizard", wiz);
    await sendWizardStep(admin, linked, from, wiz);
  } else {
    await finalizeWizard(admin, linked, from, wiz);
  }
}

/** Insere o lançamento e, se houver fila (vários numa mensagem), segue pro próximo. */
// deno-lint-ignore no-explicit-any
async function finalizeWizard(admin: any, linked: LinkedUser, from: string, wiz: WizState) {
  const d = wiz.draft;
  const status = d.status ?? (d.direction === "income" ? "a_receber" : "a_pagar");
  const paid = status === "pago" || status === "recebido";
  const date = d.transaction_date ?? todayBR();
  const { data: inserted, error } = await admin.from("farm_receipts").insert({
    organization_id: linked.organization_id,
    created_by: linked.user_id,
    doc_type: "outro",
    direction: d.direction,
    status,
    total_value: d.total_value,
    currency: "BRL",
    transaction_date: date,
    due_date: !paid ? d.due_date : null,
    paid_date: paid ? date : null,
    vendor: d.vendor,
    payment_method: d.payment_method,
    description: d.description,
    category: d.category ?? (d.direction === "income" ? "outros_receita" : "outros_despesa"),
    cost_center_id: d.cost_center_id,
    notes: d.notes,
    source: "whatsapp",
  }).select("id").single();
  await clearPending(admin, from);
  if (error || !inserted) {
    console.error("[wizard] insert failed:", error);
    await sendText(from, "Não consegui salvar. Tenta de novo ou usa o app.");
    return;
  }
  await admin.from("farm_whatsapp_links").update({ last_receipt_id: inserted.id }).eq("user_id", linked.user_id);
  await sendText(from, formatLaunch("Lançado:", d, linked, status, date));
  if (wiz.queue.length > 0) await startCreateWizard(admin, linked, from, wiz.queue, wiz.seq + 1, wiz.total);
}

/**
 * Insere farm_receipts a partir do pending receipt_confirm (foto/PDF).
 * Aceita override de data quando a OCR nao extraiu.
 */
// deno-lint-ignore no-explicit-any
async function savePhotoReceipt(admin: any, p: any, dateOverride: string | null, linked: LinkedUser | null): Promise<string | null> {
  const e = p?.extracted;
  if (!e || typeof e !== "object") {
    console.error("[wa] savePhotoReceipt: pending sem extracted");
    return null;
  }
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
    // Fatura nasce informativa (não soma); demais somam.
    counts_in_total: (e.doc_type || "outro") !== "fatura",
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
  return "Lançamento salvo.\n" + fmtBRL(total) + " - " +
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

    // Resposta da pergunta "Como foi pago?" (foto sem forma de pagamento clara).
    if (actionId.startsWith("cw_pay:")) {
      const pending = await getPending(admin, from);
      if (!pending || pending.kind !== "photo_payment_method" || !pending.data?.extracted || !linked) {
        await sendText(from, "⏳ Essa escolha expirou. Manda o comprovante de novo.");
        return;
      }
      const pm = actionId.slice("cw_pay:".length);
      const data = {
        ...pending.data,
        extracted: { ...pending.data.extracted, payment_method: pm },
      };
      const showCC = linked.cost_centers.length > 1;
      await setPending(admin, from, "receipt_confirm", data);
      await sendButtons(
        from,
        receiptSummary(data.extracted, data.cost_center_name, showCC),
        confirmButtons(showCC),
      );
      return;
    }

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

    // Seleção de data do fluxo de FOTO: cr_date:hoje | ontem | custom
    if (actionId.startsWith("cr_date:")) {
      const which = actionId.slice("cr_date:".length);
      const pending = await getPending(admin, from);
      if (!pending || pending.kind !== "photo_select_date") {
        await sendText(from, "⏳ Esse pedido expirou.");
        return;
      }
      if (which === "custom") {
        await setPending(admin, from, "photo_input_date", pending.data);
        await sendText(from, "Beleza, me diz a data.\n\nEx: *25/03/26*, *25/03*, *ontem*, *anteontem*, *dia 25*, *terça*, *amanhã*, *próxima sexta*...\n\n_Ou manda 'cancelar' pra abortar._");
        return;
      }
      const date = which === "hoje" ? todayBR() : yesterdayBR();
      const ok = await savePhotoReceipt(admin, pending.data, date, linked);
      await clearPending(admin, from);
      if (!ok) { await sendText(from, "❌ Nao consegui salvar."); return; }
      await sendText(from, ok);
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

    // ----- Wizard de criação: categoria -> status -> centro -> data -> confirmar -----
    if (actionId.startsWith("cw_")) {
      if (!linked) return;
      const pending = await getPending(admin, from);
      if (!pending || pending.kind !== "create_wizard") {
        await sendText(from, "Esse cadastro expirou. Manda de novo.");
        return;
      }
      const wiz = pending.data as WizState;

      if (actionId === "cw_cancel") { await clearPending(admin, from); await sendText(from, "Cancelado."); return; }
      if (actionId === "cw_confirm") { await finalizeWizard(admin, linked, from, wiz); return; }

      if (actionId.startsWith("cw_cat:")) {
        const v = actionId.slice("cw_cat:".length);
        if (v === "other") {
          await sendText(from, "Me diz a categoria certa. Ex: diesel, energia, ração, peças, salário...");
          return; // segue na etapa; o texto digitado vira a categoria (snap)
        }
        await advanceWizard(admin, linked, from, wiz); // "É essa": mantém a sugerida
        return;
      }
      if (actionId.startsWith("cw_status:")) {
        const v = actionId.slice("cw_status:".length);
        wiz.draft.status = v === "pago" ? "pago" : v === "recebido" ? "recebido" : v === "areceber" ? "a_receber" : "a_pagar";
        await advanceWizard(admin, linked, from, wiz);
        return;
      }
      if (actionId.startsWith("cw_cc:")) {
        const ccId = actionId.slice("cw_cc:".length);
        if (!linked.cost_centers.find((c) => c.id === ccId)) { await sendText(from, "Esse centro não tá na sua lista."); return; }
        wiz.draft.cost_center_id = ccId;
        await advanceWizard(admin, linked, from, wiz);
        return;
      }
      if (actionId.startsWith("cw_venc:")) {
        const which = actionId.slice("cw_venc:".length);
        if (which === "custom") {
          await sendText(from, "Me diz a data. Ex: amanhã, dia 30, 10/06, próxima sexta...");
          return; // segue na etapa; o que digitar vira o vencimento
        }
        wiz.draft.due_date = todayBR();
        await advanceWizard(admin, linked, from, wiz);
        return;
      }
      if (actionId.startsWith("cw_wpay:")) {
        const v = actionId.slice("cw_wpay:".length);
        wiz.draft.payment_method = v === "skip" ? null : v;
        await advanceWizard(admin, linked, from, wiz);
        return;
      }
      if (actionId === "cw_origem:skip") {
        wiz.draft.vendor = null;
        await advanceWizard(admin, linked, from, wiz);
        return;
      }
      if (actionId.startsWith("cw_notes:")) {
        const v = actionId.slice("cw_notes:".length);
        if (v === "yes") {
          await sendText(from, "Escreve a observação:");
          return; // segue na etapa notes; o que você digitar vira a observação
        }
        wiz.draft.notes = null;
        await advanceWizard(admin, linked, from, wiz);
        return;
      }
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
          ? "Sou o assistente financeiro do gerentia.app.\n\n- Manda uma foto ou PDF de recibo/nota/boleto que eu leio e lanço.\n- Ou me fala por texto. Ex: paguei 850 de diesel, quanto tenho a pagar, meus últimos lançamentos."
          : "Olá. Pra usar o assistente do gerentia.app, primeiro vincule sua conta.\n\nNo app: Conta -> WhatsApp, gere um código de 6 dígitos e me envie aqui.",
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
      if (pending && pending.kind === "photo_input_date") {
        const parsed = await parseDateBR(text);
        if (!parsed.ok) {
          await sendText(from, `${parsed.reason}. Tenta de novo (ex: 25/03/26, ontem, dia 25) ou manda cancelar.`);
          return;
        }
        const ok = await savePhotoReceipt(admin, pending.data, parsed.date, linked);
        await clearPending(admin, from);
        if (!ok) { await sendText(from, "Nao consegui salvar."); return; }
        await sendText(from, ok);
        return;
      }
      // No meio de um wizard: na etapa de data, o texto digitado vira a data;
      // nas outras etapas, lembra de tocar nos botões.
      if (pending && pending.kind === "create_wizard" && linked) {
        const wiz = pending.data as WizState;
        const cur = wiz.steps[wiz.step];
        if (cur === "category") {
          const cats = await listVisibleCategories(admin, linked.organization_id, linked.user_id);
          const slug = snapCategory(text, cats, wiz.draft.direction);
          wiz.draft.category = slug;
          wiz.draft.category_name = cats.find((c) => c.slug === slug)?.name ?? slug;
          if (!wiz.draft.description) wiz.draft.description = text.trim().slice(0, 120);
          await advanceWizard(admin, linked, from, wiz);
          return;
        }
        if (cur === "vencimento") {
          const parsed = await parseDateBR(text);
          if (!parsed.ok) {
            await sendText(from, `${parsed.reason}. Tenta de novo (ex: amanhã, dia 30, 10/06) ou toque Sem vencimento.`);
            return;
          }
          wiz.draft.due_date = parsed.date;
          await advanceWizard(admin, linked, from, wiz);
          return;
        }
        if (cur === "origem") {
          wiz.draft.vendor = text.trim().slice(0, 80);
          await advanceWizard(admin, linked, from, wiz);
          return;
        }
        if (cur === "notes") {
          wiz.draft.notes = text.trim().slice(0, 500);
          await advanceWizard(admin, linked, from, wiz);
          return;
        }
        await sendText(from, "Toca numa das opções acima pra continuar (ou manda 'cancelar').");
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
    if (reply.wizard) await startCreateWizard(admin, linked, from, reply.wizard, 1, reply.wizard.length);
    else if (reply.text) await sendText(from, reply.text);
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

    await sendText(from, "Lendo o documento...");
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

    const e = ocr.data;
    const pendingData = {
      extracted: e,
      attachment_key: key,
      attachment_mime: mime,
      user_id: linked.user_id,
      organization_id: linked.organization_id,
      cost_center_id: defaultCC.id,
      cost_center_name: defaultCC.name,
    };
    const showCC = linked.cost_centers.length > 1;

    // Forma de pagamento não identificada numa DESPESA (não-fatura): pergunta
    // antes de confirmar. Ajuda a marcar cartão de crédito (anti-duplicidade
    // com a fatura). Se o OCR já soube, ou se for fatura/receita, vai direto.
    const needPay =
      e.direction !== "income" &&
      e.doc_type !== "fatura" &&
      (!e.payment_method || e.payment_method === "cartao");
    if (needPay) {
      await setPending(admin, from, "photo_payment_method", pendingData);
      await sendButtons(from, "Como foi pago? 💳", PHOTO_PAY_BUTTONS);
      return;
    }

    await setPending(admin, from, "receipt_confirm", pendingData);
    await sendButtons(
      from,
      receiptSummary(e, defaultCC.name, showCC),
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
    await sendText(from, "Ouvindo seu áudio...");
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
    await sendText(from, "Entendi: " + tr.transcript);
    const reply = await runFarmAi(admin, linked, tr.transcript, from);
    if (reply.wizard) await startCreateWizard(admin, linked, from, reply.wizard, 1, reply.wizard.length);
    else if (reply.text) await sendText(from, reply.text);
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
    // Lê o corpo CRU antes de parsear (HMAC precisa dos bytes exatos).
    const raw = await c.req.text();
    // Verifica a assinatura da Meta — FAIL-CLOSED: sem o App Secret configurado,
    // recusa (não processa payload não assinado). Evita forja de eventos.
    const appSecret = secret("WHATSAPP_GERENTIA_APP_SECRET");
    if (!appSecret) {
      console.error("[wa webhook] WHATSAPP_GERENTIA_APP_SECRET ausente — recusando (fail-closed).");
      return c.json({ error: "webhook_not_configured" }, 503);
    }
    const ok = await verifyMetaSignature(raw, c.req.header("x-hub-signature-256"), appSecret);
    if (!ok) {
      console.warn("[wa webhook] assinatura X-Hub-Signature-256 inválida — rejeitado");
      return c.json({ error: "bad_signature" }, 401);
    }
    // deno-lint-ignore no-explicit-any
    let body: any = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    if (!body?.entry) return c.json({ ok: true });
    const myPnid = secret("WHATSAPP_GERENTIA_BOT_PNID");
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
        const rl = checkRate(m.from);
        if (!rl.ok) {
          console.warn("[wa] rate limit atingido:", m.from);
          if (rl.notify) {
            try {
              await sendText(m.from, "Opa, recebi muitas mensagens de uma vez. Aguarda um instante e me manda de novo.");
            } catch { /* nunca trava */ }
          }
          continue;
        }
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
    // Fail-closed: exige segredo compartilhado (header). Sem GERENTIA_SALVY_SECRET
    // configurado, recusa — evita escrita não autenticada no banco.
    const salvySecret = secret("GERENTIA_SALVY_SECRET");
    if (!salvySecret || c.req.header("x-salvy-secret") !== salvySecret) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "invalid" }, 400);
    if (body.type === "sms.received") {
      console.log("[salvy-sms] recebido (type:", body.type, ")");
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
