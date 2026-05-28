import { type CostCenterRow } from "./cc.ts";
import { sendButtons, sendList } from "./whatsapp.ts";

const MODEL = "gemini-3.5-flash";
const HISTORY_MAX = 12;

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
// Formato en-CA = YYYY-MM-DD (espelha ISO date).
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

const SYSTEM_PROMPT_BASE =
  "Voce e o assistente financeiro da *Cropware Farm*, falando com um produtor rural brasileiro pelo WhatsApp. Tom pratico, direto, PT-BR, poucas palavras. Use emojis com moderacao.\n\n" +
  "Voce ajuda a registrar e consultar lancamentos financeiros (despesas e receitas). Use SEMPRE as ferramentas disponiveis - nunca invente valores nem confirme registro sem chamar a funcao.\n\n" +
  "REGRAS:\n" +
  "- 'paguei/comprei/gastei <valor> de <categoria>' COM valor monetario = NOVA despesa, use create_receipt.\n" +
  "- 'recebi/vendi <valor> de <categoria>' COM valor monetario = NOVA receita, use create_receipt.\n" +
  "- 'paguei/quitei/dei baixa <fornecedor/descricao>' SEM valor (ou referindo a conta existente) = marcar conta pendente como paga, use mark_receipt_paid.\n" +
  "  Ex: 'paguei o boleto da Cemig', 'quitei a conta da agua', 'paguei aquele do diesel' -> mark_receipt_paid.\n" +
  "- 'recebi <quem/descricao>' SEM valor = marcar receita pendente como recebida, use mark_receipt_paid (a tool cobre ambos).\n" +
  "- Valores em reais (number). Se o usuario falar '1,2 mil' entenda 1200.\n" +
  "- Se faltar o VALOR numa criacao, pergunte so o valor. Nao invente.\n" +
  "- DATA: se o usuario mencionar uma data ou tempo relativo no texto ('ontem', 'anteontem', 'dia 25', '25/03', 'na terca passada', 'amanha'), RESOLVA pra YYYY-MM-DD e preencha 'transaction_date'. Use 'Hoje e <data>' acima como referencia. Se NAO mencionar, NAO preencha 'transaction_date' - o backend vai perguntar.\n" +
  "- Categorias de despesa: combustivel, defensivos, sementes, fertilizantes, manutencao, pecas, frete, servicos, alimentacao, arrendamento, folha, outros_despesa. Receita: venda_graos, venda_gado, outros_receita.\n" +
  "- Para consultas (quanto gastei, o que tenho a pagar, resumo, quanto devo) use get_financial_summary ou list_receipts.\n" +
  "- EDICAO e EXCLUSAO de lancamentos NAO sao possiveis pelo WhatsApp - oriente a usar o app web.\n" +
  "- Para registrar com FOTO/PDF, o usuario pode mandar a imagem do recibo direto.";

function buildSystemPrompt(linked: LinkedUser): string {
  const ccs = linked.cost_centers;
  let ccBlock: string;
  if (ccs.length <= 1) {
    const only = ccs[0];
    ccBlock = only
      ? `\n\nCentro de custo unico do usuario: ${only.name} (slug: ${only.slug}). Todo lancamento vai pra ele automaticamente — NAO pergunte qual centro.`
      : "\n\nO usuario nao tem nenhum centro de custo liberado. Nao registre nada e oriente a falar com o admin.";
  } else {
    const lines = ccs.map((c) => `- ${c.slug} (${c.name})`).join("\n");
    ccBlock =
      `\n\nCentros de custo disponiveis pra este usuario:\n${lines}\n\n` +
      `Ao chamar create_receipt:\n` +
      `- Se o usuario mencionar nome/slug do centro ('no escritorio', 'fazenda', 'pessoal'), passe esse slug no argumento 'cost_center'.\n` +
      `- Se o usuario NAO mencionar centro, NAO preencha 'cost_center'. O backend vai perguntar via botoes. NAO pergunte voce.`;
  }
  return SYSTEM_PROMPT_BASE + ccBlock + `\n\nHoje e ${todayBR()}.`;
}

