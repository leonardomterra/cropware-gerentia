import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

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

/**
 * Resolve o auth.users + organization_id do user atual.
 * Retorna 401 (via Response) se nao autenticado, 403 se sem org linkada.
 */
export async function requireFarmUser(client: SupabaseClient) {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return {
      user: null,
      organizationId: null,
      error: new Response(
        JSON.stringify({ error: "unauthenticated" }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    };
  }

  const { data: meta, error } = await client
    .from("users_meta")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !meta?.organization_id) {
    return {
      user,
      organizationId: null,
      error: new Response(
        JSON.stringify({ error: "no_organization" }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    };
  }

  return { user, organizationId: meta.organization_id as string, error: null };
}
