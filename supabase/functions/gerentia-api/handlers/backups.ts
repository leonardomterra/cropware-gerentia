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

/**
 * Backups — Etapa 0 de docs/BACKUP-E-RESTAURACAO.md.
 *
 * Por enquanto SÓ o disparo manual do master. O diário automático (etapa 1), a
 * restauração (etapa 2) e as telas (4 e 5) entram depois, cada um na sua etapa.
 *
 *   POST /admin/backups/run   { escopo, id?, tipo? }
 *   GET  /admin/backups       lista o índice
 *
 * Só master de propósito: enquanto não existe pré-visualização de restauração,
 * ninguém além de quem entende o formato deveria conseguir gerar pacote.
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
