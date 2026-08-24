/**
 * Coletor de backup — Etapa 0 de docs/BACKUP-E-RESTAURACAO.md.
 *
 * Monta o PACOTE (formato v1) de uma organização, de um usuário ou do banco
 * inteiro. Não grava nada: quem grava é backupGravacao.ts. Separado de
 * propósito — a coleta é o que a restauração vai ter que saber ler de volta, e
 * misturá-la com R2 e índice tornaria impossível testá-la sozinha.
 *
 * Regras que moram aqui (as demais estão no doc):
 *
 *  - ORDEM DAS TABELAS é a de dependência (§9 do doc). A restauração percorre
 *    a mesma ordem; se divergirem, o restore quebra em FK e ninguém entende por
 *    quê. Por isso a lista é UMA só, exportada, e não duas cópias.
 *
 *  - IDENTIDADE CONGELADA. Não há FK para auth.users neste banco: quando a
 *    conta some, o e-mail gravado aqui é a única forma de saber de quem eram as
 *    linhas.
 *
 *  - HASH cobre só `tabelas`. Se cobrisse o arquivo, `gerado_em` mudaria o hash
 *    todo dia e a regra de "não gravar backup igual ao anterior" nunca
 *    dispararia.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Linha = Record<string, any>;

export type EscopoBackup = "geral" | "organizacao" | "usuario";
export type TipoBackup =
  | "diario"
  | "mensal"
  | "manual"
  | "saida"
  | "pre-operacao";

/** Versão do FORMATO do pacote. Ver §8 do doc antes de mexer. */
export const VERSAO_PACOTE = 1;

/**
 * Ordem de dependência. Coleta e restauração usam esta MESMA lista.
 *
 * `porUsuario` diz como recortar a tabela quando o escopo é 'usuario':
 *   'criador'  -> só linhas com created_by = a pessoa
 *   'dono'     -> a coluna user_id é a pessoa
 *   'contexto' -> é da organização inteira, entra como dependência para os
 *                 lançamentos dela fazerem sentido (e poderem ser inseridos:
 *                 lançamento aponta para centro de custo)
 *   'filha'    -> vem pelos pais já selecionados, não tem coluna própria
 */
export const TABELAS_DO_PACOTE: ReadonlyArray<{
  nome: string;
  porUsuario: "criador" | "dono" | "contexto" | "filha";
}> = [
  { nome: "organizations", porUsuario: "contexto" },
  { nome: "users_meta", porUsuario: "dono" },
  { nome: "farms", porUsuario: "contexto" },
  { nome: "farm_cost_centers", porUsuario: "contexto" },
  { nome: "farm_category_groups", porUsuario: "contexto" },
  { nome: "farm_categories", porUsuario: "contexto" },
  { nome: "farm_recurring_receipts", porUsuario: "criador" },
  { nome: "farm_receipts", porUsuario: "criador" },
  { nome: "farm_receipt_items", porUsuario: "filha" },
  { nome: "farm_tasks", porUsuario: "criador" },
  { nome: "farm_user_cost_centers", porUsuario: "dono" },
  { nome: "farm_whatsapp_links", porUsuario: "dono" },
  { nome: "farm_notifications", porUsuario: "dono" },
  { nome: "farm_org_invites", porUsuario: "contexto" },
  { nome: "farm_org_former_members", porUsuario: "contexto" },
  { nome: "farm_category_hidden", porUsuario: "contexto" },
] as const;

/** Ordem de dependência, para a restauração percorrer igual à coleta. */
export const ORDEM_DAS_TABELAS: string[] = TABELAS_DO_PACOTE.map((t) => t.nome);

/**
 * Tabelas que a restauração pode INSERIR mas não SOBRESCREVER.
 *
 * Só no pacote de usuário, e só o contexto da organização: se o centro de custo
 * sumiu junto, sem repor não há como inserir o lançamento dele; mas se ainda
 * existe e outra pessoa editou, não é dele para sobrescrever. Ver §3 do doc.
 */
