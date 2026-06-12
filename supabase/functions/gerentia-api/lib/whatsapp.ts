/**
 * Cliente WhatsApp Cloud API (Meta) pro bot do gerentia.app.
 *
 * Secrets (prefixo GERENTIA; aceita legado WHATSAPP_FARM_BOT_* via lib/env.ts):
 * - WHATSAPP_GERENTIA_BOT_TOKEN  (system user token, never-expire)
 * - WHATSAPP_GERENTIA_BOT_PNID   (phone number id do numero — teste ou Salvy)
 *
 * Envio e download passam 100% pela Graph API da Meta — a Salvy so fornece o
 * numero (nao entra no caminho da mensagem).
 */

import { secret } from "./env.ts";

const GRAPH = "https://graph.facebook.com/v25.0";

function token(): string {
  const t = secret("WHATSAPP_GERENTIA_BOT_TOKEN");
  if (!t) throw new Error("WHATSAPP_GERENTIA_BOT_TOKEN nao configurado.");
  return t;
}

function pnid(): string {
  const p = secret("WHATSAPP_GERENTIA_BOT_PNID");
  if (!p) throw new Error("WHATSAPP_GERENTIA_BOT_PNID nao configurado.");
  return p;
}

async function postMessage(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${GRAPH}/${pnid()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[whatsapp] send failed ${res.status}:`, body);
  }
}

/** Mensagem de texto simples. */
export function sendText(to: string, body: string): Promise<void> {
  return postMessage({
    to,
    type: "text",
    text: { preview_url: false, body: body.slice(0, 4096) },
  });
}

/** Ate 3 botoes reply. title max 20 chars. */
export function sendButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<void> {
  return postMessage({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/**
 * Baixa midia recebida (foto, PDF, audio) em 2 passos:
 * 1. GET /{mediaId} -> URL temporaria
 * 2. GET na URL com Bearer -> bytes
 */
export async function downloadMedia(mediaId: string): Promise<ArrayBuffer> {
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!metaRes.ok) throw new Error(`media meta failed: ${metaRes.status}`);
  const meta = await metaRes.json();
  if (!meta.url) throw new Error("media url ausente na resposta da Graph API");

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!fileRes.ok) throw new Error(`media download failed: ${fileRes.status}`);
  return fileRes.arrayBuffer();
}

/** ArrayBuffer -> base64 (em chunks pra nao estourar o stack). */
/** Lista interativa (ate 10 rows). Usado pra seletor de Centro de Custo quando >3 CCs. */
export function sendList(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }>,
): Promise<void> {
  return postMessage({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body.slice(0, 1024) },
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.slice(0, 10).map((s) => ({
          ...(s.title ? { title: s.title.slice(0, 24) } : {}),
          rows: s.rows.slice(0, 10).map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        })),
      },
    },
  });
}

/**
 * Envia mensagem template aprovada (necessario quando o usuario nao mandou
 * mensagem nas ultimas 24h - so templates passam a 'janela').
 * Params sao posicionais ({{1}}, {{2}}, ...).
 */
export function sendTemplate(
  to: string,
  templateName: string,
  language: string,
  params: string[],
): Promise<void> {
  const components = params.length === 0 ? [] : [{
    type: "body",
    parameters: params.map((p) => ({ type: "text", text: String(p) })),
  }];
  return postMessage({
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  });
}

/**
 * Submete um message template pra aprovacao Meta. Aprovacao tipica 0-48h.
 * Endpoint: POST /{WABA_ID}/message_templates
 * Retorna o id se aceito ou lanca com o body de erro.
 */
export async function submitTemplate(
  body: Record<string, unknown>,
): Promise<{ id: string; status: string }> {
  const waba = secret("WHATSAPP_GERENTIA_BOT_WABA_ID");
  if (!waba) throw new Error("WHATSAPP_GERENTIA_BOT_WABA_ID nao configurado.");
  const res = await fetch(`${GRAPH}/${waba}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`template submit ${res.status}: ${txt}`);
  return JSON.parse(txt);
}

export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
