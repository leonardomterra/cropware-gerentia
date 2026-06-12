// Fonte única (backend Deno) dos emails master do gerentia.app.
// Master = acesso de plataforma (gerir TODOS os usuários), gateado por email —
// NUNCA por role no banco (mais seguro: imune a bug de RLS / escalonamento).
//
// IMPORTANTE: manter em sincronia com o espelho do frontend em
// src/utils/masterUsers.ts (edge functions rodam em Deno e não importam de src/).

export const MASTER_EMAILS: string[] = [
  "leonardoterra.comercial@gmail.com",
  "contato@cropware.com.br",
];

/** true se o email pertence a um usuário master (case-insensitive, tolera null). */
export function isMasterUser(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return MASTER_EMAILS.some((m) => m.toLowerCase() === normalized);
}