function toolDeclarations() {
  return [{
    functionDeclarations: [
      {
        name: "create_receipt",
        description: "Registra um lancamento financeiro (despesa ou receita).",
        parameters: {
          type: "object",
          properties: {
            total_value: { type: "number" },
            direction: { type: "string", enum: ["expense", "income"] },
            category: { type: "string", description: "Slug. Ex: combustivel, defensivos, venda_graos" },
            cost_center: { type: "string", description: "Centro de custo (slug ou nome). Se omitido, usa o default." },
            vendor: { type: "string" },
            description: { type: "string" },
            payment_method: { type: "string", enum: ["pix", "cartao", "boleto", "dinheiro", "transferencia"] },
            transaction_date: { type: "string", description: "YYYY-MM-DD. Se omitido, usa hoje." },
          },
          required: ["total_value", "direction"],
        },
      },
      {
        name: "get_financial_summary",
        description: "Resumo: totais a pagar/a receber/vencidos (limitado aos centros do usuario).",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "list_receipts",
        description: "Lista lancamentos recentes (limitado aos centros do usuario).",
        parameters: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["expense", "income"] },
            category: { type: "string" },
            status: { type: "string", enum: ["a_pagar", "pago", "a_receber", "recebido", "vencido", "cancelado"] },
            cost_center: { type: "string", description: "Slug ou nome do centro pra filtrar." },
            days: { type: "number", description: "Ultimos N dias (default 30)" },
          },
        },
      },
      {
        name: "list_my_cost_centers",
        description: "Lista os centros de custo a que o usuario tem acesso.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "mark_receipt_paid",
        description:
          "Marca uma conta pendente como paga (despesa) ou recebida (receita). " +
          "Use quando o usuario fala 'paguei/quitei/dei baixa em <X>' OU 'recebi <X>' " +
          "referindo-se a uma conta JA EXISTENTE, sem informar valor novo.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Texto que descreve a conta: fornecedor, categoria ou descricao. Ex: 'Cemig', 'boleto da agua', 'diesel'.",
            },
            amount: {
              type: "number",
              description:
                "Valor aproximado, se o usuario citar. Usado pra desambiguar quando houver multiplas contas do mesmo fornecedor.",
            },
          },
          required: ["query"],
        },
      },
    ],
  }];
}

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

/**
 * Cria o farm_receipts dado args ja resolvidos + cc.id explicito.
 * Reuso pelo handler interativo (cr_cc:<id>) apos seleção de CC.
 */
// deno-lint-ignore no-explicit-any
export async function applyCreateReceipt(admin: any, linked: LinkedUser, args: any, cc: CostCenterRow): Promise<string> {
  const total = Number(args.total_value);
  if (!Number.isFinite(total)) return "Valor invalido.";
  const direction = args.direction === "income" ? "income" : "expense";
  const category = args.category || (direction === "income" ? "outros_receita" : "outros_despesa");

  const { error } = await admin.from("farm_receipts").insert({
    organization_id: linked.organization_id,
    created_by: linked.user_id,
    doc_type: "outro",
    direction,
    status: direction === "income" ? "a_receber" : "a_pagar",
    total_value: total,
    currency: "BRL",
    transaction_date: args.transaction_date || todayBR(),
    vendor: args.vendor ?? null,
    payment_method: args.payment_method ?? null,
    description: args.description ?? null,
    category,
    cost_center_id: cc.id,
    source: "whatsapp",
  });
  if (error) {
    console.error("[farmAi] applyCreate insert error:", error);
    return "Nao consegui salvar o lancamento. Tenta de novo em instantes.";
  }
  const verb = direction === "income" ? "Receita" : "Despesa";
  const showCC = linked.cost_centers.length > 1 ? ` em ${cc.name}` : "";
  return "✅ " + verb + " registrada: " + fmtBRL(total) +
    (args.vendor ? " - " + args.vendor : "") +
    " (" + category + ")" + showCC + ".";
}

