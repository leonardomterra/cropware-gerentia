/**
 * Gravação de backup — Etapa 0 de docs/BACKUP-E-RESTAURACAO.md.
 *
 * Pega o pacote montado por backupColeta.ts, sobe no R2 e registra em
 * farm_backups. Separado da coleta de propósito: a coleta precisa ser testável
 * sem tocar em R2 nem em banco.
 *
 * ORDEM IMPORTA: sobe o arquivo PRIMEIRO, indexa depois. Se invertesse, uma
 * falha de upload deixaria linha no índice apontando para arquivo que não
 * existe — e o índice é o que a tela mostra e o que a restauração consulta.
 * Assim a única divergência possível é arquivo órfão no R2, que o expurgo
 * limpa e que não engana ninguém.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { uploadToR2 } from "./r2.ts";
import type { Pacote, TipoBackup } from "./backupColeta.ts";

/** Ver §6 do doc. `saida` e `pre-operacao` têm prazo maior, mas TÊM prazo. */
const DIAS_DE_RETENCAO: Record<TipoBackup, number> = {
  diario: 30,
  mensal: 365,
  manual: 90,
  saida: 90,
  "pre-operacao": 90,
};

export interface ResultadoGravacao {
  /** false quando nada mudou desde o último pacote igual. */
  gravou: boolean;
  chave: string;
  hash: string;
  bytes: number;
  /** Preenchido quando gravou:false — o pacote anterior, que segue valendo. */
  reaproveitouDe?: string;
}

function chaveDoPacote(p: Pacote): string {
  const dia = p.gerado_em.slice(0, 10);
  if (p.escopo === "geral") return `geral/${p.tipo}-${dia}.json`;
  const alvo = p.escopo === "usuario" ? p.alvo.user_id : p.alvo.organization_id;
  return `${p.escopo}/${alvo}/${p.tipo}-${dia}.json`;
}

function expiraEm(tipo: TipoBackup, agora: Date): string {
  const d = new Date(agora);
  d.setUTCDate(d.getUTCDate() + DIAS_DE_RETENCAO[tipo]);
  return d.toISOString();
}

/**
 * Grava o pacote, a não ser que ele seja idêntico ao anterior do mesmo alvo.
 *
 * Comparar por hash e pular é o que faz a lista de backups ter significado:
 * com dois usuários ativos, a maioria dos dias não muda nada, e 30 arquivos
 * idênticos escondem o único dia em que algo aconteceu.
 */
export async function gravarPacote(
  admin: SupabaseClient,
  pacote: Pacote,
): Promise<ResultadoGravacao> {
  const chave = chaveDoPacote(pacote);

  // ---- 1. o anterior do mesmo alvo/tipo tem o mesmo conteúdo? -------------
  let anterior = admin
    .from("farm_backups")
    .select("id, chave, hash, bytes, criado_em")
    .eq("escopo", pacote.escopo)
    .eq("tipo", pacote.tipo)
    .order("criado_em", { ascending: false })
    .limit(1);

  anterior = pacote.alvo.organization_id
    ? anterior.eq("organization_id", pacote.alvo.organization_id)
    : anterior.is("organization_id", null);
  anterior = pacote.alvo.user_id
    ? anterior.eq("user_id", pacote.alvo.user_id)
    : anterior.is("user_id", null);

  const { data: anteriores, error: eAnt } = await anterior;
  if (eAnt)
    throw new Error(`Consulta do backup anterior falhou: ${eAnt.message}`);

  const ultimo = anteriores?.[0];
  if (ultimo && ultimo.hash === pacote.hash) {
    return {
      gravou: false,
      chave: ultimo.chave as string,
      hash: pacote.hash,
      bytes: (ultimo.bytes as number) ?? 0,
      reaproveitouDe: ultimo.criado_em as string,
    };
  }

  // ---- 2. sobe o arquivo -------------------------------------------------
  const corpo = new TextEncoder().encode(JSON.stringify(pacote));
  await uploadToR2(chave, corpo, "application/json; charset=utf-8", "backups");

  // ---- 3. indexa ---------------------------------------------------------
  // Rodar duas vezes no mesmo dia ATUALIZA em vez de duplicar (o índice único
  // é por escopo+alvo+tipo+dia). O upsert do PostgREST não alcança um índice
  // com expressões, então a decisão é feita aqui.
  const agora = new Date(pacote.gerado_em);
  const linha = {
    escopo: pacote.escopo,
    organization_id: pacote.alvo.organization_id ?? null,
    user_id: pacote.alvo.user_id ?? null,
    tipo: pacote.tipo,
    versao: pacote.versao,
    chave,
    bytes: corpo.byteLength,
    hash: pacote.hash,
    contagem: pacote.contagem,
    identidade: pacote.alvo,
    criado_em: pacote.gerado_em,
    criado_por: pacote.gerado_por,
    expira_em: expiraEm(pacote.tipo, agora),
  };

  const doDia = ultimo && (ultimo.chave as string) === chave ? ultimo : null;
  const { error: eGrav } = doDia
    ? await admin.from("farm_backups").update(linha).eq("id", doDia.id)
    : await admin.from("farm_backups").insert(linha);

  if (eGrav) {
    // O arquivo já subiu. Falhar alto: um backup que existe no R2 e não no
    // índice é invisível para a tela e para a restauração — pior que não ter.
    throw new Error(
      `Arquivo subiu para ${chave} mas o índice falhou: ${eGrav.message}`,
    );
  }

  return { gravou: true, chave, hash: pacote.hash, bytes: corpo.byteLength };
}
