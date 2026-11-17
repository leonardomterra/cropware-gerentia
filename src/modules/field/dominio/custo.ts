import {
  TIPOS,
  type DetalhesDaAtividade,
  type ProdutoDaAtividade,
  type TipoDeAtividade,
} from "./atividades";

/**
 * As contas de custo do módulo Field — funções puras, sem banco e sem React,
 * para serem testadas isoladas (ver docs/UNIFICACAO-FIELD.md §5).
 *
 * DOIS CUSTOS, LADO A LADO (decisão de 16/11/2026), sem um gerar o outro:
 *   - AGRONÔMICO: o que a atividade diz (R$/ha × área). Estimativa.
 *   - REALIZADO: o que foi lançado no financeiro, ligado à fazenda/talhão.
 */

/** Área em que a atividade incide: a parcial digitada, ou a do plantio/talhão. */
export function areaDaAtividade(a: {
  area_type: "total" | "partial";
  treated_area_ha: number | null;
  /** Área do plantio (parcial) ou do talhão; null = atividade da fazenda. */
  areaDoAlvo: number | null;
}): number {
  if (a.area_type === "partial") return a.treated_area_ha ?? 0;
  return a.areaDoAlvo ?? 0;
}

/** Área do plantio: a parcial dele, ou a do talhão inteiro. */
export function areaDoPlantio(
  p: { area_type: "total" | "partial"; partial_area_ha: number | null },
  areaDoTalhao: number,
): number {
  return p.area_type === "partial" ? (p.partial_area_ha ?? 0) : areaDoTalhao;
}

/** R$/ha da atividade, conforme o tipo. 0 quando o tipo não tem custo. */
export function custoPorHa(
  tipo: TipoDeAtividade,
  produtos: ProdutoDaAtividade[],
  d: DetalhesDaAtividade,
): number {
  if (!TIPOS[tipo].comCusto) return 0;
  if (TIPOS[tipo].comProdutos) {
    return produtos.reduce((s, p) => s + (p.custo_ha ?? 0), 0);
  }
  if (tipo === "liming" || tipo === "plastering") {
    return (d.corretivo_dose ?? 0) * (d.corretivo_preco ?? 0);
  }
  if (tipo === "irrigation") {
    return (d.lamina_mm ?? 0) * (d.custo_mm_ha ?? 0);
  }
  // Colheita e plantio: R$/ha digitado direto.
  return d.custo_ha ?? 0;
}

/** Custo total em R$ (arredondado em centavos) — o que vai para cost_total. */
export function custoDaAtividade(
  tipo: TipoDeAtividade,
  produtos: ProdutoDaAtividade[],
  d: DetalhesDaAtividade,
  area: number,
): number {
  return Math.round(custoPorHa(tipo, produtos, d) * area * 100) / 100;
}

export interface JanelaDeSafra {
  id: string;
  starts_on: string;
  ends_on: string;
}

/** A data (ISO "aaaa-mm-dd") está dentro da janela, inclusive as pontas. */
export function dentroDaJanela(
  data: string | null,
  j: { starts_on: string; ends_on: string },
): boolean {
  if (!data) return false;
  const d = data.slice(0, 10);
  return d >= j.starts_on && d <= j.ends_on;
}

/**
 * Safra de uma atividade: a do plantio; sem plantio (ou plantio sem safra), a
 * safra cuja janela contém a data da atividade.
 */
export function safraDaAtividade(
  a: { date: string; planting_id: string | null },
  safraDoPlantio: (plantingId: string) => string | null,
  safras: JanelaDeSafra[],
): string | null {
  if (a.planting_id) {
    const s = safraDoPlantio(a.planting_id);
    if (s) return s;
  }
  return safras.find((j) => dentroDaJanela(a.date, j))?.id ?? null;
}

/** O que importa de um lançamento para o custo realizado. */
export interface LancamentoDoCampo {
  farm_id: string | null;
  plot_id: string | null;
  total_value: number;
  direction: "expense" | "income";
  status: string;
  doc_type: string;
  is_estimated: boolean | null;
  transaction_date: string | null;
  paid_date: string | null;
  /** Só para mostrar (relatório do plantio). */
  description?: string | null;
}

/**
 * Entra no custo REALIZADO do Field?
 *
 *   - só despesa ligada a fazenda ou talhão;
 *   - fora: previsto (is_estimated), cancelado e FATURA de cartão;
 *   - DENTRO mesmo com counts_in_total = false. A compra no cartão ligada ao
 *     talhão nasce "informativa" no financeiro (quem soma é a fatura, para não
 *     contar duas vezes). Só que a fatura não tem talhão: se a regra do
 *     financeiro valesse aqui, TODO gasto no cartão sumiria do custo do
 *     talhão. Aqui é o inverso: conta a compra, nunca a fatura.
 */
export function contaNoRealizado(r: LancamentoDoCampo): boolean {
  return (
    r.direction === "expense" &&
    (r.farm_id != null || r.plot_id != null) &&
    !r.is_estimated &&
    r.status !== "cancelado" &&
    r.doc_type !== "fatura"
  );
}

/** Data que vale para o período: a do pagamento, senão a do lançamento. */
export function dataDoLancamento(r: LancamentoDoCampo): string | null {
  return r.paid_date || r.transaction_date;
}
