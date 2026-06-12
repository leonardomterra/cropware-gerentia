import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Singleflight pra getUserById: deduplica chamadas concorrentes pra mesmo
 * userId, evitando rajada no GoTrue. Memoria de incidente do Cropware -
 * sem isso, em horario de pico a auth derrete.
 *
 * USAR APENAS EM HANDLERS READ-ONLY (GET /users/*, GET /receipts/*).
 * Nunca em mutate (PUT /users/:id) - voce pode ler estado stale.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function getAuthUserOnce(
  supabaseAdmin: SupabaseClient,
  userId: string,
) {
  const existing = inflight.get(userId);
  if (existing) return existing;

  const p = supabaseAdmin.auth.admin
    .getUserById(userId)
    .finally(() => inflight.delete(userId));

  inflight.set(userId, p);
  return p;
}
