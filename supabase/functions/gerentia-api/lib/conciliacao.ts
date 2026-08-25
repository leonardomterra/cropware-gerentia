/**
 * Conciliação de fatura — Etapa 5 de docs/CARTOES-E-FATURAS.md.
 *
 * Casa cada LINHA DA FATURA (o que o banco cobrou) com a COMPRA INFORMATIVA que
 * o usuário lançou no cartão. O que casa vira detalhe; **o que não casa é o que
 * ele nunca registrou** — e é isso que ele quer descobrir.
 *
 * A regra mora aqui, no servidor, e não na tela: a mesma conta vai ser usada
 * pelo WhatsApp quando ele responder "essa fatura tem 3 compras que você não
 * lançou", e duas implementações divergiriam na primeira correção.
 */

// deno-lint-ignore no-explicit-any
type Linha = Record<string, any>;

/** Dias de folga entre a data da compra e a que o usuário lançou. O cartão
 *  costuma postar a compra um ou dois dias depois; três cobre fim de semana. */
const FOLGA_DIAS = 3;

export type Confianca = "alta" | "media";

export interface ItemConciliado {
  item_id: string;
  /** Lançamento que explica esta linha, quando existe. */
  receipt_id: string | null;
  confianca: Confianca | null;
  /** Quais critérios bateram — a tela usa para explicar o casamento. */
  por: string[];
}

export interface Conciliacao {
  itens: ItemConciliado[];
  /** Linhas da fatura sem compra correspondente: o que o usuário não lançou. */
  nao_registrados: number;
  /**
   * Compras lançadas no cartão, no período, que NÃO apareceram nesta fatura.
   * Quase sempre é compra feita depois do fechamento — cai na próxima —, mas
   * também pega lançamento no cartão errado.
   */
  sobrando: { id: string; vendor: string | null; value: number; date: string | null }[];
}

function diasEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10));
  if (!Number.isFinite(ms)) return null;
  return Math.abs(ms) / 86400000;
}

/**
 * "POSTO IPIRANGA BR-163" e "Posto Ipiranga" têm que casar. Tira acento,
 * pontuação e as palavras curtas que só fazem volume.
 */
function normalizar(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .join(" ")
    .trim();
}

/** Uma contém a outra, ou partilham a primeira palavra significativa. */
function estabelecimentoParecido(a: string | null, b: string | null): boolean {
  const x = normalizar(a);
  const y = normalizar(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const px = x.split(" ")[0];
  const py = y.split(" ")[0];
  return px.length > 3 && px === py;
}

/**
 * @param itens  linhas da fatura (farm_receipt_items)
 * @param compras compras informativas do período, no cartão
 */
export function conciliar(itens: Linha[], compras: Linha[]): Conciliacao {
  // Cada compra explica NO MÁXIMO uma linha. Sem isso, um único "R$ 150 no
  // posto" lançado pelo usuário casaria com as três idas ao posto do mês e a
  // fatura pareceria toda conferida.
  const usadas = new Set<string>();
  const resultado: ItemConciliado[] = [];

  // Os pares mais fortes primeiro: um casamento por valor+data+nome não pode
  // perder a compra para um casamento só por valor de outra linha.
  const candidatos: {
    item: Linha;
    compra: Linha;
    conf: Confianca;
    por: string[];
    peso: number;
  }[] = [];

  for (const it of itens) {
    const valorItem = Number(it.total_value) || 0;
    for (const c of compras) {
      // VALOR é obrigatório e exato. Dinheiro não se aproxima: R$ 487,90 e
      // R$ 487,00 são compras diferentes, não a mesma com erro de digitação.
      if (Math.abs((Number(c.total_value) || 0) - valorItem) > 0.005) continue;

      const dias = diasEntre(it.purchase_date, c.transaction_date);
      const dataBate = dias !== null && dias <= FOLGA_DIAS;
      const nomeBate = estabelecimentoParecido(it.description, c.vendor);
      if (!dataBate && !nomeBate) continue;

      const por = ["valor"];
      if (dataBate) por.push("data");
      if (nomeBate) por.push("estabelecimento");
      candidatos.push({
        item: it,
        compra: c,
        conf: dataBate && nomeBate ? "alta" : "media",
        por,
        // Empate por data resolve pelo mais próximo.
        peso: (dataBate && nomeBate ? 100 : 50) - (dias ?? FOLGA_DIAS),
      });
    }
  }

  candidatos.sort((a, b) => b.peso - a.peso);
  const casadoPorItem = new Map<string, (typeof candidatos)[number]>();
  for (const cand of candidatos) {
    if (casadoPorItem.has(cand.item.id)) continue;
    if (usadas.has(cand.compra.id)) continue;
    casadoPorItem.set(cand.item.id, cand);
    usadas.add(cand.compra.id);
  }

  for (const it of itens) {
    const m = casadoPorItem.get(it.id);
    resultado.push({
      item_id: it.id,
      receipt_id: m ? m.compra.id : null,
      confianca: m ? m.conf : null,
      por: m ? m.por : [],
    });
  }

  return {
    itens: resultado,
    nao_registrados: resultado.filter((r) => !r.receipt_id).length,
    sobrando: compras
      .filter((c) => !usadas.has(c.id))
      .map((c) => ({
        id: c.id,
        vendor: c.vendor ?? null,
        value: Number(c.total_value) || 0,
        date: c.transaction_date ?? null,
      })),
  };
}
