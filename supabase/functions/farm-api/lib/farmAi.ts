/**
 * Bot conversacional financeiro (Fase B) - Gemini 3.5 Flash function calling
 * via o proxy `gemini` compartilhado (mesmo do OCR).
 *
 * Estrategia de TURNO UNICO: Gemini decide chamar uma tool (mode AUTO); a gente
 * executa e responde com texto formatado por nos - SEM round-trip de
 * functionResponse. Mais barato, deterministico e sem risco de formato.
 * Se Gemini responder texto puro (sem functionCall), devolvemos o texto dele.
 *
 * Historico curto fica em farm_whatsapp_links.history (jsonb), por telefone.
 */

const MODEL = "gemini-3.5-flash";
const HISTORY_MAX = 12;

interface LinkedUser {
  user_id: string;
  organization_id: string;
  user_name: string | null;
}

interface HistTurn {
  role: "user" | "model";
  text: string;
}

function todayBR(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function fmtBRL(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const SYSTEM_PROMPT =
  "Voce e o assistente financeiro da *Cropware Farm*, falando com um produtor rural brasileiro pelo WhatsApp. Tom pratico, direto, PT-BR, poucas palavras. Use emojis com moderacao.\n\n" +
  "Voce ajuda a registrar e consultar lancamentos financeiros da fazenda (despesas e receitas). Use SEMPRE as ferramentas disponiveis - nunca invente valores nem confirme registro sem chamar a funcao.\n\n" +
  "REGRAS:\n" +
  "- paguei/comprei/gastei X = despesa (expense). recebi/vendi X = receita (income).\n" +
  "- Valores em reais (number). Se o usuario falar '1,2 mil' entenda 1200.\n" +
  "- Se faltar o VALOR, pergunte so o valor. Nao invente.\n" +
  "- Categorias de despesa: combustivel, defensivos, sementes, fertilizantes, manutencao, pecas, frete, servicos, alimentacao, arrendamento, folha, outros_despesa. Receita: venda_graos, venda_gado, outros_receita.\n" +
  "- Para consultas (quanto gastei, o que tenho a pagar, resumo, quanto devo) use get_financial_summary ou list_receipts.\n" +
  "- EDICAO e EXCLUSAO de lancamentos NAO sao possiveis pelo WhatsApp - oriente a usar o app web (farm.cropware.com.br).\n" +
  "- Para registrar com FOTO/PDF, o usuario pode mandar a imagem do recibo direto.";

// Declaracoes de ferramentas (Gemini functionDeclarations)
function toolDeclarations() {
  return [{
    functionDeclarations: [
      {
        name: "create_receipt",
        description: "Registra um lancamento financeiro (despesa ou receita) da fazenda.",
        parameters: {
          type: "object",
          properties: {
            total_value: { type: "number", description: "Valor total em reais (ex: 1200.50)" },
            direction: { type: "string", enum: ["expense", "income"], description: "expense=despesa, income=receita" },
            category: { type: "string", description: "Categoria slug. Ex: combustivel, defensivos, venda_graos" },
            vendor: { type: "string", description: "Fornecedor ou cliente, se mencionado" },
            description: { type: "string", description: "Descricao curta do lancamento" },
            payment_method: { type: "string", enum: ["pix", "cartao", "boleto", "dinheiro", "transferencia"] },
            transaction_date: { type: "string", description: "Data YYYY-MM-DD. Se nao informado, use hoje." },
          },
          required: ["total_value", "direction"],
        },
      },
      {
        name: "get_financial_summary",
        description: "Resumo financeiro: totais a pagar, a receber e vencidos da fazenda.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "list_receipts",
        description: "Lista lancamentos recentes, com filtros opcionais.",
        parameters: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["expense", "income"] },
            category: { type: "string" },
            status: { type: "string", enum: ["a_pagar", "pago", "a_receber", "recebido", "vencido", "cancelado"] },
            days: { type: "number", description: "Ultimos N dias (default 30)" },
          },
        },
      },
    ],
  }];
}

// ---------- execucao das tools (service_role, escopo por org) ----------

// deno-lint-ignore no-explicit-any
async function execCreateReceipt(admin: any, linked: LinkedUser, args: any): Promise<string> {
  const total = Number(args.total_value);
  if (!Number.isFinite(total)) return "Nao entendi o valor. Pode repetir? Ex: paguei 850 de diesel.";
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
    source: "whatsapp",
  });
  if (error) {
    console.error("[farmAi] create_receipt insert error:", error);
    return "Nao consegui salvar o lancamento. Tenta de novo em instantes.";
  }
  const verb = direction === "income" ? "Receita" : "Despesa";
  return "✅ " + verb + " registrada: " + fmtBRL(total) + (args.vendor ? " - " + args.vendor : "") + " (" + category + ").";
}

// deno-lint-ignore no-explicit-any
async function execSummary(admin: any, linked: LinkedUser): Promise<string> {
  const { data, error } = await admin
    .from("farm_receipts")
    .select("direction, status, total_value")
    .eq("organization_id", linked.organization_id);
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
    .select("direction, total_value, category, vendor, transaction_date, status")
    .eq("organization_id", linked.organization_id)
    .gte("transaction_date", since)
    .order("transaction_date", { ascending: false })
    .limit(10);
  if (args.direction) q = q.eq("direction", args.direction);
  if (args.category) q = q.eq("category", args.category);
  if (args.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  if (error) {
    console.error("[farmAi] list error:", error);
    return "Nao consegui listar os lancamentos agora.";
  }
  if (!data || data.length === 0) return "Nenhum lancamento encontrado nesse filtro. 🤷";
  // deno-lint-ignore no-explicit-any
  const lines = data.map((r: any) => {
    const arrow = r.direction === "income" ? "💰" : "💸";
    const d = r.transaction_date ? r.transaction_date.split("-").reverse().slice(0, 2).join("/") : "--";
    return arrow + " " + d + " " + fmtBRL(Number(r.total_value)) + " - " + r.category + (r.vendor ? " (" + r.vendor + ")" : "");
  });
  return "📋 *Ultimos lancamentos*\n\n" + lines.join("\n");
}

// ---------- loop principal ----------

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

/**
 * Processa uma mensagem de texto livre com a IA financeira.
 * Retorna o texto da resposta pronto pra enviar no WhatsApp.
 */
// deno-lint-ignore no-explicit-any
export async function runFarmAi(admin: any, linked: LinkedUser, userText: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return "IA nao configurada no momento.";

  // Historico curto do telefone (na linha do vinculo)
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
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT + "\n\nHoje e " + todayBR() + "." }] },
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
      if (name === "create_receipt") reply = await execCreateReceipt(admin, linked, args);
      else if (name === "get_financial_summary") reply = await execSummary(admin, linked);
      else if (name === "list_receipts") reply = await execListReceipts(admin, linked, args);
      else reply = "Nao entendi bem. Pode reformular?";
    } else {
      const text = parts.map((p) => p.text).filter(Boolean).join("\n").trim();
      reply = text || "Nao entendi. Manda de novo, ou envie uma foto de recibo.";
    }
  } catch (e) {
    console.error("[farmAi] exception:", e);
    return "📡 Sem conexao com a IA agora. Tenta de novo em 1 minuto.";
  }

  // Salva historico (best-effort)
  const newHist = [...history, { role: "user" as const, text: userText }, { role: "model" as const, text: reply }]
    .slice(-HISTORY_MAX);
  await admin.from("farm_whatsapp_links").update({ history: newHist }).eq("user_id", linked.user_id)
    .then(() => {}, (e: unknown) => console.warn("[farmAi] save history failed:", e));

  return reply;
}
