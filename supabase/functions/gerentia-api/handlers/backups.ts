import type { Hono } from "npm:hono";
import { getUserClient, requireMaster } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { logAdminAction } from "../lib/adminAudit.ts";
import {
  coletarGeral,
  coletarOrganizacao,
  coletarUsuario,
  ORDEM_DAS_TABELAS,
  tabelasSomenteInserir,
  VERSAO_PACOTE,
  type TipoBackup,
} from "../lib/backupColeta.ts";
import { getFromR2, presignGetUrl } from "../lib/r2.ts";
import { gravarPacote } from "../lib/backupGravacao.ts";
import { expurgarVencidos } from "../lib/backupExpurgo.ts";
import { requireCronSecret } from "../lib/cronGuard.ts";
import type { Pacote } from "../lib/backupColeta.ts";

/**
 * Backups — etapas 0 e 1 de docs/BACKUP-E-RESTAURACAO.md.
 *
 *   POST /admin/backups/run          disparo manual (master)
 *   GET  /admin/backups              lista o índice (master)
 *   GET  /admin/backups/:id/url      link temporário para baixar (master)
 *   POST /admin/backups/:id/restore  pré-visualiza e restaura (master)
 *   POST /cron/daily-backup          o diário automático (pg_cron, 05:00 UTC)
 *
 * As telas (etapas 4 e 5) entram depois.
 *
 * As rotas de master existem de propósito enquanto não há tela: enquanto a
 * restauração não tem pré-visualização, ninguém além de quem entende o formato
 * deveria conseguir gerar pacote.
 */
