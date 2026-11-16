import { TIPOS, type TipoDeAtividade } from "./atividades";
import {
  contaNoRealizado,
  dataDoLancamento,
  dentroDaJanela,
  safraDaAtividade,
  type JanelaDeSafra,
  type LancamentoDoCampo,
} from "./custo";

/**
 * Custo por talhão — o relatório que justifica juntar o Field ao financeiro.
 * Função pura: recebe os dados já carregados e devolve as linhas.
 *
 * Duas colunas que NÃO se misturam (decisão de 16/11/2026):
 *   - agronômico: soma de `cost_total` das atividades REALIZADAS do talhão
 *     na safra (pelo plantio; sem plantio, pela data) ou no período;
 *   - realizado: lançamentos de despesa ligados ao talhão, pela data, dentro
 *     da janela (regra em `contaNoRealizado`).
 * O lançamento ligado só à FAZENDA vai para um bloco à parte, sem rateio.
 */
export interface TalhaoDoRelatorio {
  id: string;
  name: string;
  farm_id: string;
  area_ha: number;
}
export interface AtividadeDoRelatorio {
  type: TipoDeAtividade;
  date: string;
  status: "planejada" | "realizada";
  plot_id: string | null;
  planting_id: string | null;
  cost_total: number | null;
}
export type LancamentoDoRelatorio = LancamentoDoCampo;

export interface Filtro {
  /** Janela de datas (a da safra, ou o período livre). */
  janela: { starts_on: string; ends_on: string };
  /** Safra escolhida — a atividade com plantio entra pela safra dele. */
  safraId: string | null;
  /** Só esta fazenda (null = todas). */
  farmId: string | null;
}

export interface LinhaDeTalhao {
  talhao: TalhaoDoRelatorio;
  agronomico: number;
  realizado: number;
}
export interface Resultado {
  linhas: LinhaDeTalhao[];
  porTipo: { tipo: TipoDeAtividade; quantidade: number; valor: number }[];
  /** Lançamentos só da fazenda (sem talhão): por fazenda. */
  soDaFazenda: { farm_id: string; quantidade: number; valor: number }[];
  area: number;
  agronomico: number;
  realizado: number;
}

export function montarCustosPorTalhao(
  talhoes: TalhaoDoRelatorio[],
  atividades: AtividadeDoRelatorio[],
  lancamentos: LancamentoDoRelatorio[],
  safraDoPlantio: (plantingId: string) => string | null,
  safras: JanelaDeSafra[],
  f: Filtro,
): Resultado {
  const doFiltro = talhoes.filter((t) => !f.farmId || t.farm_id === f.farmId);
  const ids = new Set(doFiltro.map((t) => t.id));
  const agro = new Map<string, number>();
  const real = new Map<string, number>();
  const porTipo = new Map<
    TipoDeAtividade,
    { quantidade: number; valor: number }
  >();

  for (const a of atividades) {
    if (a.status !== "realizada" || !a.plot_id || !ids.has(a.plot_id)) continue;
    const entra = f.safraId
      ? safraDaAtividade(a, safraDoPlantio, safras) === f.safraId
      : dentroDaJanela(a.date, f.janela);
    if (!entra) continue;
    const v = a.cost_total ?? 0;
    agro.set(a.plot_id, (agro.get(a.plot_id) ?? 0) + v);
    if (TIPOS[a.type].comCusto) {
      const t = porTipo.get(a.type) ?? { quantidade: 0, valor: 0 };
      porTipo.set(a.type, { quantidade: t.quantidade + 1, valor: t.valor + v });
    }
  }

  const fazendaSo = new Map<string, { quantidade: number; valor: number }>();
  for (const r of lancamentos) {
    if (!contaNoRealizado(r) || !dentroDaJanela(dataDoLancamento(r), f.janela))
      continue;
    if (r.plot_id) {
      if (!ids.has(r.plot_id)) continue;
      real.set(r.plot_id, (real.get(r.plot_id) ?? 0) + Number(r.total_value));
    } else if (r.farm_id && (!f.farmId || r.farm_id === f.farmId)) {
      const x = fazendaSo.get(r.farm_id) ?? { quantidade: 0, valor: 0 };
      fazendaSo.set(r.farm_id, {
        quantidade: x.quantidade + 1,
        valor: x.valor + Number(r.total_value),
      });
    }
  }

  const linhas = doFiltro.map((t) => ({
    talhao: t,
    agronomico: agro.get(t.id) ?? 0,
    realizado: real.get(t.id) ?? 0,
  }));
  return {
    linhas,
    porTipo: [...porTipo.entries()]
      .map(([tipo, x]) => ({ tipo, ...x }))
      .sort((a, b) => b.valor - a.valor),
    soDaFazenda: [...fazendaSo.entries()].map(([farm_id, x]) => ({
      farm_id,
      ...x,
    })),
    area: doFiltro.reduce((s, t) => s + t.area_ha, 0),
    agronomico: linhas.reduce((s, l) => s + l.agronomico, 0),
    realizado: linhas.reduce((s, l) => s + l.realizado, 0),
  };
}

/** R$/ha sem dividir por zero. */
export const porHa = (valor: number, area: number) =>
  area > 0 ? valor / area : 0;
