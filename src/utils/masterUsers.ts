// Espelho (frontend) de supabase/functions/gerentia-api/lib/masterUsers.ts.
// Master = acesso de plataforma (gerir todos os usuários), gateado por email.
// Manter as duas listas em sincronia.

export const MASTER_EMAILS: string[] = [
  "leonardoterra.comercial@gmail.com",
  "contato@cropware.com.br",
];

export function isMasterUser(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return MASTER_EMAILS.some((m) => m.toLowerCase() === normalized);
}