export function mountBackupRoutes(app: Hono) {
  /**
   * Gera um pacote agora. `escopo`:
   *   'geral'        — o banco inteiro
   *   'organizacao'  — exige `id` da organização
   *   'usuario'      — exige `id` do usuário
   *
   * `tipo` default 'manual' (retenção de 90 dias). Passar 'diario' serve para
   * ensaiar o que o cron da etapa 1 vai fazer.
   */
  app.post("/admin/backups/run", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => ({}));
      const escopo = String(body.escopo ?? "");
      const id = body.id ? String(body.id) : null;
      const tipo = (body.tipo ?? "manual") as TipoBackup;

      if (!["geral", "organizacao", "usuario"].includes(escopo)) {
        return c.json({ error: "escopo_invalido" }, 400);
      }
      if (escopo !== "geral" && !id) {
        return c.json({ error: "id_obrigatorio" }, 400);
      }

      const admin = getSupabaseAdmin();
      const porQuem = auth.user?.id ?? null;

      const pacote =
        escopo === "geral"
          ? await coletarGeral(admin, tipo, porQuem)
          : escopo === "organizacao"
            ? await coletarOrganizacao(admin, id!, tipo, porQuem)
            : await coletarUsuario(admin, id!, tipo, porQuem);

      const r = await gravarPacote(admin, pacote);

      await logAdminAction(
        admin,
        c,
        auth.user,
        "backup_run",
        { id, email: pacote.alvo.user_email ?? null },
        { escopo, tipo, chave: r.chave, gravou: r.gravou, bytes: r.bytes },
      );

      return c.json({
        ok: true,
        escopo,
        tipo,
        alvo: pacote.alvo,
        contagem: pacote.contagem,
        chave: r.chave,
        bytes: r.bytes,
        hash: r.hash,
        // false = o conteúdo é idêntico ao pacote anterior deste alvo, então
        // não subiu arquivo novo. Não é erro: é a regra do §3 funcionando.
        gravou: r.gravou,
        reaproveitou_de: r.reaproveitouDe ?? null,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      // Erro de coleta/gravação vira 500 com a mensagem: numa rota que só o
      // master alcança, esconder o motivo só atrapalha quem vai consertar.
      const msg = resp instanceof Error ? resp.message : String(resp);
      return c.json({ error: "backup_falhou", detalhe: msg }, 500);
    }
  });

  /**
   * Link temporário para baixar o pacote. Presigned de 5 min, igual ao dos
   * anexos — o balde é privado e a URL não deve sobreviver ao clique.
   */
  app.get("/admin/backups/:id/url", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("farm_backups")
        .select("chave, identidade, contagem, criado_em")
        .eq("id", c.req.param("id"))
        .maybeSingle();
      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);

      return c.json({
        url: await presignGetUrl(data.chave as string, 300, "backups"),
        expira_em_segundos: 300,
        identidade: data.identidade,
        contagem: data.contagem,
        criado_em: data.criado_em,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      const msg = resp instanceof Error ? resp.message : String(resp);
      return c.json({ error: "url_falhou", detalhe: msg }, 500);
    }
  });

  /**
   * RESTAURAÇÃO — etapa 2.
   *
   * `{ aplicar: false }` (o default) só PRÉ-VISUALIZA: devolve quantas linhas
   * seriam repostas, sobrescritas e deixadas intactas, sem escrever nada.
   * `{ aplicar: true }` executa.
   *
   * O trabalho todo acontece dentro de `farm_restaurar_backup`, que é UMA
   * transação: várias tabelas em ordem de dependência, e uma falha no meio não
   * pode deixar metade restaurada — que é o pior estado possível, porque parece
   * que deu certo.
   */
  app.post("/admin/backups/:id/restore", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => ({}));
      const aplicar = body.aplicar === true;

      const admin = getSupabaseAdmin();
      const { data: registro, error: eReg } = await admin
        .from("farm_backups")
        .select("*")
        .eq("id", c.req.param("id"))
        .maybeSingle();
      if (eReg) return c.json({ error: eReg.message }, 400);
      if (!registro) return c.json({ error: "not_found" }, 404);

      const bytes = await getFromR2(registro.chave as string, "backups");
      const pacote = JSON.parse(new TextDecoder().decode(bytes));

      // Versão do formato: um pacote de amanhã lido pelo restaurador de hoje
      // entraria com colunas trocadas e sem erro nenhum. Melhor recusar.
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
      if (eRpc)
        return c.json(
          { error: "restauracao_falhou", detalhe: eRpc.message },
          500,
        );

      // Só o que APLICOU entra na auditoria. Pré-visualização é leitura, e
      // encher o log com ensaios esconderia as restaurações de verdade.
      if (aplicar) {
        await logAdminAction(
          admin,
          c,
          auth.user,
          "backup_restore",
          {
            id: (registro.user_id ?? registro.organization_id) as string | null,
            email:
              (registro.identidade as Record<string, string> | null)
                ?.user_email ?? null,
          },
          {
            chave: registro.chave,
            escopo: pacote.escopo,
            criado_em: registro.criado_em,
            total: resultado?.total,
          },
        );
      }

      return c.json({
        ok: true,
        aplicar,
        pacote: {
          escopo: pacote.escopo,
          tipo: pacote.tipo,
          gerado_em: pacote.gerado_em,
          alvo: pacote.alvo,
        },
        somente_inserir: tabelasSomenteInserir(pacote.escopo),
        resultado,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      const msg = resp instanceof Error ? resp.message : String(resp);
      return c.json({ error: "restauracao_falhou", detalhe: msg }, 500);
    }
  });

  /**
   * O DIÁRIO. Chamado pelo pg_cron às 05:00 UTC (02:00 de Brasília) — antes das
   * recorrências, que rodam 07:00 UTC e ESCREVEM lançamentos: o retrato do dia
   * tem que ser anterior a qualquer escrita automática.
   *
   * Faz um pacote por organização e um por usuário. A regra do hash cuida de
   * não gerar arquivo em dia sem mudança.
   *
   * No dia 1 do mês grava também um `mensal`, REAPROVEITANDO a mesma coleta —
   * é o mesmo conteúdo com outro prazo (12 meses contra 30 dias), então
   * coletar duas vezes seria só dobrar leitura do banco.
   *
   * Um alvo que falha NÃO derruba a rodada: numa tarefa que roda sozinha de
   * madrugada, parar tudo porque uma organização deu erro significaria perder o
   * backup de todas as outras. As falhas voltam na resposta e ficam no log.
   */
  app.post("/cron/daily-backup", async (c) => {
    const negado = requireCronSecret(c);
    if (negado) return negado;

    const admin = getSupabaseAdmin();
    const agora = new Date();
    // Dia 1: o mensal é o que sobrevive aos 30 dias do diário.
    const tipos: TipoBackup[] =
      agora.getUTCDate() === 1 ? ["diario", "mensal"] : ["diario"];

    const falhas: { alvo: string; erro: string }[] = [];
    let arquivos = 0;
    let inalterados = 0;

    async function rodar(rotulo: string, coletar: () => Promise<Pacote>) {
      try {
        const pacote = await coletar();
        for (const tipo of tipos) {
          const r = await gravarPacote(admin, { ...pacote, tipo });
          if (r.gravou) arquivos++;
          else inalterados++;
        }
      } catch (e) {
        falhas.push({
          alvo: rotulo,
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Organizações COM membro. As sem ninguém dentro não têm o que proteger, e
    // gerariam um arquivo por dia para sempre.
    const { data: membros } = await admin
      .from("users_meta")
      .select("user_id, organization_id")
      .not("organization_id", "is", null);

    const orgs = [
      ...new Set((membros ?? []).map((m) => m.organization_id as string)),
    ];
    for (const orgId of orgs) {
      await rodar(`org:${orgId}`, () =>
        coletarOrganizacao(admin, orgId, "diario", null),
      );
    }
    for (const m of membros ?? []) {
      const uid = m.user_id as string;
      await rodar(`usuario:${uid}`, () =>
        coletarUsuario(admin, uid, "diario", null),
      );
    }

    // Expurgo na mesma passada: quem cria e quem limpa juntos, para não haver a
    // hipótese de um rodar por meses sem o outro.
    let expurgo: Awaited<ReturnType<typeof expurgarVencidos>> | null = null;
    try {
      expurgo = await expurgarVencidos(admin, agora);
    } catch (e) {
      falhas.push({
        alvo: "expurgo",
        erro: e instanceof Error ? e.message : String(e),
      });
    }

    const resumo = {
      ok: falhas.length === 0,
      tipos,
      organizacoes: orgs.length,
      usuarios: (membros ?? []).length,
      arquivos_gravados: arquivos,
      sem_alteracao: inalterados,
      expurgados: expurgo?.apagados ?? 0,
      falhas,
    };
    console.log("[daily-backup]", JSON.stringify(resumo));
    // 200 mesmo com falha parcial: o pg_cron não tem para onde reportar, e
    // marcar a rodada inteira como erro esconderia o que funcionou.
    return c.json(resumo);
  });

  /** Índice dos pacotes, mais recentes primeiro. Filtros opcionais. */
  app.get("/admin/backups", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireMaster(client);
      if (auth.error) return auth.error;

      const admin = getSupabaseAdmin();
      let q = admin
        .from("farm_backups")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(Number(c.req.query("limit") ?? 100));

      const escopo = c.req.query("escopo");
      const orgId = c.req.query("organizationId");
      const userId = c.req.query("userId");
      if (escopo) q = q.eq("escopo", escopo);
      if (orgId) q = q.eq("organization_id", orgId);
      if (userId) q = q.eq("user_id", userId);

      const { data, error } = await q;
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ backups: data ?? [] });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
