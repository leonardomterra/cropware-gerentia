import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isMasterUser } from "./masterUsers.ts";

/**
 * Cria um Supabase client autenticado como o usuario que enviou a request.
 * RLS scopes queries automaticamente. Usar pra qualquer operacao normal
 * (CRUD em tabelas do dominio do user).
 *
 * Para operacoes admin (bypass RLS, gerar signed URL pra Storage, etc.)
 * usar getSupabaseAdmin().
 *
 * Lanca se faltar Authorization header.
 */
export function getUserClient(req: Request): SupabaseClient {
  const auth = req.headers.get("authorization");
  if (!auth) {
    throw new Response(
      JSON.stringify({ error: "missing_authorization" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY obrigatorios no env.");
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type FarmRole = "owner" | "admin" | "member" | "viewer";

/**
 * Quem enxerga a organizacao inteira: gestor (owner/admin) e convidado (viewer).
 * Espelha public.farm_can_read_all() na RLS — a fonte de verdade e o banco;
 * isto aqui existe pra API poder montar resposta/erro sem ir ate a policy.
 */
export function roleCanReadAll(role: FarmRole | null): boolean {
  return role === "owner" || role === "admin" || role === "viewer";
}

/** Quem pode escrever alguma coisa: todos menos o convidado. Espelha farm_can_write(). */
export function roleCanWrite(role: FarmRole | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/** Gestor edita registro de terceiro? Hoje nao — espelha farm_can_write_others(). */
export function roleCanWriteOthers(_role: FarmRole | null): boolean {
  return false;
}

/**
 * Resolve o auth.users + organization_id + role do user atual.
 * Retorna 401 se nao autenticado, 403 se sem org linkada.
 */
export async function requireFarmUser(client: SupabaseClient) {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return {
      user: null,
      organizationId: null,
      role: null as FarmRole | null,
      canReadAll: false,
      canWrite: false,
      error: new Response(
        JSON.stringify({ error: "unauthenticated" }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    };
  }

  const { data: meta, error } = await client
    .from("users_meta")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !meta?.organization_id) {
    return {
      user,
      organizationId: null,
      role: null as FarmRole | null,
      canReadAll: false,
      canWrite: false,
      error: new Response(
        JSON.stringify({ error: "no_organization" }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    };
  }

  const role = (meta.role as FarmRole | null) || "member";
  return {
    user,
    organizationId: meta.organization_id as string,
    role,
    canReadAll: roleCanReadAll(role),
    canWrite: roleCanWrite(role),
    error: null,
  };
}

/**
 * Igual ao requireFarmUser mas falha 403 se role nao for owner/admin.
 * Usar em endpoints de gestao (cost centers, members, invites).
 */
export async function requireFarmAdmin(client: SupabaseClient) {
  const auth = await requireFarmUser(client);
  if (auth.error) return auth;
  if (auth.role !== "owner" && auth.role !== "admin") {
    return {
      ...auth,
      error: new Response(
        JSON.stringify({ error: "forbidden_admin_only" }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    };
  }
  return auth;
}

/**
 * Igual ao requireFarmUser mas falha 403 se o usuario for convidado (viewer).
 * A RLS ja bloqueia a escrita — isto existe pra devolver um erro claro em vez
 * de "0 linhas afetadas" ou um 400 cru do PostgREST.
 */
export async function requireCanWrite(client: SupabaseClient) {
  const auth = await requireFarmUser(client);
  if (auth.error) return auth;
  if (!auth.canWrite) {
    return {
      ...auth,
      error: new Response(
        JSON.stringify({ error: "forbidden_read_only" }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    };
  }
  return auth;
}

/**
 * Gating do painel MASTER (gestão de plataforma): autentica o usuário e exige
 * que o email esteja em MASTER_EMAILS. Diferente de requireFarmAdmin, NÃO
 * depende de organização — master opera sobre todas as orgs. Endpoints master
 * usam getSupabaseAdmin() (service role) pra operar bypassa RLS.
 */
export async function requireMaster(client: SupabaseClient) {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "unauthenticated" }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    };
  }
  if (!isMasterUser(user.email)) {
    return {
      user,
      error: new Response(
        JSON.stringify({ error: "forbidden_master_only" }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    };
  }
  return { user, error: null };
}
