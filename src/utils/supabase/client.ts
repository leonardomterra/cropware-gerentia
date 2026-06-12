import { createClient } from "@supabase/supabase-js";
import { anonKey, supabaseUrl } from "./info";
import { getSessionTokens, persistSessionTokens } from "../sessionStorage";

export const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Single-flight: dedupe chamadas concorrentes de ensureSession() pra evitar
// corrida de refresh (varias requests expiram juntas; cada uma tentaria
// refrescar com o mesmo refresh_token, e a rotacao invalida as concorrentes).
let inflight: Promise<void> | null = null;

async function doEnsureSession(): Promise<void> {
  const { accessToken, refreshToken } = await getSessionTokens();
  if (!accessToken || !refreshToken) return;
  // setSession refresca automaticamente se o access_token estiver expirado,
  // retornando a sessao nova (access/refresh rotacionados).
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    console.warn("[ensureSession] Failed to set session:", error.message);
    return;
  }
  // CRITICO: persistir os tokens (possivelmente refrescados) de volta no
  // storage, senao o api() le o token velho no retry e toma 401 de novo.
  if (data.session) {
    await persistSessionTokens(
      data.session.access_token,
      data.session.refresh_token,
      data.session.expires_at ?? null,
    );
  }
}

/**
 * Garante que o cliente singleton tem a sessao do usuario aplicada (e renovada
 * se expirada), persistindo os tokens novos. Chamar antes de qualquer query que
 * dependa de RLS, e no retry de 401 do api().
 *
 * Persistencia da sessao e' manual via appStorage (Capacitor Preferences no
 * iOS, localStorage no web) - ver AuthContext. Por isso desligamos
 * persistSession/autoRefresh/detectSessionInUrl no createClient.
 */
export function ensureSession(): Promise<void> {
  if (!inflight) {
    inflight = doEnsureSession().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
