import type { Hono } from "npm:hono";
import { getUserClient, requireMaster } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { logAdminAction } from "../lib/adminAudit.ts";
import {
  coletarGeral,
  coletarOrganizacao,
  coletarUsuario,
  type TipoBackup,
} from "../lib/backupColeta.ts";
import { gravarPacote } from "../lib/backupGravacao.ts";
import { expurgarVencidos } from "../lib/backupExpurgo.ts";
import { requireCronSecret } from "../lib/cronGuard.ts";
import type { Pacote } from "../lib/backupColeta.ts";

/**
 * Backups — etapas 0 e 1 de docs/BACKUP-E-RESTAURACAO.md.
 *
 *   POST /admin/backups/run    disparo manual (master)
 *   GET  /admin/backups        lista o índice (master)
 *   POST /cron/daily-backup    o diário automático (pg_cron, 05:00 UTC)
 *
 * A restauração (etapa 2) e as telas (4 e 5) entram depois.
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