export function tabelasSomenteInserir(escopo: EscopoBackup): string[] {
  return escopo === "usuario"
    ? TABELAS_DO_PACOTE.filter((t) => t.porUsuario === "contexto").map(
        (t) => t.nome,
      )
    : [];
}

export interface Pacote {
  versao: number;
  gerado_em: string;
  gerado_por: string | null;
  escopo: EscopoBackup;
  tipo: TipoBackup;
  alvo: {
    organization_id?: string | null;
    organization_name?: string | null;
    user_id?: string | null;
    user_email?: string | null;
    user_name?: string | null;
  };
  contagem: Record<string, number>;
  hash: string;
  tabelas: Record<string, Linha[]>;
}

/**
 * Teto por tabela. Diferente do export antigo, estourar aqui é ERRO e não corte
 * silencioso: backup truncado tem a mesma cara de um completo, e só se descobre
 * a diferença no dia em que ele era necessário.
 */
const MAX_LINHAS = 50_000;

/**
 * O construtor do PostgREST muda de tipo a cada `.eq()`/`.in()` encadeado, e as
 * tabelas aqui são escolhidas por NOME em tempo de execução — não há tipo
 * gerado para casar. `any` no filtro é deliberado; o que protege de errar o
 * nome de coluna é o teste da rota, não o compilador.
 */
// deno-lint-ignore no-explicit-any
type Consulta = any;

async function buscar(
  admin: SupabaseClient,
  tabela: string,
  filtro: (q: Consulta) => Consulta,
): Promise<Linha[]> {
  const q = filtro(admin.from(tabela).select("*"));
  const { data, error } = await q.limit(MAX_LINHAS + 1);
  if (error) throw new Error(`Coleta de ${tabela} falhou: ${error.message}`);
  const linhas = (data ?? []) as Linha[];
  if (linhas.length > MAX_LINHAS) {
    throw new Error(
      `Coleta de ${tabela} passou de ${MAX_LINHAS} linhas. ` +
        `Backup abortado: prefiro falhar alto a gravar pacote incompleto.`,
    );
  }
  return linhas;
}

