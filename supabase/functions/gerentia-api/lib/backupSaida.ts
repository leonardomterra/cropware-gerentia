/**
 * Backup de SAÍDA — Etapa 3 de docs/BACKUP-E-RESTAURACAO.md.
 *
 * Retrato do usuário tirado ANTES de uma operação que não tem desfazer:
 * excluir a conta, ou desvinculá-lo da organização.
 *
 * A regra é a parte importante, e é emprestada do CDM (onde é a única peça do
 * sistema de backup que funciona de verdade): **se a gravação falhar, a operação
 * é abortada**. Não se apaga o que não se sabe repor.
 *
 * Retenção de 90 dias em vez dos 30 do diário — o pedido de "recupera o que era
 * do fulano" quase nunca chega no mesmo mês em que ele saiu. Mas TEM prazo:
 * guardar dado pessoal indefinidamente é exatamente o que um pedido de LGPD vai
 * cobrar (§6 do doc).
 *
 * Por que o pacote de USUÁRIO e não o da organização: ao excluir a conta,
 * `users_meta` cascateia junto e o e-mail some. O pacote congela a identidade e
 * vira o único lugar que guarda quem era a pessoa.
 *
 * Limite conhecido (§2 do doc): `farm_receipts.created_by` tem FK NO ACTION
 * para auth.users, entao usuario COM lancamento nem chega a ser apagavel — o
 * banco recusa. Este retrato cobre a exclusao de contas sem movimento e o
 * desvinculo, que e onde ele e plenamente restauravel.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { coletarUsuario } from "./backupColeta.ts";
import { gravarPacote } from "./backupGravacao.ts";

export interface RetratoDeSaida {
  chave: string;
  contagem: Record<string, number>;
  email: string | null;
}

/**
 * Tira o retrato. LANÇA se não conseguir — quem chama deve deixar o erro subir
 * e NÃO executar a operação destrutiva.
 */
export async function retratoDeSaida(
  admin: SupabaseClient,
  userId: string,
  porQuem: string | null,
): Promise<RetratoDeSaida> {
  const pacote = await coletarUsuario(admin, userId, "saida", porQuem);
  const r = await gravarPacote(admin, pacote);
  return {
    chave: r.chave,
    contagem: pacote.contagem,
    email: pacote.alvo.user_email ?? null,
  };
}
