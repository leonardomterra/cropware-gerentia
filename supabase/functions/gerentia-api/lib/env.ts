/**
 * Leitura de secrets com migracao de nome FARM -> GERENTIA.
 *
 * Historico: os secrets nasceram com "FARM" no nome (FARM_R2_*, FARM_CRON_SECRET,
 * WHATSAPP_FARM_BOT_*) pra nao colidir com os secrets do Studio quando o projeto
 * Supabase era compartilhado. Hoje o projeto e dedicado ao gerentia.app, entao a
 * convencao virou "GERENTIA".
 *
 * Pra cutover zero-downtime, `secret()` recebe o nome NOVO (com GERENTIA) e, se
 * ele ainda nao existir no env, cai pro nome legado trocando GERENTIA -> FARM.
 * Quando todos os secrets estiverem re-setados, pode-se remover os FARM_* antigos
 * (o fallback continua inofensivo).
 */
export function secret(name: string): string | undefined {
  const v = Deno.env.get(name);
  if (v !== undefined) return v;
  const legacy = name.replace("GERENTIA", "FARM");
  return legacy === name ? undefined : Deno.env.get(legacy);
}
