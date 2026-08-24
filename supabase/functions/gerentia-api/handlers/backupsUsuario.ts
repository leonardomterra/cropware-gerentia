import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { getFromR2, presignGetUrl } from "../lib/r2.ts";
import {
  coletarOrganizacao,
  coletarUsuario,
  ORDEM_DAS_TABELAS,
  tabelasSomenteInserir,
  VERSAO_PACOTE,
} from "../lib/backupColeta.ts";
import { gravarPacote } from "../lib/backupGravacao.ts";

/**
 * Backups do PRÓPRIO usuário — Etapa 4 de docs/BACKUP-E-RESTAURACAO.md.
 *
 *   GET  /backups              lista (a RLS faz o recorte)
 *   POST /backups/run          gera um backup manual agora
 *   GET  /backups/:id/url      link temporário para baixar
 *   POST /backups/:id/restore  pré-visualiza e restaura
 *
 * Existe para o cliente não depender de mim numa emergência. Se o master
 * estiver indisponível, quem perdeu o dado consegue trazê-lo de volta sozinho.
 *
 * A LISTAGEM usa o cliente do usuário e deixa a RLS decidir (§4 do doc): membro
 * vê os backups do que ele criou, gestor e convidado veem os da organização.
 * Repetir a regra aqui daria duas fontes para divergir.
 *
 * A RESTAURAÇÃO não pode fazer o mesmo: ela roda com service_role, que passa por
 * cima da RLS. Aqui a permissão é checada À MÃO, contra o registro do backup, e
 * é a única barreira que existe — por isso mora numa função só, logo abaixo.
 */

/** Quem pode restaurar ESTE pacote. Ver §4 do doc. */
function podeRestaurar(
  registro: {
    escopo: string;
    user_id: string | null;
    organization_id: string | null;
  },
  auth: {
    user: { id: string } | null;
    organizationId: string | null;
    role: string | null;
  },
): { ok: true } | { ok: false; motivo: string } {
  // Convidado lê e baixa, não restaura: restaurar é escrita, e viewer não
  // escreve em lugar nenhum do app.
  if (auth.role === "viewer") {
    return { ok: false, motivo: "convidado_nao_restaura" };
  }

  // O próprio: sempre pode, é o dado que ele criou.
  if (registro.escopo === "usuario" && registro.user_id === auth.user?.id) {
    return { ok: true };
  }

  // Gestor: a organização inteira, inclusive os pacotes por usuário dos
  // colegas. Sobrescreve linha de outra pessoa, e é deliberado — espelha o que
  // ele já lê e administra. A pré-visualização mostra o tamanho antes.
  const gestor = auth.role === "owner" || auth.role === "admin";
  if (
    gestor &&
    registro.organization_id &&
    registro.organization_id === auth.organizationId
  ) {
    return { ok: true };
  }

  return { ok: false, motivo: "sem_permissao_para_este_backup" };
}

