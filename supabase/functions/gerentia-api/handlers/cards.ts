import type { Hono } from "npm:hono";
import {
  getUserClient,
  requireFarmUser,
  requireCanWrite,
} from "../lib/userClient.ts";

/**
 * Cartões de crédito — Etapa 2 de docs/CARTOES-E-FATURAS.md.
 *
 *   GET    /cards       lista
 *   POST   /cards       cadastra
 *   PATCH  /cards/:id   edita
 *   DELETE /cards/:id   remove
 *
 * TODAS usam o cliente DO USUÁRIO, nunca service_role. Quem decide quem vê e
 * quem opera é a RLS de `farm_cards`, que por sua vez reusa
 * `farm_can_read_all()` e `farm_can_write_others()` — as mesmas de lançamentos.
 * Repetir a regra aqui daria duas fontes para divergir, e a do banco é a que
 * vale de verdade.
 *
 * Na prática: o dono opera o cartão dele; o gestor consulta os de todos e opera
 * só o seu, porque `farm_can_write_others()` é false hoje.
 */

/** Campos que o cliente pode gravar. `organization_id` e `user_id` NÃO entram:
 *  vêm da sessão, senão daria para cadastrar cartão no nome de outra pessoa. */
const CAMPOS = [
  "nome",
  "bandeira",
  "emissor",
  "ultimos_digitos",
  "dia_fechamento",
  "dia_vencimento",
  "limite",
  "ativo",
] as const;

function corpoLimpo(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CAMPOS) if (k in body) out[k] = body[k];
  // Em branco vira NULL: "" num campo opcional depois se confunde com
  // preenchido-e-vazio na hora de casar a fatura pelos 4 dígitos.
  for (const k of ["bandeira", "emissor", "ultimos_digitos"]) {
    if (out[k] === "") out[k] = null;
  }
  return out;
}

export function mountCardRoutes(app: Hono) {
  app.get("/cards", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const { data, error } = await client
        .from("farm_cards")
        .select("*")
        .order("ativo", { ascending: false })
        .order("nome");
      if (error) return c.json({ error: error.message }, 400);

      return c.json({
        cards: data ?? [],
        // A tela precisa saber quais são "meus" para decidir o que deixa
        // editar, sem reimplementar a regra da RLS.
        meu_user_id: auth.user?.id ?? null,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/cards", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireCanWrite(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => ({}));
      const nome = String(body.nome ?? "").trim();
      if (!nome) return c.json({ error: "nome_obrigatorio" }, 400);

      const { data, error } = await client
        .from("farm_cards")
        .insert({
          ...corpoLimpo(body),
          nome,
          organization_id: auth.organizationId,
          // Sempre o próprio: a RLS recusaria outro, mas errar aqui daria um
          // 403 sem explicação em vez de um cadastro certo.
          user_id: auth.user!.id,
        })
        .select()
        .single();

      if (error) {
        // 23505 = índice único (organization_id, emissor, 4 dígitos).
        if (error.code === "23505") {
          return c.json(
            {
              error: "cartao_duplicado",
              detalhe: "Já existe um cartão deste emissor com esses 4 dígitos.",
            },
            409,
          );
        }
        return c.json({ error: error.message }, 400);
      }
      return c.json({ card: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.patch("/cards/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireCanWrite(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => ({}));
      const patch = corpoLimpo(body);
      if (typeof patch.nome === "string") {
        patch.nome = patch.nome.trim();
        if (!patch.nome) return c.json({ error: "nome_obrigatorio" }, 400);
      }
      patch.updated_at = new Date().toISOString();

      const { data, error } = await client
        .from("farm_cards")
        .update(patch)
        .eq("id", c.req.param("id"))
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          return c.json(
            {
              error: "cartao_duplicado",
              detalhe: "Já existe um cartão deste emissor com esses 4 dígitos.",
            },
            409,
          );
        }
        return c.json({ error: error.message }, 400);
      }
      // Sem linha = a RLS barrou (cartão de outra pessoa) ou não existe. Os dois
      // casos são 404 de propósito: dizer "existe mas não é seu" contaria a
      // quem não pode ver que ele existe.
      if (!data) return c.json({ error: "not_found" }, 404);
      return c.json({ card: data });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.delete("/cards/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireCanWrite(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");

      // Cartão COM lançamento não se apaga: as faturas dele perderiam o vínculo
      // (o FK é SET NULL) e o histórico ficaria sem dizer de qual cartão era.
      // O caminho certo é desativar — some dos seletores, fica no histórico.
      const { count } = await client
        .from("farm_receipts")
        .select("id", { count: "exact", head: true })
        .eq("card_id", id);

      if ((count ?? 0) > 0) {
        return c.json(
          {
            error: "cartao_em_uso",
            lancamentos: count,
            detalhe:
              "Este cartão tem lançamentos. Desative em vez de excluir, para o histórico não perder o vínculo.",
          },
          409,
        );
      }

      const { error, count: apagados } = await client
        .from("farm_cards")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) return c.json({ error: error.message }, 400);
      if (!apagados) return c.json({ error: "not_found" }, 404);
      return c.json({ ok: true });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
