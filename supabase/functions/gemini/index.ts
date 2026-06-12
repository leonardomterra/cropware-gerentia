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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
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
