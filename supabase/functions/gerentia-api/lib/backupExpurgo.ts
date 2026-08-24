/**
 * Expurgo dos backups vencidos — Etapa 1 de docs/BACKUP-E-RESTAURACAO.md.
 *
 * Sem isto a retenção do §6 é só um número no documento: nada nunca sairia do
 * R2 nem do índice. Roda no mesmo cron do diário de propósito — a coisa que
 * cria e a coisa que limpa no mesmo lugar, para não existir a hipótese de uma
 * rodar por meses sem a outra.
 *
 * ORDEM: apaga do R2 PRIMEIRO, depois a linha do índice.
 *
 * É o contrário da gravação, e pelo mesmo motivo — o pior estado possível é uma
 * linha apontando para arquivo que não existe, porque é ela que a tela mostra e
 * a restauração consulta. Nesta ordem:
 *
 *   - falhou o R2  -> a linha fica, tenta de novo amanhã;
 *   - falhou a linha após o R2 ter apagado -> amanhã o `deleteFromR2` devolve
 *     404, que é tratado como sucesso, e a linha finalmente sai.
 *
 * Ou seja: se conserta sozinho nos dois casos.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { deleteFromR2 } from "./r2.ts";

/** Teto por rodada. Um backlog grande se resolve em dias, sem estourar o
 *  tempo da requisição do cron. */
const MAX_POR_RODADA = 200;

export interface ResultadoExpurgo {
  apagados: number;
  falhas: { chave: string; erro: string }[];
}

export async function expurgarVencidos(
  admin: SupabaseClient,
  agora = new Date(),
): Promise<ResultadoExpurgo> {
  const { data, error } = await admin
    .from("farm_backups")
    .select("id, chave")
    .not("expira_em", "is", null)
    .lt("expira_em", agora.toISOString())
    .limit(MAX_POR_RODADA);

  if (error) throw new Error(`Consulta do expurgo falhou: ${error.message}`);

  const falhas: ResultadoExpurgo["falhas"] = [];
  let apagados = 0;

  for (const linha of data ?? []) {
    const chave = linha.chave as string;
    try {
      await deleteFromR2(chave, "backups");
      const { error: eDel } = await admin
        .from("farm_backups")
        .delete()
        .eq("id", linha.id);
      if (eDel) throw new Error(eDel.message);
      apagados++;
    } catch (e) {
      falhas.push({ chave, erro: e instanceof Error ? e.message : String(e) });
    }
  }

  return { apagados, falhas };
}
