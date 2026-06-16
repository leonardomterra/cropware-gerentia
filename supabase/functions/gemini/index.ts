// Proxy Gemini — encaminha { model, body } para o Google Generative AI e
// devolve a resposta crua do Google. Antes vivia no projeto do Studio (o
// "blast radius compartilhado" citado em lib/gemini.ts); agora é próprio do
// gerentia, parte da separação do projeto Supabase.
//
// Chamado server-to-server pela gerentia-api (lib/gemini.ts) com
// Authorization: Bearer <anon key>. Contrato:
//   req  : POST { model: string, body: <GenerateContentRequest do Google> }
//   resp : JSON cru do Google -> { candidates: [{ content: { parts: [{ text }] }}]}
//
// Deploy (CLI, não cabe no MCP):
//   supabase functions deploy gemini --project-ref ttnsywnwjybrrtykoqxr
//   supabase secrets set GOOGLE_AI_KEY=<chave> --project-ref ttnsywnwjybrrtykoqxr

const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface ProxyRequest {
  model: string;
  body: unknown;
}

// Comparação constant-time (a anon key é pública; sem isso, qualquer um chama
// este proxy e queima a GOOGLE_AI_KEY). Só a gerentia-api conhece o segredo.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  // Segredo interno: só a gerentia-api pode chamar. Fail-open ATÉ configurar
  // GERENTIA_INTERNAL_SECRET (pra não derrubar a IA no deploy); depois enforce.
  const internal = Deno.env.get("GERENTIA_INTERNAL_SECRET");
  if (internal) {
    if (!safeEqual(req.headers.get("x-internal-secret") ?? "", internal)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    console.warn("[gemini] GERENTIA_INTERNAL_SECRET ausente — proxy SEM proteção (configure)");
  }

  const apiKey = Deno.env.get("GOOGLE_AI_KEY");
  if (!apiKey) {
    return Response.json({ error: "missing_google_ai_key" }, { status: 500 });
  }

  let payload: ProxyRequest;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { model, body } = payload;
  if (!model || typeof model !== "string" || !body) {
    return Response.json({ error: "missing_model_or_body" }, { status: 400 });
  }

  let googleResp: Response;
  try {
    googleResp = await fetch(`${GOOGLE_API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[gemini-proxy] network error:", err);
    return Response.json({ error: "google_network_error" }, { status: 502 });
  }

  // Repassa corpo e status do Google sem mexer — a gerentia-api faz o parse.
  const text = await googleResp.text();
  if (!googleResp.ok) {
    console.error(`[gemini-proxy] google ${googleResp.status}:`, text.slice(0, 500));
  }
  return new Response(text, {
    status: googleResp.status,
    headers: { "content-type": "application/json" },
  });
});
