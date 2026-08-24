/**
 * Cloudflare R2 storage helper (privado) pro gerentia.app.
 *
 * Difere do CDM (`cropware/.../r2_storage.tsx`): la o bucket e PUBLICO via
 * dominio (storage.cropware.com.br) porque sao fotos de campo. Aqui guardamos
 * DOCUMENTO FISCAL (recibo, NF, boleto com CNPJ/valores) -> bucket PRIVADO,
 * acesso so via presigned URL de TTL curto. Sem R2_PUBLIC_URL.
 *
 * Usa aws4fetch (SigV4 leve) pra evitar o cold-start timeout do
 * @aws-sdk/client-s3 no edge Deno.
 *
 * Secrets esperados na edge gerentia-api (prefixo GERENTIA_; ainda aceita os
 * legados FARM_* via lib/env.ts durante a migracao):
 * - GERENTIA_R2_ACCOUNT_ID
 * - GERENTIA_R2_ACCESS_KEY_ID
 * - GERENTIA_R2_SECRET_ACCESS_KEY
 * - GERENTIA_R2_BUCKET_NAME (ex: "gerentia-receipts") — anexos
 * - GERENTIA_R2_BACKUP_ACCESS_KEY_ID / _SECRET_ACCESS_KEY — token proprio do
 *   balde de backup. OPCIONAL: sem eles cai nas chaves principais.
 * - GERENTIA_R2_BACKUP_BUCKET — backups. OPCIONAL: o default ja e o balde
 *   que existe hoje ("gerentia-r2-backup-bucket"). So setar se trocar de balde.
 *   Ver docs/BACKUP-E-RESTAURACAO.md.
 */

import { AwsClient } from "npm:aws4fetch@1.0.20";
import { secret } from "./env.ts";

/**
 * Baldes existentes. Anexo e backup ficam SEPARADOS de proposito: o de anexo e
 * escrito por qualquer usuario que manda um recibo, o de backup so pela edge
 * com service_role. Misturar os dois faria uma credencial vazada no fluxo de
 * anexo alcancar tambem o backup que deveria socorrer o estrago.
 */
export type BaldeR2 = "anexos" | "backups";

const _clients: Partial<Record<BaldeR2, AwsClient>> = {};

/**
 * Um cliente por BALDE, porque cada balde pode ter credencial propria.
 *
 * O token do R2 e escopado por balde na Cloudflare. Dar ao fluxo de anexo uma
 * credencial que tambem alcanca o backup anularia a separacao dos baldes: o
 * upload de anexo e disparado por qualquer usuario que manda um recibo, e o
 * backup e justamente o que socorre quando esse caminho da errado.
 *
 * As chaves de backup sao OPCIONAIS: sem elas, cai nas principais. Serve para
 * quem preferir um token unico com acesso aos dois baldes — funciona, so troca
 * seguranca por conveniencia.
 */
function getR2Client(balde: BaldeR2 = "anexos"): AwsClient {
  const cache = _clients[balde];
  if (cache) return cache;

  const accessKeyId =
    (balde === "backups" ? secret("GERENTIA_R2_BACKUP_ACCESS_KEY_ID") : null) ||
    secret("GERENTIA_R2_ACCESS_KEY_ID");
  const secretAccessKey =
    (balde === "backups"
      ? secret("GERENTIA_R2_BACKUP_SECRET_ACCESS_KEY")
      : null) || secret("GERENTIA_R2_SECRET_ACCESS_KEY");

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 nao configurado. Defina GERENTIA_R2_ACCESS_KEY_ID e GERENTIA_R2_SECRET_ACCESS_KEY.",
    );
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
  _clients[balde] = client;
  return client;
}

function getEndpoint(balde: BaldeR2 = "anexos"): string {
  const accountId = secret("GERENTIA_R2_ACCOUNT_ID");
  if (!accountId) throw new Error("GERENTIA_R2_ACCOUNT_ID nao configurado.");
  const bucket =
    balde === "backups"
      ? secret("GERENTIA_R2_BACKUP_BUCKET") || "gerentia-r2-backup-bucket"
      : secret("GERENTIA_R2_BUCKET_NAME") || "gerentia-receipts";
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
}

/**
 * Sobe um objeto pro R2. Retorna a KEY (nao URL — bucket e privado).
 * Persista a key em farm_receipts.attachment_key.
 */
export async function uploadToR2(
  key: string,
  body: Uint8Array | ArrayBuffer,
  contentType: string,
  balde: BaldeR2 = "anexos",
): Promise<string> {
  const client = getR2Client(balde);
  const url = `${getEndpoint(balde)}/${key}`;

  const response = await client.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`R2 upload falhou (${response.status}): ${text}`);
  }
  return key;
}

/**
 * Gera presigned GET URL de TTL curto pra o cliente baixar o anexo.
 * Default 300s (5min) — espelha o modelo de signed URL do Supabase Storage.
 */
export async function presignGetUrl(
  key: string,
  expiresSeconds = 300,
  balde: BaldeR2 = "anexos",
): Promise<string> {
  const client = getR2Client(balde);
  const url = new URL(`${getEndpoint(balde)}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));

  const signed = await client.sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url;
}

/**
 * Baixa os bytes de um objeto do R2 (uso server-side: ex. reenviar pro Gemini).
 */
export async function getFromR2(
  key: string,
  balde: BaldeR2 = "anexos",
): Promise<ArrayBuffer> {
  const client = getR2Client(balde);
  const response = await client.fetch(`${getEndpoint(balde)}/${key}`, {
    method: "GET",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`R2 get falhou (${response.status}): ${text}`);
  }
  return response.arrayBuffer();
}

/**
 * Remove um objeto do R2. 404 e tratado como sucesso (idempotente).
 */
export async function deleteFromR2(
  key: string,
  balde: BaldeR2 = "anexos",
): Promise<void> {
  const client = getR2Client(balde);
  const response = await client.fetch(`${getEndpoint(balde)}/${key}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    throw new Error(`R2 delete falhou (${response.status}): ${text}`);
  }
}
