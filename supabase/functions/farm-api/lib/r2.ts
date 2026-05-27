/**
 * Cloudflare R2 storage helper (privado) pro Cropware Farm.
 *
 * Difere do CDM (`cropware/.../r2_storage.tsx`): la o bucket e PUBLICO via
 * dominio (storage.cropware.com.br) porque sao fotos de campo. Aqui guardamos
 * DOCUMENTO FISCAL (recibo, NF, boleto com CNPJ/valores) -> bucket PRIVADO,
 * acesso so via presigned URL de TTL curto. Sem R2_PUBLIC_URL.
 *
 * Usa aws4fetch (SigV4 leve) pra evitar o cold-start timeout do
 * @aws-sdk/client-s3 no edge Deno.
 *
 * Secrets esperados na edge farm-api:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME (ex: "cropware-farm-storage")
 */

import { AwsClient } from "npm:aws4fetch@1.0.20";

let _client: AwsClient | null = null;

function getR2Client(): AwsClient {
  if (_client) return _client;

  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 nao configurado. Defina R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY.",
    );
  }

  _client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return _client;
}

function getEndpoint(): string {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  if (!accountId) throw new Error("R2_ACCOUNT_ID nao configurado.");
  const bucket = Deno.env.get("R2_BUCKET_NAME") || "cropware-farm-storage";
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
): Promise<string> {
  const client = getR2Client();
  const url = `${getEndpoint()}/${key}`;

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
): Promise<string> {
  const client = getR2Client();
  const url = new URL(`${getEndpoint()}/${key}`);
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
export async function getFromR2(key: string): Promise<ArrayBuffer> {
  const client = getR2Client();
  const response = await client.fetch(`${getEndpoint()}/${key}`, {
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
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  const response = await client.fetch(`${getEndpoint()}/${key}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    throw new Error(`R2 delete falhou (${response.status}): ${text}`);
  }
}
