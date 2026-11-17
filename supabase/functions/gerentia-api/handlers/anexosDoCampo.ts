import type { Hono } from "npm:hono";
import { getUserClient, requireCanWrite, requireFarmUser, requireModule } from "../lib/userClient.ts";
import { presignGetUrl, uploadToR2 } from "../lib/r2.ts";

/**
 * Fotos e arquivos do módulo Field (atividades, avaliações de ensaio) — fase 5
 * da unificação. Mesmo R2 PRIVADO dos lançamentos, pasta org-<org>/campo/...;
 * o registro guarda só a key, e a tela pede um link temporário para ver.
 *
 * Tirar o anexo do registro NÃO apaga o objeto no R2 (fica órfão, como já
 * acontece nos lançamentos) — a limpeza é um item à parte.
 */
const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};
const MAX = 10 * 1024 * 1024;

function bytesDe(base64: string): Uint8Array {
  const limpo = base64.includes(",") ? base64.split(",")[1] : base64;
  const bin = atob(limpo);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function mountAnexosDoCampoRoutes(app: Hono) {
  app.post("/campo/anexos", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireCanWrite(client);
      if (auth.error) return auth.error;
      const semModulo = await requireModule(client, "field");
      if (semModulo) return semModulo;

      const body = await c.req.json().catch(() => null);
      const mime = body?.mime;
      if (typeof body?.base64 !== "string" || typeof mime !== "string" || !TIPOS[mime]) {
        return c.json({ error: "envie base64 e mime (imagem ou PDF)" }, 400);
      }
      let bytes: Uint8Array;
      try {
        bytes = bytesDe(body.base64);
      } catch {
        return c.json({ error: "invalid_base64" }, 400);
      }
      if (bytes.byteLength > MAX) return c.json({ error: "arquivo_maior_que_10mb" }, 413);

      const key = `org-${auth.organizationId}/campo/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${TIPOS[mime]}`;
      await uploadToR2(key, bytes, mime);
      return c.json({ key, tamanho: bytes.byteLength });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      console.error("[campo/anexos]", resp);
      return c.json({ error: "upload_failed" }, 500);
    }
  });

  app.get("/campo/anexos/url", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      const key = c.req.query("key") ?? "";
      // Só a pasta do campo da PRÓPRIA organização.
      if (!key.startsWith(`org-${auth.organizationId}/campo/`) || key.includes("..")) {
        return c.json({ error: "forbidden" }, 403);
      }
      return c.json({ url: await presignGetUrl(key, 300) });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