/**
 * Pede a data via 3 botoes (Hoje / Ontem / Outra data). Persiste pending
 * com kind='create_select_date' carregando args + cc_id pra retomar depois.
 */
// deno-lint-ignore no-explicit-any
export async function askDateButtons(admin: any, from: string, args: any, ccId: string): Promise<void> {
  await admin.from("farm_wa_pending").upsert({
    phone_number: from,
    kind: "create_select_date",
    data: { args, cc_id: ccId },
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  const total = Number(args.total_value);
  const direction = args.direction === "income" ? "Receita" : "Despesa";
  const cat = args.category ? ` (${args.category})` : "";
  const body = `${direction} de ${fmtBRL(total)}${cat}.\n\nQual a data?`;
  await sendButtons(from, body, [
    { id: "cr_date:hoje", title: "Hoje" },
    { id: "cr_date:ontem", title: "Ontem" },
    { id: "cr_date:custom", title: "Outra data" },
  ]);
}

/**
 * Parser de data em linguagem natural PT-BR via Gemini. Usa "hoje" como
 * referencia. Resolve "ontem", "anteontem", "amanha", dia da semana,
 * "dia N", "25/03", "25/03/26", "DD/MM/YYYY", ISO YYYY-MM-DD. Retorna
 * data: null + reason quando ambiguo (ex: "semana passada" sem dia).
 */
export async function parseDateBR(text: string): Promise<{ ok: true; date: string } | { ok: false; reason: string }> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return { ok: false, reason: "ia indisponivel" };
  const today = todayBR();
  const prompt = `Voce e um parser de data em portugues brasileiro. Hoje e ${today}.\n\nTexto do usuario: "${text}"\n\nRegras:\n- "hoje" -> hoje\n- "ontem" -> hoje-1\n- "anteontem" -> hoje-2\n- "amanha" -> hoje+1\n- nomes de dia da semana ('segunda', 'terça', 'qua', etc): se texto diz 'proxima' ou 'que vem' = proxima ocorrencia DEPOIS de hoje; senao = ultima ocorrencia ANTES ou IGUAL a hoje\n- "dia N" ou apenas "N" (1-31): default = mais recente N <= hoje (este mes se N <= dia atual, senao mes anterior); se texto diz 'proximo' = proxima ocorrencia futura\n- "DD/MM" sem ano: ano atual\n- "DD/MM/YY" (YY 00-69 = 2000+, 70-99 = 1900+) ou "DD/MM/YYYY": literal\n- ISO YYYY-MM-DD: literal\n- AMBIGUO (sem dia: 'semana passada', 'mes passado'): retorna null + razao pedindo o dia\n\nResponda APENAS JSON valido: {"date":"YYYY-MM-DD","reason":"interpretacao curta"} ou {"date":null,"reason":"o que falta"}`;
  const payload = { model: MODEL, body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json", temperature: 0.0 } } };
  try {
    const resp = await fetch(url + "/functions/v1/gemini", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + anon }, body: JSON.stringify(payload) });
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

// deno-lint-ignore no-explicit-any
async function execCreateReceipt(admin: any, linked: LinkedUser, args: any, from: string): Promise<string> {
  const total = Number(args.total_value);
  if (!Number.isFinite(total)) return "Nao entendi o valor. Pode repetir? Ex: paguei 850 de diesel.";

  // 1) Resolve CC
  let cc: CostCenterRow | null = null;
  if (args.cost_center) {
    cc = resolveCCFromList(args.cost_center, linked.cost_centers);
    if (!cc) return `Nao achei o centro '${args.cost_center}'. Seus centros: ${linked.cost_centers.map((c) => c.name).join(", ")}.`;
  } else if (linked.cost_centers.length === 1) {
    cc = linked.cost_centers[0];
  } else if (linked.cost_centers.length === 0) {
    return "Voce ainda nao tem nenhum centro de custo. Pede pro admin liberar um pra voce.";
  } else {
    // Pergunta CC via botoes/lista
    await admin.from("farm_wa_pending").upsert({
      phone_number: from,
      kind: "create_select_cc",
      data: { args },
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    const direction = args.direction === "income" ? "Receita" : "Despesa";
    const cat = args.category ? ` (${args.category})` : "";
    const vend = args.vendor ? ` - ${args.vendor}` : "";
    const body = `${direction} de ${fmtBRL(total)}${vend}${cat}.\n\nEm qual centro lançar?`;
    if (linked.cost_centers.length <= 3) {
      await sendButtons(from, body, linked.cost_centers.map((c) => ({ id: "cr_cc:" + c.id, title: c.name })));
    } else {
      await sendList(from, body, "Escolher centro", [{ rows: linked.cost_centers.map((c) => ({ id: "cr_cc:" + c.id, title: c.name })) }]);
    }
    return "";
  }

  // 2) CC resolvido. Se data ja veio do Gemini -> salva. Senao -> pergunta.
  if (args.transaction_date) return await applyCreateReceipt(admin, linked, args, cc);
  await askDateButtons(admin, from, args, cc.id);
  return "";
}

// deno-lint-ignore no-explicit-any
async function execSummary(admin: any, linked: LinkedUser): Promise<string> {
  let q = admin
    .from("farm_receipts")
    .select("direction, status, total_value")
    .eq("organization_id", linked.organization_id);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  const { data, error } = await q;
  if (error) {
    console.error("[farmAi] summary error:", error);
    return "Nao consegui buscar o resumo agora.";
  }
  let aPagar = 0, aReceber = 0, vencido = 0;
  for (const r of data || []) {
    const v = Number(r.total_value) || 0;
    if (r.status === "a_pagar") aPagar += v;
    else if (r.status === "a_receber") aReceber += v;
    else if (r.status === "vencido") vencido += v;
  }
  return "📊 *Resumo financeiro*\n\n💸 A pagar: " + fmtBRL(aPagar) +
    "\n💰 A receber: " + fmtBRL(aReceber) +
    "\n⚠️ Vencido: " + fmtBRL(vencido) +
    "\n\n_Detalhes e edicao no app: farm.cropware.com.br_";
}

// deno-lint-ignore no-explicit-any
async function execListReceipts(admin: any, linked: LinkedUser, args: any): Promise<string> {
  const days = Number.isFinite(Number(args.days)) ? Number(args.days) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  let q = admin
    .from("farm_receipts")
    .select("direction, total_value, category, vendor, transaction_date, status, cost_center_id")
    .eq("organization_id", linked.organization_id)
    .gte("transaction_date", since)
    .order("transaction_date", { ascending: false })
    .limit(10);
  if (args.direction) q = q.eq("direction", args.direction);
  if (args.category) q = q.eq("category", args.category);
  if (args.status) q = q.eq("status", args.status);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  if (args.cost_center) {
    const cc = resolveCCFromList(args.cost_center, linked.cost_centers);
    if (!cc) return `Centro '${args.cost_center}' nao encontrado.`;
    q = q.eq("cost_center_id", cc.id);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[farmAi] list error:", error);
    return "Nao consegui listar os lancamentos agora.";
  }
  if (!data || data.length === 0) return "Nenhum lancamento encontrado nesse filtro. 🤷";
  const showCC = linked.cost_centers.length > 1;
  const ccMap = new Map(linked.cost_centers.map((c) => [c.id, c.name]));
  // deno-lint-ignore no-explicit-any
  const lines = data.map((r: any) => {
    const arrow = r.direction === "income" ? "💰" : "💸";
    const d = r.transaction_date ? r.transaction_date.split("-").reverse().slice(0, 2).join("/") : "--";
    const ccName = showCC && r.cost_center_id ? ` [${ccMap.get(r.cost_center_id) || "?"}]` : "";
    return arrow + " " + d + " " + fmtBRL(Number(r.total_value)) + " - " +
      r.category + (r.vendor ? " (" + r.vendor + ")" : "") + ccName;
  });
  return "📋 *Ultimos lancamentos*\n\n" + lines.join("\n");
}

/**
 * Tenta marcar uma conta pendente como paga/recebida.
 *
 * 0 matches  -> texto explicando que nao achou (sugere criar nova).
 * 1 match    -> marca como pago/recebido na hora.
 * >1 matches -> escreve farm_wa_pending kind='pay_select' com array de ids,
 *               retorna lista numerada pro user responder "1", "2", etc.
 *               A logica de "user respondeu numero" fica em handlers/whatsapp.ts
 *               (precisa de from + interrompe o flow antes de runFarmAi).
 */
// deno-lint-ignore no-explicit-any
async function execMarkPaid(
  admin: any,
  linked: LinkedUser,
  // deno-lint-ignore no-explicit-any
  args: any,
  from: string,
): Promise<string> {
  const query = String(args.query || "").trim();
  if (!query) return "Pra qual conta? Me diz o fornecedor ou descricao. Ex: 'paguei o boleto da Cemig'.";

  // Busca todas as pendentes do escopo CCs do user.
  let q = admin
    .from("farm_receipts")
    .select("id, direction, vendor, description, category, total_value, transaction_date, due_date, status, cost_center_id")
    .eq("organization_id", linked.organization_id)
    .in("status", ["a_pagar", "a_receber", "vencido"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("transaction_date", { ascending: false })
    .limit(50);
  const allowed = ccFilterIds(linked);
  if (allowed) q = q.in("cost_center_id", allowed);
  const { data, error } = await q;
  if (error) {
    console.error("[farmAi] mark_paid query error:", error);
    return "Nao consegui buscar suas contas pendentes agora.";
  }
  if (!data || data.length === 0) return "Voce nao tem nenhuma conta pendente. 🤷";

  // Fuzzy match: vendor / description / category ilike.
  const needle = query.toLowerCase();
  // deno-lint-ignore no-explicit-any
  let matches = (data as any[]).filter((r) =>
    (r.vendor || "").toLowerCase().includes(needle)
    || (r.description || "").toLowerCase().includes(needle)
    || (r.category || "").toLowerCase().includes(needle)
  );

  // Se amount foi citado, filtra por +/-5%.
  const amount = Number(args.amount);
  if (Number.isFinite(amount) && amount > 0 && matches.length > 1) {
    const tol = amount * 0.05;
    const tight = matches.filter((r) => Math.abs(Number(r.total_value) - amount) <= tol);
    if (tight.length > 0) matches = tight;
  }

  if (matches.length === 0) {
    return `Nao achei conta pendente com '${query}'. Manda 'a pagar' pra eu listar tudo que esta em aberto.`;
  }

  if (matches.length === 1) {
    return await applyMarkPaid(admin, matches[0]);
  }

  // Multiplas: lista + pending.
  const top = matches.slice(0, 9);
  const ids = top.map((r) => r.id as string);
  await admin.from("farm_wa_pending").upsert({
    phone_number: from,
    kind: "pay_select",
    data: { ids },
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  const lines = top.map((r, i) => {
    const d = r.due_date || r.transaction_date || "--";
    const ds = typeof d === "string" ? d.split("-").reverse().slice(0, 2).join("/") : "--";
    const arrow = r.direction === "income" ? "💰" : "💸";
    const vendor = r.vendor || r.description || r.category || "(sem fornecedor)";
    return `*${i + 1}*. ${arrow} ${ds} - ${fmtBRL(Number(r.total_value))} - ${vendor}`;
  });
  return "Achei mais de uma conta. Responde com o numero da que voce pagou:\n\n" + lines.join("\n");
}

// deno-lint-ignore no-explicit-any
export async function applyMarkPaid(admin: any, row: any): Promise<string> {
  const newStatus = row.direction === "income" ? "recebido" : "pago";
  const today = todayBR();
  const { error: updErr } = await admin
    .from("farm_receipts")
    .update({ status: newStatus, paid_date: today })
    .eq("id", row.id);
  if (updErr) {
    console.error("[farmAi] mark_paid update error:", updErr);
    return "Nao consegui atualizar a conta. Tenta de novo em instantes.";
  }
  const verb = row.direction === "income" ? "Recebido" : "Pago";
  const who = row.vendor || row.description || row.category || "lancamento";
  return `✅ ${verb}: ${fmtBRL(Number(row.total_value))} - ${who}.`;
}

function execListMyCostCenters(linked: LinkedUser): string {
  if (linked.cost_centers.length === 0) {
    return "Voce ainda nao tem nenhum centro de custo liberado. Pede pro admin.";
  }
  const def = linked.cost_centers.find((c) => c.is_default);
  const lines = linked.cost_centers.map((c) =>
    `• ${c.name}${c.id === def?.id ? " (default)" : ""}`
  ).join("\n");
  return "🏷️ *Seus centros de custo*\n\n" + lines;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

// deno-lint-ignore no-explicit-any
export async function runFarmAi(admin: any, linked: LinkedUser, userText: string, from: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return "IA nao configurada no momento.";

  const { data: linkRow } = await admin
    .from("farm_whatsapp_links")
    .select("history")
    .eq("user_id", linked.user_id)
    .limit(1)
    .maybeSingle();
  const history: HistTurn[] = Array.isArray(linkRow?.history) ? linkRow.history : [];

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];

  const payload = {
    model: MODEL,
    body: {
      systemInstruction: { parts: [{ text: buildSystemPrompt(linked) }] },
      contents,
      tools: toolDeclarations(),
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { temperature: 0.3 },
    },
  };

  let reply: string;
  try {
    const resp = await fetch(supabaseUrl + "/functions/v1/gemini", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + anonKey },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error("[farmAi] proxy non-2xx:", resp.status, await resp.text().catch(() => ""));
      return "🔧 A IA esta instavel agora. Tenta de novo em 1 minuto.";
    }
    const json = await resp.json();
    const parts: GeminiPart[] = json?.candidates?.[0]?.content?.parts || [];
    const fnPart = parts.find((p) => p.functionCall);

    if (fnPart?.functionCall) {
      const { name, args } = fnPart.functionCall;
      console.log("[farmAi] tool=" + name, JSON.stringify(args));
      if (name === "create_receipt") reply = await execCreateReceipt(admin, linked, args, from);
      else if (name === "get_financial_summary") reply = await execSummary(admin, linked);
      else if (name === "list_receipts") reply = await execListReceipts(admin, linked, args);
      else if (name === "list_my_cost_centers") reply = execListMyCostCenters(linked);
      else if (name === "mark_receipt_paid") reply = await execMarkPaid(admin, linked, args, from);
      else reply = "Nao entendi bem. Pode reformular?";
    } else {
      const text = parts.map((p) => p.text).filter(Boolean).join("\n").trim();
      reply = text || "Nao entendi. Manda de novo, ou envie uma foto de recibo.";
    }
  } catch (e) {
    console.error("[farmAi] exception:", e);
    return "📡 Sem conexao com a IA agora. Tenta de novo em 1 minuto.";
  }

  const newHist = [
    ...history,
    { role: "user" as const, text: userText },
    { role: "model" as const, text: reply },
  ].slice(-HISTORY_MAX);
  await admin.from("farm_whatsapp_links").update({ history: newHist }).eq("user_id", linked.user_id)
    .then(() => {}, (e: unknown) => console.warn("[farmAi] save history failed:", e));

  return reply;
}