/** sha-256 em hex do bloco de dados — a chave da regra "não gravar igual". */
async function hashDosDados(tabelas: Record<string, Linha[]>): Promise<string> {
  // Chaves ordenadas: a ordem em que o Postgres devolve as tabelas não é
  // garantida entre execuções, e sem ordenar o mesmo dado geraria hashes
  // diferentes — a regra do "não mudou nada" nunca pegaria.
  const estavel = JSON.stringify(
    Object.fromEntries(
      Object.keys(tabelas)
        .sort()
        .map((k) => [k, tabelas[k]]),
    ),
  );
  const bytes = new TextEncoder().encode(estavel);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function contar(tabelas: Record<string, Linha[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(tabelas)) if (v.length) out[k] = v.length;
  return out;
}

async function montar(
  escopo: EscopoBackup,
  tipo: TipoBackup,
  geradoPor: string | null,
  alvo: Pacote["alvo"],
  tabelas: Record<string, Linha[]>,
): Promise<Pacote> {
  return {
    versao: VERSAO_PACOTE,
    gerado_em: new Date().toISOString(),
    gerado_por: geradoPor,
    escopo,
    tipo,
    alvo,
    contagem: contar(tabelas),
    hash: await hashDosDados(tabelas),
    tabelas,
  };
}

/** Pacote de uma ORGANIZAÇÃO: tudo o que cascatearia se ela fosse apagada. */
export async function coletarOrganizacao(
  admin: SupabaseClient,
  organizationId: string,
  tipo: TipoBackup,
  geradoPor: string | null,
): Promise<Pacote> {
  const tabelas: Record<string, Linha[]> = {};

  for (const { nome } of TABELAS_DO_PACOTE) {
    // Toda tabela do pacote tem organization_id; a de organizations é a
    // própria linha. farm_receipt_items também tem a coluna, então não precisa
    // do desvio pelos pais que o escopo de usuário exige.
    tabelas[nome] =
      nome === "organizations"
        ? await buscar(admin, nome, (q) => q.eq("id", organizationId))
        : await buscar(admin, nome, (q) =>
            q.eq("organization_id", organizationId),
          );
  }

  const org = tabelas.organizations[0];
  if (!org) throw new Error(`Organização ${organizationId} não existe.`);

  return montar(
    "organizacao",
    tipo,
    geradoPor,
    {
      organization_id: organizationId,
      organization_name: org.name ?? null,
    },
    tabelas,
  );
}

/**
 * Pacote de um USUÁRIO: o que ele criou, mais o CONTEXTO da organização.
 *
 * O contexto não é enfeite — é dependência. O lançamento dele aponta para um
 * centro de custo; se o centro sumiu junto, sem ele no pacote o lançamento não
 * volta. A restauração repõe dependência que sumiu e não toca em dependência
 * que existe (§3 do doc).
 */
export async function coletarUsuario(
  admin: SupabaseClient,
  userId: string,
  tipo: TipoBackup,
  geradoPor: string | null,
): Promise<Pacote> {
  const { data: meta, error: eMeta } = await admin
    .from("users_meta")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (eMeta) throw new Error(`Leitura do perfil falhou: ${eMeta.message}`);

  const organizationId = (meta?.organization_id as string | null) ?? null;
  const tabelas: Record<string, Linha[]> = {};

  for (const { nome, porUsuario } of TABELAS_DO_PACOTE) {
    if (nome === "organizations") {
      tabelas[nome] = organizationId
        ? await buscar(admin, nome, (q) => q.eq("id", organizationId))
        : [];
      continue;
    }
    if (nome === "farm_receipt_items") continue; // vem pelos pais, logo abaixo

    if (porUsuario === "contexto") {
      tabelas[nome] = organizationId
        ? await buscar(admin, nome, (q) =>
            q.eq("organization_id", organizationId),
          )
        : [];
    } else if (porUsuario === "dono") {
      tabelas[nome] = await buscar(admin, nome, (q) => q.eq("user_id", userId));
    } else {
      tabelas[nome] = await buscar(admin, nome, (q) =>
        q.eq("created_by", userId),
      );
    }
  }

  // Itens vêm pelos lançamentos da pessoa: a tabela não tem created_by, e o
  // item herda o dono do pai (é a mesma regra da RLS).
  const idsDosPais = (tabelas.farm_receipts ?? []).map((r) => r.id as string);
  tabelas.farm_receipt_items = idsDosPais.length
    ? await buscar(admin, "farm_receipt_items", (q) =>
        q.in("receipt_id", idsDosPais),
      )
    : [];

  // Identidade congelada: sem FK para auth.users, isto é o que sobra quando a
  // conta é apagada.
  const { data: conta } = await admin.auth.admin.getUserById(userId);
  const org = tabelas.organizations[0];

  return montar(
    "usuario",
    tipo,
    geradoPor,
    {
      organization_id: organizationId,
      organization_name: org?.name ?? null,
      user_id: userId,
      user_email: conta?.user?.email ?? null,
      user_name: (meta?.full_name as string | null) ?? null,
    },
    tabelas,
  );
}

/** Pacote GERAL: o banco inteiro, sem recorte. Só master. */
export async function coletarGeral(
  admin: SupabaseClient,
  tipo: TipoBackup,
  geradoPor: string | null,
): Promise<Pacote> {
  const tabelas: Record<string, Linha[]> = {};
  for (const { nome } of TABELAS_DO_PACOTE) {
    tabelas[nome] = await buscar(admin, nome, (q) => q);
  }
  return montar("geral", tipo, geradoPor, {}, tabelas);
}
