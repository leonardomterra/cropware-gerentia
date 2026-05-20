import { projectId } from "./supabase/info";
import { ensureSession } from "./supabase/client";
import { getSessionTokens } from "./sessionStorage";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/farm-api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`farm-api ${status} ${path}: ${body}`);
    this.name = "ApiError";
  }
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Wrapper sobre fetch pra chamadas ao farm-api.
 *
 * - Anexa Authorization Bearer com o access_token da sessao salva
 * - Em 401, tenta refresh da sessao via ensureSession() e UMA segunda tentativa
 * - Lanca ApiError em status nao-2xx (não tenta JSON.parse de erro)
 *
 * `path` deve comecar com /, ex: "/health", "/receipts", "/auth/signup".
 */
export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
  _isRetry = false,
): Promise<T> {
  const { body, headers: rawHeaders, ...rest } = options;
  const { accessToken } = await getSessionTokens();

  const headers: Record<string, string> = {
    accept: "application/json",
    ...(rawHeaders as Record<string, string> | undefined),
  };
  if (body !== undefined) {
    headers["content-type"] = headers["content-type"] ?? "application/json";
  }
  if (accessToken && !headers["authorization"]) {
    headers["authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });

  // 401 -> tenta refresh + retry uma vez
  if (res.status === 401 && !_isRetry) {
    await ensureSession();
    return api<T>(path, options, true);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text, path);
  }

  // 204 No Content / corpo vazio -> retorna undefined
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/**
 * Atalho pra GET sem body.
 */
export function apiGet<T = unknown>(
  path: string,
  options: Omit<ApiOptions, "method" | "body"> = {},
): Promise<T> {
  return api<T>(path, { ...options, method: "GET" });
}
