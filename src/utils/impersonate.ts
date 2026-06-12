// Impersonação ("login como") pro painel master.
// Fluxo: salva a sessão do master -> troca pela do alvo via OTP (magic link
// gerado no backend) -> recarrega. O banner mostra o estado e "Voltar" restaura
// a sessão do master. Tudo via appStorage (mesma persistência da sessão normal).

import {
  getStoredValue,
  removeStoredValue,
  setStoredValue,
} from "./appStorage";
import { getSessionTokens, persistSessionTokens } from "./sessionStorage";
import { supabase } from "./supabase/client";

const MASTER_ACCESS = "farm_imp_master_access";
const MASTER_REFRESH = "farm_imp_master_refresh";
const STATE = "farm_imp_state";

export interface ImpersonationState {
  targetEmail: string;
  targetName: string;
}

export async function startImpersonation(params: {
  hashedToken: string;
  targetEmail: string;
  targetName: string;
}): Promise<void> {
  // 1. guarda a sessão do master pra poder voltar
  const { accessToken, refreshToken } = await getSessionTokens();
  if (!accessToken || !refreshToken) {
    throw new Error("Sessão master incompleta — relogue antes de impersonar.");
  }
  await setStoredValue(MASTER_ACCESS, accessToken);
  await setStoredValue(MASTER_REFRESH, refreshToken);

  // 2. troca pela sessão do alvo via OTP (consome o magic link)
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: params.hashedToken,
    type: "magiclink",
  });
  if (error || !data.session) {
    await removeStoredValue(MASTER_ACCESS);
    await removeStoredValue(MASTER_REFRESH);
    throw new Error(error?.message || "Falha ao iniciar impersonação.");
  }

  await persistSessionTokens(
    data.session.access_token,
    data.session.refresh_token,
    data.session.expires_at ?? null,
  );
  await setStoredValue(
    STATE,
    JSON.stringify({
      targetEmail: params.targetEmail,
      targetName: params.targetName,
    }),
  );

  window.location.href = "/";
}

export async function getImpersonationState(): Promise<ImpersonationState | null> {
  const raw = await getStoredValue(STATE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImpersonationState;
  } catch {
    return null;
  }
}

export async function stopImpersonation(): Promise<void> {
  const access = await getStoredValue(MASTER_ACCESS);
  const refresh = await getStoredValue(MASTER_REFRESH);
  await removeStoredValue(STATE);
  await removeStoredValue(MASTER_ACCESS);
  await removeStoredValue(MASTER_REFRESH);
  if (access && refresh) {
    await persistSessionTokens(access, refresh, null);
  }
  window.location.href = "/admin";
}