export function mountBackupUsuarioRoutes(app: Hono) {
  app.get("/backups", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      // Cliente DO USUÁRIO, de propósito: o recorte é da RLS.
      const { data, error } = await client
        .from("farm_backups")
        .select(
          "id, escopo, tipo, organization_id, user_id, bytes, contagem, identidade, criado_em, expira_em",
        )
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error) return c.json({ error: error.message }, 400);

      return c.json({
        backups: data ?? [],
        // A tela usa isto para decidir o que mostrar, sem reimplementar a regra.
        pode_restaurar: auth.role !== "viewer",
        meu_user_id: auth.user?.id ?? null,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * Backup manual, agora. O diário já roda sozinho; isto existe para o momento
   * "vou mexer em muita coisa, quero um ponto de retorno de antes".
   *
   * Escopo próprio por padrão. Gestor pode pedir o da organização.
   * Convidado não gera: é escrita.
   */
  app.post("/backups/run", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      if (auth.role === "viewer") {
        return c.json({ error: "convidado_nao_gera_backup" }, 403);
      }

      const body = await c.req.json().catch(() => ({}));
      const daOrganizacao = body.escopo === "organizacao";
      const gestor = auth.role === "owner" || auth.role === "admin";
      if (daOrganizacao && !gestor) {
        return c.json({ error: "apenas_gestor" }, 403);
      }

      const admin = getSupabaseAdmin();
      const pacote = daOrganizacao
        ? await coletarOrganizacao(
            admin,
            auth.organizationId!,
            "manual",
            auth.user!.id,
          )
        : await coletarUsuario(admin, auth.user!.id, "manual", auth.user!.id);
      const r = await gravarPacote(admin, pacote);

      return c.json({
        ok: true,
        escopo: pacote.escopo,
        contagem: pacote.contagem,
        // false = nada mudou desde o último manual, o arquivo anterior continua
        // valendo. Não é erro, e a tela precisa dizer isso em vez de "falhou".
        gravou: r.gravou,
        bytes: r.bytes,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      const msg = resp instanceof Error ? resp.message : String(resp);
      return c.json({ error: "backup_falhou", detalhe: msg }, 500);
    }
  });

  app.get("/backups/:id/url", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      // Lido pelo cliente DO USUÁRIO: se a RLS não deixa ver, não existe link.
      const { data, error } = await client
        .from("farm_backups")
        .select("chave, criado_em, contagem")
        .eq("id", c.req.param("id"))
        .maybeSingle();
      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);

      return c.json({
        url: await presignGetUrl(data.chave as string, 300, "backups"),
        expira_em_segundos: 300,
        criado_em: data.criado_em,
        contagem: data.contagem,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      const msg = resp instanceof Error ? resp.message : String(resp);
      return c.json({ error: "url_falhou", detalhe: msg }, 500);
    }
  });

  app.post("/backups/:id/restore", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => ({}));
      const aplicar = body.aplicar === true;

      // Lê pela RLS primeiro: nem chega a existir para quem não pode ver.
      const { data: registro, error: eReg } = await client
        .from("farm_backups")
        .select(
          "id, escopo, tipo, user_id, organization_id, chave, criado_em, identidade",
        )
        .eq("id", c.req.param("id"))
        .maybeSingle();
      if (eReg) return c.json({ error: eReg.message }, 400);
      if (!registro) return c.json({ error: "not_found" }, 404);

      const permissao = podeRestaurar(registro, auth);
      if (!permissao.ok) return c.json({ error: permissao.motivo }, 403);

      const admin = getSupabaseAdmin();
      const bytes = await getFromR2(registro.chave as string, "backups");
      const pacote = JSON.parse(new TextDecoder().decode(bytes));

      if (pacote.versao !== VERSAO_PACOTE) {
        return c.json(
          {
            error: "versao_incompativel",
            do_pacote: pacote.versao,
            suportada: VERSAO_PACOTE,
          },
          409,
        );
      }

      const { data: resultado, error: eRpc } = await admin.rpc(
        "farm_restaurar_backup",
        {
          p_ordem: ORDEM_DAS_TABELAS,
          p_tabelas: pacote.tabelas,
          p_somente_inserir: tabelasSomenteInserir(pacote.escopo),
          p_aplicar: aplicar,
        },
      );
      if (eRpc) {
        return c.json(
          { error: "restauracao_falhou", detalhe: eRpc.message },
          500,
        );
      }

      // Restauração feita pelo cliente também vai para o log do master: é
      // escrita em massa, e é o tipo de coisa que se precisa saber quem fez
      // quando alguém perguntar "por que voltou o valor antigo?".
      if (aplicar) {
        await admin.from("farm_admin_audit").insert({
          actor_user_id: auth.user?.id ?? null,
          actor_email: auth.user?.email ?? null,
          action: "backup_restore_usuario",
          target_user_id: registro.user_id,
          detail: {
            backup_id: registro.id,
            chave: registro.chave,
            escopo: registro.escopo,
            criado_em: registro.criado_em,
            total: resultado?.total,
          },
        });
      }

      return c.json({
        ok: true,
        aplicar,
        pacote: {
          escopo: pacote.escopo,
          tipo: pacote.tipo,
          gerado_em: pacote.gerado_em,
        },
        resultado,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      const msg = resp instanceof Error ? resp.message : String(resp);
      return c.json({ error: "restauracao_falhou", detalhe: msg }, 500);
    }
  });
}
