import { type CostCenterRow } from "./cc.ts";
import {
  type CategoryRow,
  listVisibleCategories,
  snapCategory,
} from "./categories.ts";
import { buildFinanceAgentPrompt } from "../prompts/financeAgent.pt-br.ts";

const MODEL = "gemini-3.5-flash";
const HISTORY_MAX = 16;
const MAX_ITERS = 5;
const PAYMENT_METHODS = ["pix", "cartao_credito", "cartao_debito", "cartao", "boleto", "dinheiro", "transferencia"];

/** LinkedUser estendido com role + CCs permitidos (V2 — Centros de Custo). */
export interface LinkedUser {
  user_id: string;
  organization_id: string;
  user_name: string | null;
  role: "owner" | "admin" | "member";
  allowed_cost_center_ids: "all" | string[];
  cost_centers: CostCenterRow[];
}

interface HistTurn {
  role: "user" | "model";
  text: string;
}

// TZ-safe: usa Intl com timezone explicito. A prova de DST (se BR voltar a adotar).
export function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function shiftDateBR(days: number): string {
  const t = todayBR();
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function yesterdayBR(): string { return shiftDateBR(-1); }

function fmtBRL(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/** Formata ISO date pra dd/mm (mesmo ano) ou dd/mm/yy (anos diferentes). */
export function fmtDateBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const curY = todayBR().slice(0, 4);
  return y === curY ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function resolveCCFromList(input: string | undefined, ccs: CostCenterRow[]): CostCenterRow | null {
  if (!input) return null;
  const n = input.trim().toLowerCase();
  return ccs.find((c) =>
    c.id === input || c.slug.toLowerCase() === n || c.name.toLowerCase() === n
  ) || null;
}

function defaultCC(linked: LinkedUser): CostCenterRow | null {
  if (linked.cost_centers.length === 0) return null;
  return linked.cost_centers.find((c) => c.is_default) || linked.cost_centers[0];
}

function ccFilterIds(linked: LinkedUser): string[] | null {
  return linked.allowed_cost_center_ids === "all" ? null : linked.allowed_cost_center_ids;
}

function catName(slug: string | null, cats: CategoryRow[]): string {
  if (!slug) return "-";
  return cats.find((c) => c.slug === slug)?.name ?? slug;
}

/** Limites do mes (1-12). */
function monthBounds(year: number, month: number): { from: string; to: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${p(month)}-01`, to: `${year}-${p(month)}-${p(last)}` };
}

/** Resolve period dos args: this_month (default) | last_month | custom. */
// deno-lint-ignore no-explicit-any
function resolvePeriod(args: any): { from: string; to: string; label: string } {
  const t = todayBR();
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  const period = args?.period || "this_month";
  if (period === "custom" && typeof args?.from === "string" && typeof args?.to === "string") {
    return { from: args.from, to: args.to, label: `${fmtDateBR(args.from)}–${fmtDateBR(args.to)}` };
  }
  if (period === "last_month") {
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return { ...monthBounds(py, pm), label: `${MESES_PT[pm - 1]} de ${py}` };
  }
  return { ...monthBounds(y, m), label: `${MESES_PT[m - 1]} de ${y}` };
}

// ---------- contexto de execução ----------

/** Rascunho de criação. Campos null em status/cost_center/transaction_date =
 *  "perguntar no wizard". O fluxo guiado (handlers/whatsapp.ts) preenche e salva. */
export interface WizardDraft {
  total_value: number;
  direction: "expense" | "income";
  category: string | null; // null = perguntar "do que se trata?"
  category_name: string;
  vendor: string | null;
  description: string | null;
  payment_method: string | null;
  cost_center_id: string | null;
  transaction_date: string | null;
  status: string | null;
  due_date: string | null;
  notes: string | null;
}

export interface ToolCtx {
  // deno-lint-ignore no-explicit-any
  admin: any;
  linked: LinkedUser;
  from: string;
  categories: CategoryRow[];
  lastReceiptId: string | null;
  wizardDrafts: WizardDraft[]; // criações a guiar por etapas
}

export interface AgentResult {
  text: string;
  wizard: WizardDraft[] | null; // != null => inicia o wizard de criação
}

type ToolResult = Record<string, unknown>;

// ---------- ferramentas (retornam JSON; o modelo compõe a resposta) ----------

/**
 * NÃO insere: monta um RASCUNHO e enfileira pro wizard guiado (status → centro
 * → data → confirmar) em handlers/whatsapp.ts. Campos que o usuário deixou
 * claros já vêm preenchidos (e o wizard pula a etapa); o resto fica null.
 */
// deno-lint-ignore no-explicit-any
async function execCreateReceipt(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { linked } = ctx;
  const total = Number(args.total_value);
  if (!Number.isFinite(total) || total <= 0) return { error: "missing_value" };
  const direction = args.direction === "income" ? "income" : "expense";
  // Sem NENHUMA pista do que é (categoria, fornecedor ou descrição) => null,
  // pra o wizard perguntar "do que se trata?" em vez de cair em "Outros".
  const gaveInfo = !!args.category ||
    (typeof args.vendor === "string" && !!args.vendor.trim()) ||
    (typeof args.description === "string" && !!args.description.trim());
  const category = gaveInfo ? snapCategory(args.category, ctx.categories, direction) : null;

  // Centro: resolve se citado; auto se único; senão null (perguntar).
  let ccId: string | null = null;
  if (args.cost_center) {
    const cc = resolveCCFromList(args.cost_center, linked.cost_centers);
    if (!cc) return { error: "unknown_cost_center", options: linked.cost_centers.map((c) => c.name) };
    ccId = cc.id;
  } else if (linked.cost_centers.length === 1) {
    ccId = linked.cost_centers[0].id;
  } else if (linked.cost_centers.length === 0) {
    return { error: "no_cost_center" };
  }

  // Status só se veio claro; senão null (perguntar).
  let status: string | null = null;
  if (typeof args.status === "string" && ["a_pagar", "pago", "a_receber", "recebido"].includes(args.status)) {
    const paid = args.status === "pago" || args.status === "recebido";
    status = paid ? (direction === "income" ? "recebido" : "pago") : (direction === "income" ? "a_receber" : "a_pagar");
  }

  const payment_method = typeof args.payment_method === "string" && PAYMENT_METHODS.includes(args.payment_method)
    ? args.payment_method : null;

  ctx.wizardDrafts.push({
    total_value: total,
    direction,
    category,
    category_name: category ? catName(category, ctx.categories) : "",
    vendor: typeof args.vendor === "string" ? args.vendor : null,
    description: typeof args.description === "string" ? args.description : null,
    payment_method,
    cost_center_id: ccId,
    transaction_date: (typeof args.transaction_date === "string" && args.transaction_date) ? args.transaction_date : null,
    status,
    due_date: (typeof args.due_date === "string" && args.due_date) ? args.due_date : null,
    notes: null,
  });
  return { drafted: true };
}

/** Carrega um receipt do escopo (org + CCs permitidos). */
async function loadScopedReceipt(ctx: ToolCtx, id: string): Promise<
  // deno-lint-ignore no-explicit-any
  any | null
> {
  const { admin, linked } = ctx;
  const { data: row } = await admin
    .from("farm_receipts")
    .select("id, direction, status, total_value, category, cost_center_id, vendor, description, payment_method, transaction_date, due_date, paid_date")
    .eq("id", id)
    .eq("organization_id", linked.organization_id)
    .maybeSingle();
  if (!row) return null;
  const allowed = ccFilterIds(linked);
  if (allowed && row.cost_center_id && !allowed.includes(row.cost_center_id)) return null;
  return row;
}

// deno-lint-ignore no-explicit-any
async function execUpdateReceipt(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin } = ctx;
  const id = (typeof args.receipt_id === "string" && args.receipt_id) || ctx.lastReceiptId;
  if (!id) return { error: "no_reference" };
  const row = await loadScopedReceipt(ctx, id);
  if (!row) return { error: "not_found" };

  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = {};
  const changed: string[] = [];

  if (args.total_value !== undefined) {
    const v = Number(args.total_value);
    if (Number.isFinite(v) && v > 0) {
      patch.total_value = v;
      patch.is_estimated = false; // editar valor confirma um previsto
      changed.push("valor");
    }
  }
  if (typeof args.category === "string") {
    patch.category = snapCategory(args.category, ctx.categories, row.direction);
    changed.push("categoria");
  }
  if (typeof args.cost_center === "string") {
    const cc = resolveCCFromList(args.cost_center, ctx.linked.cost_centers);
    if (!cc) return { error: "unknown_cost_center", options: ctx.linked.cost_centers.map((c) => c.name) };
    patch.cost_center_id = cc.id;
    changed.push("centro");
  }
  if (typeof args.vendor === "string") { patch.vendor = args.vendor; changed.push("origem"); }
  if (typeof args.description === "string") { patch.description = args.description; changed.push("descrição"); }
  if (typeof args.payment_method === "string" && PAYMENT_METHODS.includes(args.payment_method)) {
    patch.payment_method = args.payment_method; changed.push("pagamento");
  }
  if (typeof args.transaction_date === "string" && args.transaction_date) {
    patch.transaction_date = args.transaction_date; changed.push("data");
  }
  if (typeof args.due_date === "string" && args.due_date) {
    patch.due_date = args.due_date; changed.push("vencimento");
  }
  if (typeof args.status === "string") {
    if (args.status === "cancelado") {
      patch.status = "cancelado"; patch.paid_date = null; changed.push("status");
    } else if (["a_pagar", "pago", "a_receber", "recebido"].includes(args.status)) {
      const paid = args.status === "pago" || args.status === "recebido";
      patch.status = paid
        ? (row.direction === "income" ? "recebido" : "pago")
        : (row.direction === "income" ? "a_receber" : "a_pagar");
      patch.paid_date = paid ? (row.transaction_date || todayBR()) : null;
      changed.push("status");
    }
  }

  if (Object.keys(patch).length === 0) return { error: "nothing_to_change" };

  const { data: upd, error } = await admin
    .from("farm_receipts").update(patch).eq("id", id).select("id, total_value, category, status, payment_method, transaction_date, due_date").single();
  if (error || !upd) { console.error("[farmAi] update error:", error); return { error: "update_failed" }; }
  ctx.lastReceiptId = id;
  return {
    updated: true,
    id,
    changed,
    total_value: upd.total_value,
    category: upd.category,
    category_name: catName(upd.category, ctx.categories),
    status: upd.status,
    payment_method: upd.payment_method,
    date: upd.transaction_date,
    due_date: upd.due_date,
  };
}

// deno-lint-ignore no-explicit-any
async function execCancelReceipt(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin } = ctx;
  const id = (typeof args.receipt_id === "string" && args.receipt_id) || ctx.lastReceiptId;
  if (!id) return { error: "no_reference" };
  const row = await loadScopedReceipt(ctx, id);
  if (!row) return { error: "not_found" };
  const { error } = await admin
    .from("farm_receipts").update({ status: "cancelado", paid_date: null }).eq("id", id);
  if (error) { console.error("[farmAi] cancel error:", error); return { error: "cancel_failed" }; }
  ctx.lastReceiptId = null;
  return {
    canceled: true,
    id,
    total_value: row.total_value,
    vendor: row.vendor,
    category: row.category,
  };
}

/** Update efetivo do mark-paid. Reusado pelo handler numerico (pay_select). */
// deno-lint-ignore no-explicit-any
async function doMarkPaid(admin: any, row: any): Promise<{ ok: boolean; newStatus: string }> {
  const newStatus = row.direction === "income" ? "recebido" : "pago";
  const { error } = await admin
    .from("farm_receipts").update({ status: newStatus, paid_date: todayBR() }).eq("id", row.id);
  if (error) { console.error("[farmAi] mark_paid update error:", error); return { ok: false, newStatus }; }
  return { ok: true, newStatus };
}

/** Versão string (usada pelo handler numérico em whatsapp.ts). */
// deno-lint-ignore no-explicit-any
export async function applyMarkPaid(admin: any, row: any): Promise<string> {
  const r = await doMarkPaid(admin, row);
  if (!r.ok) return "Nao consegui atualizar a conta. Tenta de novo em instantes.";
  const verb = row.direction === "income" ? "Recebido" : "Pago";
  const who = row.vendor || row.description || row.category || "lancamento";
  return `✅ ${verb}: ${fmtBRL(Number(row.total_value))} - ${who}.`;
}

// deno-lint-ignore no-explicit-any
async function execMarkPaid(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin, linked, from } = ctx;
  const query = String(args.query || "").trim();
  if (!query) return { error: "missing_query" };

  let q = admin
    .from("farm_receipts")
    .select("id, direction, vendor, description, category, total_value, transaction_date, due_date, status, cost_center_id")
    .eq("organization_id", linked.organization_id)
    .in("status", ["a_pagar", "a_receber", "vencido"])
    // Não dá pra "pagar" um PREVISTO (projeção de recorrência ainda não
    // confirmada) — senão corrompe a fila de projeção.
    .eq("is_estimated", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("transaction_date", { ascending: false })
    .limit(50);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  const { data, error } = await q;
  if (error) { console.error("[farmAi] mark_paid query:", error); return { error: "query_failed" }; }
  if (!data || data.length === 0) return { matched: 0, none_open: true };

  const needle = query.toLowerCase();
  // deno-lint-ignore no-explicit-any
  let matches = (data as any[]).filter((r) =>
    (r.vendor || "").toLowerCase().includes(needle) ||
    (r.description || "").toLowerCase().includes(needle) ||
    (r.category || "").toLowerCase().includes(needle)
  );
  const amount = Number(args.amount);
  if (Number.isFinite(amount) && amount > 0 && matches.length > 1) {
    const tol = amount * 0.05;
    const tight = matches.filter((r) => Math.abs(Number(r.total_value) - amount) <= tol);
    if (tight.length > 0) matches = tight;
  }

  if (matches.length === 0) return { matched: 0, query };
  if (matches.length === 1) {
    const m = matches[0];
    const r = await doMarkPaid(admin, m);
    if (!r.ok) return { error: "update_failed" };
    ctx.lastReceiptId = m.id;
    return {
      marked: true,
      id: m.id,
      vendor: m.vendor || m.description || m.category,
      total_value: m.total_value,
      status: r.newStatus,
    };
  }

  // Múltiplas: grava pay_select (handler numérico em whatsapp.ts resolve "1","2"…).
  const top = matches.slice(0, 9);
  await admin.from("farm_wa_pending").upsert({
    phone_number: from,
    kind: "pay_select",
    data: { ids: top.map((r) => r.id) },
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  return {
    ambiguous: true,
    options: top.map((r, i) => ({
      n: i + 1,
      vendor: r.vendor || r.description || r.category,
      total_value: r.total_value,
      date: r.due_date || r.transaction_date,
    })),
  };
}

// ---------- reconciliação de comprovante (usada pelo fluxo de FOTO) ----------

/** Candidato a conta em aberto que um comprovante pode quitar. */
export interface ReconcileCandidate {
  id: string;
  direction: "expense" | "income";
  vendor: string | null;
  description: string | null;
  category: string | null;
  vendor_cnpj: string | null;
  total_value: number;
  due_date: string | null;
  transaction_date: string | null;
  status: string;
  is_estimated: boolean;
  attachment_key: string | null;
  score: number;
}

/**
 * Acha contas EM ABERTO do escopo (org + CCs) que "parecem" ser quitadas por
 * este comprovante. Exige identidade (CNPJ ou fornecedor) — valor sozinho não
 * cria candidato (juros/desconto divergem; e valor redondo casa demais). Inclui
 * previstos de recorrência (is_estimated), mas só do MÊS do comprovante, pra não
 * despejar as ~12 projeções quase idênticas. Nunca quita sozinho: o handler
 * sempre confirma por toque.
 */
export async function findReconcileCandidates(
  // deno-lint-ignore no-explicit-any
  admin: any,
  linked: LinkedUser,
  ocr: {
    vendor: string | null;
    vendor_cnpj: string | null;
    total_value: number | null;
    transaction_date: string | null;
    direction: "expense" | "income";
  },
): Promise<ReconcileCandidate[]> {
  const cnpjDigits = typeof ocr.vendor_cnpj === "string" ? ocr.vendor_cnpj.replace(/\D/g, "") : "";
  const hasCnpj = cnpjDigits.length >= 11;
  const vLower = typeof ocr.vendor === "string" ? ocr.vendor.trim().toLowerCase() : "";
  const hasVendor = vLower.length >= 3;
  const value = Number.isFinite(Number(ocr.total_value)) && Number(ocr.total_value) > 0 ? Number(ocr.total_value) : null;
  // Sem identidade não dá pra casar com segurança.
  if (!hasCnpj && !hasVendor) return [];

  const openStatuses = ocr.direction === "income" ? ["a_receber", "vencido"] : ["a_pagar", "vencido"];
  let q = admin
    .from("farm_receipts")
    .select("id, direction, vendor, description, category, vendor_cnpj, total_value, transaction_date, due_date, status, is_estimated, attachment_key, cost_center_id")
    .eq("organization_id", linked.organization_id)
    .eq("direction", ocr.direction)
    .in("status", openStatuses)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(80);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  const { data, error } = await q;
  if (error) { console.error("[farmAi] reconcile query:", error); return []; }
  if (!data || data.length === 0) return [];

  const refMonth = typeof ocr.transaction_date === "string" && ocr.transaction_date ? ocr.transaction_date.slice(0, 7) : null;
  const scored: ReconcileCandidate[] = [];
  // deno-lint-ignore no-explicit-any
  for (const r of data as any[]) {
    // Previsto (recorrência): só do mês do comprovante (senão descarta).
    if (r.is_estimated) {
      const rMonth = String(r.due_date || r.transaction_date || "").slice(0, 7);
      if (!refMonth || rMonth !== refMonth) continue;
    }
    // Identidade: CNPJ (ouro) ou fornecedor (substring bidirecional).
    let idScore = 0;
    const rCnpj = typeof r.vendor_cnpj === "string" ? r.vendor_cnpj.replace(/\D/g, "") : "";
    if (hasCnpj && rCnpj && rCnpj === cnpjDigits) idScore += 100;
    if (hasVendor) {
      const rv = (r.vendor || "").toLowerCase();
      if (rv && (rv.includes(vLower) || vLower.includes(rv))) idScore += 40;
    }
    if (idScore === 0) continue; // sem identidade, ignora
    // Valor: só bônus de ranqueamento.
    let score = idScore;
    if (value !== null) {
      const rv = Number(r.total_value) || 0;
      const diff = rv > 0 ? Math.abs(rv - value) / rv : 1;
      if (diff <= 0.01) score += 30;
      else if (diff <= 0.05) score += 20;
      else if (diff <= 0.15) score += 10;
    }
    if (r.is_estimated) score += 15; // previsto do mês tende a ser o alvo certo
    scored.push({
      id: r.id,
      direction: r.direction,
      vendor: r.vendor ?? null,
      description: r.description ?? null,
      category: r.category ?? null,
      vendor_cnpj: r.vendor_cnpj ?? null,
      total_value: Number(r.total_value),
      due_date: r.due_date ?? null,
      transaction_date: r.transaction_date ?? null,
      status: r.status,
      is_estimated: !!r.is_estimated,
      attachment_key: r.attachment_key ?? null,
      score,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

/**
 * Dá baixa numa conta existente usando um comprovante (foto/PDF). Re-valida a
 * linha (org + CC), protege de corrida (já paga), seta pago/recebido +
 * paid_date + is_estimated=false (confirma o previsto, imune a resync/cleanup),
 * anexa o comprovante só se o slot estiver vazio (senão preserva o boleto e
 * guarda a chave no ai_raw). Se a conta era prevista, adota o valor real do OCR.
 */
export async function settleReceiptWithReceipt(
  // deno-lint-ignore no-explicit-any
  admin: any,
  linked: LinkedUser,
  candidateId: string,
  ocr: { total_value: number | null; payment_method: string | null; transaction_date: string | null },
  attachment: { key: string | null; mime: string | null },
  // deno-lint-ignore no-explicit-any
): Promise<{ ok: boolean; alreadyPaid?: boolean; gone?: boolean; row?: any; message: string }> {
  const { data: row } = await admin
    .from("farm_receipts")
    .select("id, direction, status, total_value, vendor, description, category, cost_center_id, is_estimated, attachment_key, attachment_mime, ai_raw")
    .eq("id", candidateId)
    .eq("organization_id", linked.organization_id)
    .maybeSingle();
  const goneMsg = "Essa conta sumiu — talvez tenha sido apagada. Tenta de novo.";
  if (!row) return { ok: false, gone: true, message: goneMsg };
  const allowed = ccFilterIds(linked);
  if (allowed && row.cost_center_id && !allowed.includes(row.cost_center_id)) {
    return { ok: false, gone: true, message: goneMsg };
  }
  if (row.status === "pago" || row.status === "recebido") {
    return { ok: false, alreadyPaid: true, row, message: "Essa conta já estava como " + row.status + ". 😉" };
  }

  const newStatus = row.direction === "income" ? "recebido" : "pago";
  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = {
    status: newStatus,
    paid_date: ocr.transaction_date || todayBR(),
    is_estimated: false,
  };
  if (typeof ocr.payment_method === "string" && ocr.payment_method) patch.payment_method = ocr.payment_method;
  // Previsto tem valor placeholder → adota o valor real do comprovante.
  if (row.is_estimated && Number.isFinite(Number(ocr.total_value)) && Number(ocr.total_value) > 0) {
    patch.total_value = Number(ocr.total_value);
  }
  // Anexo: só ocupa o slot se estiver vazio; senão preserva o original e guarda
  // a chave do comprovante no ai_raw (auditoria, sem perda no R2).
  let attached = false;
  if (attachment.key) {
    if (!row.attachment_key) {
      patch.attachment_key = attachment.key;
      patch.attachment_mime = attachment.mime;
      attached = true;
    } else {
      const rawBase = (row.ai_raw && typeof row.ai_raw === "object") ? row.ai_raw : {};
      patch.ai_raw = { ...rawBase, settlement_attachment_key: attachment.key, settlement_attachment_mime: attachment.mime };
    }
  }

  const { error } = await admin.from("farm_receipts").update(patch).eq("id", row.id);
  if (error) {
    console.error("[farmAi] settle update error:", error);
    return { ok: false, message: "Não consegui dar baixa na conta. Tenta de novo em instantes." };
  }
  const verb = newStatus === "recebido" ? "recebido" : "pago";
  const who = row.vendor || row.description || row.category || "lançamento";
  const finalValue = patch.total_value ?? Number(row.total_value);
  const attachTail = attached ? " e anexei o comprovante" : "";
  return {
    ok: true,
    row,
    message: `✅ Baixa dada: ${fmtBRL(Number(finalValue))} — ${who}. Marquei como ${verb}${attachTail}.`,
  };
}

// deno-lint-ignore no-explicit-any
async function execSummary(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin, linked } = ctx;
  const { from, to, label } = resolvePeriod(args);
  const includeProj = !!args.include_projected;

  let q = admin
    .from("farm_receipts")
    .select("direction, status, total_value, transaction_date, is_estimated")
    .eq("organization_id", linked.organization_id)
    .limit(3000);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  const { data, error } = await q;
  if (error) { console.error("[farmAi] summary:", error); return { error: "query_failed" }; }

  let entradas = 0, saidas = 0, aPagar = 0, aReceber = 0, vencido = 0, prevEnt = 0, prevSai = 0;
  for (const r of data || []) {
    const v = Number(r.total_value) || 0;
    const td = r.transaction_date ? String(r.transaction_date) : "";
    const inRange = td >= from && td <= to;
    if (r.is_estimated) {
      if (inRange) { if (r.direction === "income") prevEnt += v; else prevSai += v; }
      continue;
    }
    if (r.status === "cancelado") continue;
    if (inRange) { if (r.direction === "income") entradas += v; else saidas += v; }
    if (r.status === "a_pagar") aPagar += v;
    else if (r.status === "a_receber") aReceber += v;
    else if (r.status === "vencido") vencido += v;
  }
  const result: ToolResult = {
    period: { from, to, label },
    realizado: { entradas, saidas, saldo: entradas - saidas },
    pendencias: { a_pagar: aPagar, a_receber: aReceber, vencido },
  };
  if (includeProj) {
    result.previsto = {
      saidas: prevSai,
      entradas: prevEnt,
      total_saidas_esperado: saidas + prevSai,
    };
  }
  return result;
}

// deno-lint-ignore no-explicit-any
async function execSpendByCategory(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin, linked } = ctx;
  const { from, to, label } = resolvePeriod(args);
  const direction = args.direction === "income" ? "income" : "expense";
  const includeProj = !!args.include_projected;

  let q = admin
    .from("farm_receipts")
    .select("category, total_value, status, is_estimated")
    .eq("organization_id", linked.organization_id)
    .eq("direction", direction)
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .limit(3000);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  const { data, error } = await q;
  if (error) { console.error("[farmAi] spend_by_cat:", error); return { error: "query_failed" }; }

  const fallback = direction === "income" ? "outros_receita" : "outros_despesa";
  const filterSlug = typeof args.category === "string"
    ? snapCategory(args.category, ctx.categories, direction)
    : null;
  const byCat: Record<string, number> = {};
  let total = 0;
  for (const r of data || []) {
    if (r.status === "cancelado") continue;
    if (r.is_estimated && !includeProj) continue;
    const slug = r.category || fallback;
    if (filterSlug && slug !== filterSlug) continue;
    const v = Number(r.total_value) || 0;
    byCat[slug] = (byCat[slug] || 0) + v;
    total += v;
  }
  const by_category = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([slug, t]) => ({ slug, name: catName(slug, ctx.categories), total: t }));
  return { period: { from, to, label }, direction, total, by_category };
}

// deno-lint-ignore no-explicit-any
async function execComparePeriods(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin, linked } = ctx;
  const t = todayBR();
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  const thisB = monthBounds(y, m);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const lastB = monthBounds(py, pm);
  const dirFilter = args.direction === "income" || args.direction === "expense" ? args.direction : null;

  let q = admin
    .from("farm_receipts")
    .select("direction, status, total_value, transaction_date, is_estimated")
    .eq("organization_id", linked.organization_id)
    .gte("transaction_date", lastB.from)
    .lte("transaction_date", thisB.to)
    .limit(4000);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  const { data, error } = await q;
  if (error) { console.error("[farmAi] compare:", error); return { error: "query_failed" }; }

  const agg = (from: string, to: string) => {
    let entradas = 0, saidas = 0;
    for (const r of data || []) {
      if (r.is_estimated || r.status === "cancelado") continue;
      if (dirFilter && r.direction !== dirFilter) continue;
      const td = String(r.transaction_date || "");
      if (td < from || td > to) continue;
      const v = Number(r.total_value) || 0;
      if (r.direction === "income") entradas += v; else saidas += v;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  };
  const cur = agg(thisB.from, thisB.to);
  const prev = agg(lastB.from, lastB.to);
  const pct = prev.saldo !== 0
    ? Math.round(((cur.saldo - prev.saldo) / Math.abs(prev.saldo)) * 100)
    : null;
  return {
    this: { label: `${MESES_PT[m - 1]}`, ...cur },
    last: { label: `${MESES_PT[pm - 1]}`, ...prev },
    delta: { entradas: cur.entradas - prev.entradas, saidas: cur.saidas - prev.saidas, saldo: cur.saldo - prev.saldo, pct },
  };
}

// deno-lint-ignore no-explicit-any
async function execListReceipts(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin, linked } = ctx;
  const days = Number.isFinite(Number(args.days)) ? Number(args.days) : 30;
  const since = shiftDateBR(-Math.abs(days));
  let q = admin
    .from("farm_receipts")
    .select("direction, total_value, category, vendor, transaction_date, status, cost_center_id")
    .eq("organization_id", linked.organization_id)
    .gte("transaction_date", since)
    .order("transaction_date", { ascending: false })
    .limit(10);
  if (args.direction) q = q.eq("direction", args.direction);
  if (typeof args.category === "string") q = q.eq("category", snapCategory(args.category, ctx.categories, args.direction === "income" ? "income" : "expense"));
  if (args.status) q = q.eq("status", args.status);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  if (typeof args.cost_center === "string") {
    const cc = resolveCCFromList(args.cost_center, linked.cost_centers);
    if (!cc) return { error: "unknown_cost_center", options: linked.cost_centers.map((c) => c.name) };
    q = q.eq("cost_center_id", cc.id);
  }
  const { data, error } = await q;
  if (error) { console.error("[farmAi] list:", error); return { error: "query_failed" }; }
  const showCC = linked.cost_centers.length > 1;
  const ccMap = new Map(linked.cost_centers.map((c) => [c.id, c.name]));
  // deno-lint-ignore no-explicit-any
  const receipts = (data || []).map((r: any) => ({
    date: r.transaction_date,
    direction: r.direction,
    total_value: Number(r.total_value),
    category: r.category,
    category_name: catName(r.category, ctx.categories),
    vendor: r.vendor,
    status: r.status,
    cost_center: showCC && r.cost_center_id ? ccMap.get(r.cost_center_id) ?? null : null,
  }));
  return { count: receipts.length, receipts };
}

function execListMyCostCenters(ctx: ToolCtx): ToolResult {
  return {
    cost_centers: ctx.linked.cost_centers.map((c) => ({ name: c.name, is_default: !!c.is_default })),
  };
}

// ---------- lembretes / pendências (escopo financeiro) ----------

/** Cria um lembrete. Insere direto — sem wizard (só title é obrigatório). */
// deno-lint-ignore no-explicit-any
async function execCreateTask(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin, linked } = ctx;
  // Uppercase igual aos lançamentos (convenção do app: grava e exibe em
  // maiúsculas). Sem isso, lembrete criado por "anota: X" fica minúsculo no banco
  // e no eco do bot, destoando das criadas pelo app.
  const title = String(args.title || "").trim().slice(0, 120).toUpperCase();
  if (!title) return { error: "missing_title" };
  const due_date = typeof args.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.due_date)
    ? args.due_date
    : null;
  // Valor e' OPCIONAL: o lembrete nasce de um "anota: X" onde o usuario muitas
  // vezes ainda nao sabe quanto e'.
  const v = Number(args.total_value);
  const total_value = Number.isFinite(v) && v > 0 ? v : null;
  const { data, error } = await admin
    .from("farm_tasks")
    .insert({
      organization_id: linked.organization_id,
      created_by: linked.user_id,
      title,
      due_date,
      total_value,
    })
    .select("id, title, due_date, total_value")
    .single();
  if (error || !data) { console.error("[farmAi] create_task:", error); return { error: "create_failed" }; }
  return {
    created: true,
    id: data.id,
    title: data.title,
    due_date: data.due_date,
    total_value: data.total_value,
  };
}

/** Lista os lembretes do usuário (default: só os em aberto). */
// deno-lint-ignore no-explicit-any
async function execListTasks(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin, linked } = ctx;
  const onlyOpen = args.only_open !== false;
  let q = admin
    .from("farm_tasks")
    .select("title, due_date, done, priority, total_value")
    .eq("organization_id", linked.organization_id)
    .eq("created_by", linked.user_id)
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (onlyOpen) q = q.eq("done", false);
  const { data, error } = await q;
  if (error) { console.error("[farmAi] list_tasks:", error); return { error: "query_failed" }; }
  // deno-lint-ignore no-explicit-any
  const tasks = (data || []).map((t: any) => ({
    title: t.title,
    due_date: t.due_date,
    done: t.done,
    priority: t.priority,
    total_value: t.total_value,
  }));
  return { count: tasks.length, tasks };
}

/** Resolve um lembrete por match de título. Espelha execMarkPaid (desambiguação). */
// deno-lint-ignore no-explicit-any
async function execCompleteTask(args: any, ctx: ToolCtx): Promise<ToolResult> {
  const { admin, linked, from } = ctx;
  const query = String(args.query || "").trim();
  if (!query) return { error: "missing_query" };

  const { data, error } = await admin
    .from("farm_tasks")
    .select("id, title, due_date")
    .eq("organization_id", linked.organization_id)
    .eq("created_by", linked.user_id)
    .eq("done", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);
  if (error) { console.error("[farmAi] complete_task query:", error); return { error: "query_failed" }; }
  if (!data || data.length === 0) return { matched: 0, none_open: true };

  const needle = query.toLowerCase();
  // deno-lint-ignore no-explicit-any
  const matches = (data as any[]).filter((t) => (t.title || "").toLowerCase().includes(needle));
  if (matches.length === 0) return { matched: 0, query };
  if (matches.length === 1) {
    const m = matches[0];
    const { error: upErr } = await admin.from("farm_tasks").update({ done: true }).eq("id", m.id);
    if (upErr) { console.error("[farmAi] complete_task update:", upErr); return { error: "update_failed" }; }
    return { completed: true, id: m.id, title: m.title };
  }

  // Várias: grava task_select (handler numérico em whatsapp.ts resolve "1","2"…).
  const top = matches.slice(0, 9);
  await admin.from("farm_wa_pending").upsert({
    phone_number: from,
    kind: "task_select",
    data: { ids: top.map((t) => t.id) },
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  return {
    ambiguous: true,
    options: top.map((t, i) => ({ n: i + 1, title: t.title, due_date: t.due_date })),
  };
}

// ---------- declarações + dispatch ----------

function toolDeclarations() {
  const statusEnum = ["a_pagar", "pago", "a_receber", "recebido"];
  return [{
    functionDeclarations: [
      {
        name: "create_receipt",
        description: "Registra um lançamento (despesa/receita). Salva na hora; infira defaults e depois revele o que foi assumido.",
        parameters: {
          type: "object",
          properties: {
            total_value: { type: "number" },
            direction: { type: "string", enum: ["expense", "income"] },
            category: { type: "string", description: "slug da categoria (ex: combustivel, venda_graos)" },
            cost_center: { type: "string", description: "slug ou nome do centro; omita pra usar o padrão" },
            vendor: { type: "string", description: "Origem: de quem/pra quem (nome do pagador ou recebedor), se citado" },
            description: { type: "string" },
            payment_method: { type: "string", enum: PAYMENT_METHODS },
            transaction_date: { type: "string", description: "YYYY-MM-DD; omita = hoje" },
            status: { type: "string", enum: statusEnum, description: "pago/recebido se já quitado; a_pagar/a_receber se em aberto" },
            due_date: { type: "string", description: "YYYY-MM-DD do vencimento, quando a prazo" },
          },
          required: ["total_value", "direction"],
        },
      },
      {
        name: "update_receipt",
        description: "Corrige um lançamento existente. Sem receipt_id, age sobre o ÚLTIMO. Use pra 'era 550 não 500', 'foi no cartão', 'na verdade é defensivo', 'já paguei esse'.",
        parameters: {
          type: "object",
          properties: {
            receipt_id: { type: "string" },
            total_value: { type: "number" },
            category: { type: "string" },
            cost_center: { type: "string" },
            vendor: { type: "string" },
            description: { type: "string" },
            payment_method: { type: "string", enum: PAYMENT_METHODS },
            transaction_date: { type: "string" },
            due_date: { type: "string" },
            status: { type: "string", enum: [...statusEnum, "cancelado"] },
          },
        },
      },
      {
        name: "cancel_receipt",
        description: "Cancela um lançamento (vira 'cancelado'). Sem receipt_id, cancela o ÚLTIMO. Use pra 'apaga isso', 'cancela', 'tira esse'.",
        parameters: { type: "object", properties: { receipt_id: { type: "string" } } },
      },
      {
        name: "mark_receipt_paid",
        description: "Marca uma conta JÁ EXISTENTE como paga/recebida (sem valor novo). Ex: 'paguei o boleto da Cemig', 'recebi do fulano'.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "origem/categoria/descrição da conta" },
            amount: { type: "number", description: "valor aprox., pra desambiguar" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_financial_summary",
        description: "Resumo do período: entradas/saídas/saldo + pendências (a pagar/receber/vencido). include_projected soma os lançamentos PREVISTOS das recorrências (pra 'quanto vou gastar esse mês').",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["this_month", "last_month", "custom"] },
            from: { type: "string", description: "YYYY-MM-DD (period=custom)" },
            to: { type: "string", description: "YYYY-MM-DD (period=custom)" },
            include_projected: { type: "boolean" },
          },
        },
      },
      {
        name: "spend_by_category",
        description: "Total por categoria num período. Use pra 'quanto gastei com combustível', 'onde mais gastei'.",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["this_month", "last_month", "custom"] },
            from: { type: "string" },
            to: { type: "string" },
            direction: { type: "string", enum: ["expense", "income"] },
            category: { type: "string", description: "filtra uma categoria específica" },
            include_projected: { type: "boolean" },
          },
        },
      },
      {
        name: "compare_periods",
        description: "Compara o mês atual com o anterior (entradas/saídas/saldo). Use pra 'gastei mais que mês passado?'.",
        parameters: {
          type: "object",
          properties: { direction: { type: "string", enum: ["expense", "income"] } },
        },
      },
      {
        name: "list_receipts",
        description: "Lista lançamentos recentes (até 10).",
        parameters: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["expense", "income"] },
            category: { type: "string" },
            status: { type: "string", enum: ["a_pagar", "pago", "a_receber", "recebido", "vencido", "cancelado"] },
            cost_center: { type: "string" },
            days: { type: "number", description: "últimos N dias (default 30)" },
          },
        },
      },
      {
        name: "list_my_cost_centers",
        description: "Lista os centros de custo do usuário.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "create_task",
        description: "Cria um LEMBRETE: compromisso financeiro que o usuário AINDA VAI resolver e que ainda não virou lançamento. Use pra 'anota X', 'me lembra de Y', 'preciso pagar Z'. Ex: 'me lembra dia 30 de pagar o contador 800'. NÃO use se o dinheiro já saiu/entrou (isso é create_receipt).",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "o que resolver (curto)" },
            due_date: { type: "string", description: "YYYY-MM-DD, só se o usuário citar quando ('amanhã', 'dia 30'); senão omita" },
            total_value: { type: "number", description: "valor em reais, só se o usuário citar; senão omita" },
          },
          required: ["title"],
        },
      },
      {
        name: "list_tasks",
        description: "Lista os lembretes/pendências do usuário. Use pra 'o que tenho pra resolver', 'minhas pendências', 'meus lembretes'.",
        parameters: {
          type: "object",
          properties: {
            only_open: { type: "boolean", description: "true (default) = só as não concluídas" },
          },
        },
      },
      {
        name: "complete_task",
        description: "Marca um LEMBRETE como resolvido. Use pra 'já resolvi X', 'já paguei aquele lembrete do Y'. NÃO é pra contas já lançadas (isso é mark_receipt_paid).",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "trecho do título do lembrete" },
          },
          required: ["query"],
        },
      },
    ],
  }];
}

// deno-lint-ignore no-explicit-any
async function execTool(name: string, args: any, ctx: ToolCtx): Promise<ToolResult> {
  switch (name) {
    case "create_receipt": return await execCreateReceipt(args, ctx);
    case "update_receipt": return await execUpdateReceipt(args, ctx);
    case "cancel_receipt": return await execCancelReceipt(args, ctx);
    case "mark_receipt_paid": return await execMarkPaid(args, ctx);
    case "get_financial_summary": return await execSummary(args, ctx);
    case "spend_by_category": return await execSpendByCategory(args, ctx);
    case "compare_periods": return await execComparePeriods(args, ctx);
    case "list_receipts": return await execListReceipts(args, ctx);
    case "list_my_cost_centers": return execListMyCostCenters(ctx);
    case "create_task": return await execCreateTask(args, ctx);
    case "list_tasks": return await execListTasks(args, ctx);
    case "complete_task": return await execCompleteTask(args, ctx);
    default: return { error: "unknown_tool" };
  }
}

// ---------- parser de data (usado pelo fluxo de FOTO em whatsapp.ts) ----------

/**
 * Parser de data em linguagem natural PT-BR via Gemini. "hoje" como referencia.
 */
export async function parseDateBR(text: string): Promise<{ ok: true; date: string } | { ok: false; reason: string }> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return { ok: false, reason: "ia indisponivel" };
  const today = todayBR();
  const prompt = `Voce e um parser de data em portugues brasileiro. Hoje e ${today}.\n\nTexto do usuario: "${text}"\n\nRegras:\n- "hoje" -> hoje\n- "ontem" -> hoje-1\n- "anteontem" -> hoje-2\n- "amanha" -> hoje+1\n- nomes de dia da semana ('segunda', 'terça', 'qua', etc): se texto diz 'proxima' ou 'que vem' = proxima ocorrencia DEPOIS de hoje; senao = ultima ocorrencia ANTES ou IGUAL a hoje\n- "dia N" ou apenas "N" (1-31): default = mais recente N <= hoje (este mes se N <= dia atual, senao mes anterior); se texto diz 'proximo' = proxima ocorrencia futura\n- "DD/MM" sem ano: ano atual\n- "DD/MM/YY" (YY 00-69 = 2000+, 70-99 = 1900+) ou "DD/MM/YYYY": literal\n- ISO YYYY-MM-DD: literal\n- AMBIGUO (sem dia: 'semana passada', 'mes passado'): retorna null + razao pedindo o dia\n\nResponda APENAS JSON valido: {"date":"YYYY-MM-DD","reason":"interpretacao curta"} ou {"date":null,"reason":"o que falta"}`;
  const payload = { model: MODEL, body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json", temperature: 0.0 } } };
  try {
    const resp = await fetch(url + "/functions/v1/gemini", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + anon, "x-internal-secret": Deno.env.get("GERENTIA_INTERNAL_SECRET") ?? "" }, body: JSON.stringify(payload) });
    if (!resp.ok) return { ok: false, reason: "ia falhou" };
    const j = await resp.json();
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!t) return { ok: false, reason: "ia sem resposta" };
    const parsed = JSON.parse(t);
    if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return { ok: true, date: parsed.date };
    return { ok: false, reason: parsed.reason || "nao entendi a data" };
  } catch (e) {
    console.error("[parseDateBR]", e);
    return { ok: false, reason: "erro ao processar" };
  }
}

// ---------- loop agêntico ----------

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

// deno-lint-ignore no-explicit-any
async function callGemini(url: string, anon: string, payload: unknown): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const resp = await fetch(url + "/functions/v1/gemini", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + anon, "x-internal-secret": Deno.env.get("GERENTIA_INTERNAL_SECRET") ?? "" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error("proxy " + resp.status + " " + t.slice(0, 200));
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

// deno-lint-ignore no-explicit-any
function summarizeReceipt(lr: any): string {
  const v = fmtBRL(Number(lr.total_value));
  const d = lr.transaction_date ? fmtDateBR(lr.transaction_date) : "";
  const who = lr.vendor ? ` ${lr.vendor}` : "";
  return `${lr.category || lr.direction} ${v}${who} (${lr.status}${d ? ", " + d : ""}) id=${lr.id}`;
}

// deno-lint-ignore no-explicit-any
export async function runFarmAi(admin: any, linked: LinkedUser, userText: string, from: string): Promise<AgentResult> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return { text: "IA nao configurada no momento.", wizard: null };

  try {
  const { data: linkRow } = await admin
    .from("farm_whatsapp_links")
    .select("history, last_receipt_id")
    .eq("user_id", linked.user_id)
    .limit(1)
    .maybeSingle();
  const history: HistTurn[] = Array.isArray(linkRow?.history) ? linkRow.history : [];
  let lastReceiptId: string | null = linkRow?.last_receipt_id ?? null;

  const categories = await listVisibleCategories(admin, linked.organization_id, linked.user_id);

  let lastReceiptLabel: string | null = null;
  if (lastReceiptId) {
    const { data: lr } = await admin
      .from("farm_receipts")
      .select("id, direction, total_value, category, vendor, status, transaction_date")
      .eq("id", lastReceiptId)
      .maybeSingle();
    if (lr) lastReceiptLabel = summarizeReceipt(lr);
    else lastReceiptId = null;
  }

  const ctx: ToolCtx = { admin, linked, from, categories, lastReceiptId, wizardDrafts: [] };

  const system = buildFinanceAgentPrompt({
    today: todayBR(),
    userName: linked.user_name,
    costCenters: linked.cost_centers.map((c) => ({ name: c.name, slug: c.slug, is_default: !!c.is_default })),
    categories,
    lastReceipt: lastReceiptLabel,
  });

  // deno-lint-ignore no-explicit-any
  const contents: any[] = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];

  let finalText: string | null = null;
    for (let i = 0; i < MAX_ITERS; i++) {
      const payload = {
        model: MODEL,
        body: {
          systemInstruction: { parts: [{ text: system }] },
          contents,
          tools: toolDeclarations(),
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          generationConfig: { temperature: 0.3 },
        },
      };
      const json = await callGemini(url, anon, payload);
      const parts: GeminiPart[] = json?.candidates?.[0]?.content?.parts ?? [];
      const fnCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);

      if (fnCalls.length === 0) {
        finalText = parts.map((p) => p.text).filter(Boolean).join("\n").trim();
        break;
      }

      contents.push({ role: "model", parts });
      const respParts: unknown[] = [];
      for (const fc of fnCalls) {
        console.log("[farmAi] tool=" + fc.name, JSON.stringify(fc.args ?? {}));
        let result: ToolResult;
        try {
          result = await execTool(fc.name, fc.args ?? {}, ctx);
        } catch (e) {
          console.error("[farmAi] tool exception", fc.name, e);
          result = { error: "tool_failed" };
        }
        respParts.push({ functionResponse: { name: fc.name, response: result } });
      }
      contents.push({ role: "user", parts: respParts });
      if (ctx.wizardDrafts.length > 0) break; // criação -> wizard guiado
    }

  // Criação dispara o wizard guiado (handlers/whatsapp.ts); não persiste aqui.
  if (ctx.wizardDrafts.length > 0) {
    return { text: "", wizard: ctx.wizardDrafts };
  }

  if (!finalText) {
    finalText = "Me confirma em 1 frase o que voce quer? (ex: 'paguei 500 de diesel' ou 'quanto tenho a pagar').";
  }

  const newHist: HistTurn[] = [
    ...history,
    { role: "user" as const, text: userText },
    { role: "model" as const, text: finalText },
  ].slice(-HISTORY_MAX);
  await admin
    .from("farm_whatsapp_links")
    .update({ history: newHist, last_receipt_id: ctx.lastReceiptId })
    .eq("user_id", linked.user_id)
    .then(() => {}, (e: unknown) => console.warn("[farmAi] save state failed:", e));

  return { text: finalText, wizard: null };
  } catch (e) {
    console.error("[farmAi] runFarmAi failed:", e);
    return { text: "A IA tropecou agora (erro interno). Tenta de novo em instantes.", wizard: null };
  }
}
