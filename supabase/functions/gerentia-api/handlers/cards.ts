import type { Hono } from "npm:hono";
import {
  getUserClient,
  requireFarmUser,
  requireCanWrite,
} from "../lib/userClient.ts";
import { conciliar } from "../lib/conciliacao.ts";

/**
 * Cartões de crédito — Etapa 2 de docs/CARTOES-E-FATURAS.md.
 *
 *   GET    /cards       lista
 *   POST   /cards       cadastra
 *   PATCH  /cards/:id   edita
 *   DELETE /cards/:id   remove
 *   GET    /faturas/:id/conciliacao   casa as linhas com as compras lançadas
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

  /**
   * CONCILIAÇÃO de uma fatura.
   *
   * Procura, entre as compras informativas do cartão no período, as que
   * explicam cada linha da fatura. Devolve o casamento — e, principalmente, o
   * que NÃO casou: são as compras que o usuário nunca lançou, que é o número
   * que ele quer ver.
   *
   * Tudo pelo cliente DO USUÁRIO: se a RLS não deixa ver a fatura, não há o que
   * conciliar.
   */
  app.get("/faturas/:id/conciliacao", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const { data: fatura, error: eF } = await client
        .from("farm_receipts")
        .select(
          "id, doc_type, card_id, transaction_date, items:farm_receipt_items!receipt_id(*)",
        )
        .eq("id", c.req.param("id"))
        .maybeSingle();
      if (eF) return c.json({ error: eF.message }, 400);
      if (!fatura) return c.json({ error: "not_found" }, 404);
      if (fatura.doc_type !== "fatura") {
        return c.json({ error: "nao_e_fatura" }, 400);
      }

      // Janela: 40 dias antes do fechamento. Um ciclo tem ~30; a folga cobre
      // fechamento irregular e compra lançada com data um pouco atrasada.
      const fim = String(fatura.transaction_date ?? "").slice(0, 10);
      if (!fim) {
        return c.json(
          {
            error: "sem_fechamento",
            detalhe:
              "A fatura precisa da data de fechamento para saber que período olhar.",
          },
          400,
        );
      }
      const inicio = new Date(Date.parse(fim) - 40 * 86400000)
        .toISOString()
        .slice(0, 10);

      let q = client
        .from("farm_receipts")
        .select("id, vendor, total_value, transaction_date, card_id")
        .eq("counts_in_total", false)
        .eq("payment_method", "cartao_credito")
        .gte("transaction_date", inicio)
        .lte("transaction_date", fim)
        .limit(500);
      // Com cartão na fatura, só as compras DAQUELE cartão (ou as sem cartão,
      // que são as lançadas antes de o vínculo existir). Sem cartão na fatura,
      // olha todas — é o melhor que dá, e a tela avisa que falta vincular.
      if (fatura.card_id) {
        q = q.or(`card_id.eq.${fatura.card_id},card_id.is.null`);
      }
      const { data: compras, error: eC } = await q;
      if (eC) return c.json({ error: eC.message }, 400);

      const itens = (fatura.items ?? []).filter(
        // deno-lint-ignore no-explicit-any
        (i: any) => !i.promoted_to_receipt_id,
      );
      return c.json(conciliar(itens, compras ?? []));
    } catch (resp) {
      if (resp instanceof Response) return resp;
      const msg = resp instanceof Error ? resp.message : String(resp);
      return c.json({ error: "conciliacao_falhou", detalhe: msg }, 500);
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
