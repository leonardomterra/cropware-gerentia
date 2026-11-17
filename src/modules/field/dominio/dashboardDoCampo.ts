/**
 * Dashboard do Field (17/11/2026) — montagem pura, sem tela.
 *
 * No molde do dashboard do Flag Field (src/components/Dashboard.tsx de lá):
 * números do topo, clima e três colunas — próximas colheitas, próximas
 * atividades e últimas avaliações. Entra no lugar do antigo bloco "Campo" que
 * ficava no fim do Dashboard do Finanças: com o módulo Field ativo, o
 * Dashboard É o do campo.
 */
import { somarDias } from "@/modules/tasks/agrupar";
import { areaDoPlantio, dentroDaJanela } from "./custo";
import { montarCustosPorTalhao, porHa } from "./relatorioDeCustos";
import type {
  Atividade,
  AvaliacaoDoEnsaio,
  Ensaio,
  EtapaDoEnsaio,
  Fazenda,
  Plantio,
  ProdutoNoEnsaio,
  Safra,
  Talhao,
} from "../types";

/** Quantos itens cada coluna mostra (o resto está na tela de origem). */
export const ITENS_POR_COLUNA = 5;
/** Janela das "próximas" atividades. */
const DIAS_DE_ATIVIDADE = 14;

export interface EntradaDoDashboard {
  fazendas: Fazenda[];
  talhoes: Talhao[];
  plantios: Plantio[];
  safras: Safra[];
  atividades: Atividade[];
  ensaios: Ensaio[];
  produtosDosEnsaios: ProdutoNoEnsaio[];
  etapas: EtapaDoEnsaio[];
  avaliacoes: AvaliacaoDoEnsaio[];
  /** Lançamentos do financeiro ligados a talhão (custo realizado). */
  lancamentos: Parameters<typeof montarCustosPorTalhao>[2];
}

export interface DashboardDoCampo {
  numeros: {
    talhoes: number;
    areaTotal: number;
    plantiosAtivos: number;
    areaPlantada: number;
    atividadesProximas: number;
    atividadesAtrasadas: number;
    ensaiosAtivos: number;
    /** Avaliações de ensaio registradas nos últimos 30 dias. */
    avaliacoesRecentes: number;
    proximaColheita: { plantio: Plantio; dias: number } | null;
    custo: { safra: Safra; realizado: number; porHa: number } | null;
  };
  colheitas: { plantio: Plantio; talhao: string | null; dias: number }[];
  atividades: {
    atividade: Atividade;
    talhao: string | null;
    dias: number;
    atrasada: boolean;
  }[];
  avaliacoes: {
    avaliacao: AvaliacaoDoEnsaio;
    ensaio: Ensaio;
    etapa: string | null;
    produto: string | null;
  }[];
}

/** Dias corridos de `de` até `ate` (datas ISO, sem fuso). */
export function diasEntre(de: string, ate: string): number {
  const d = (s: string) =>
    Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(ate) - d(de)) / 86_400_000);
}

export function montarDashboardDoCampo(
  e: EntradaDoDashboard,
  hoje: string,
): DashboardDoCampo {
  const talhao = new Map(e.talhoes.map((t) => [t.id, t]));
  const nomeDoTalhao = (id: string | null) =>
    id ? (talhao.get(id)?.name ?? null) : null;

  const ativos = e.plantios.filter((p) => p.lifecycle === "active");
  const areaPlantada = ativos.reduce(
    (s, p) => s + areaDoPlantio(p, talhao.get(p.plot_id)?.area_ha ?? 0),
    0,
  );

  // Colheitas: plantios não encerrados com previsão de hoje em diante.
  const colheitas = e.plantios
    .filter(
      (p) =>
        p.lifecycle !== "completed" &&
        p.expected_harvest_date &&
        p.expected_harvest_date >= hoje,
    )
    .sort((a, b) =>
      a.expected_harvest_date!.localeCompare(b.expected_harvest_date!),
    )
    .map((plantio) => ({
      plantio,
      talhao: nomeDoTalhao(plantio.plot_id),
      dias: diasEntre(hoje, plantio.expected_harvest_date!),
    }));

  // Atividades planejadas: as ATRASADAS primeiro (as que pedem ação), depois
  // as dos próximos 14 dias, da mais próxima para a mais distante.
  const planejadas = e.atividades.filter((x) => x.status === "planejada");
  const atrasadas = planejadas
    .filter((x) => x.date < hoje)
    .sort((a, b) => a.date.localeCompare(b.date));
  const limite = somarDias(hoje, DIAS_DE_ATIVIDADE);
  const proximas = planejadas
    .filter((x) => x.date >= hoje && x.date <= limite)
    .sort((a, b) => a.date.localeCompare(b.date));
  const atividades = [...atrasadas, ...proximas].map((atividade) => ({
    atividade,
    talhao: nomeDoTalhao(atividade.plot_id),
    dias: diasEntre(hoje, atividade.date),
    atrasada: atividade.date < hoje,
  }));

  // Últimas avaliações de ensaio, da mais recente.
  const ensaio = new Map(e.ensaios.map((x) => [x.id, x]));
  const etapa = new Map(e.etapas.map((x) => [x.id, x]));
  const produto = new Map(e.produtosDosEnsaios.map((x) => [x.id, x]));
  const avaliacoes = [...e.avaliacoes]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.created_at.localeCompare(a.created_at),
    )
    .flatMap((avaliacao) => {
      const en = ensaio.get(avaliacao.trial_id);
      if (!en) return [];
      const et = avaliacao.step_id ? etapa.get(avaliacao.step_id) : null;
      return [
        {
          avaliacao,
          ensaio: en,
          etapa: et ? (et.stage ?? et.evaluation_type) : null,
          produto: produto.get(avaliacao.product_id)?.name ?? null,
        },
      ];
    });

  // Custo da safra vigente: realizado (financeiro do talhão + agronômico).
  const safra = e.safras.find((s) => dentroDaJanela(hoje, s)) ?? null;
  const plantioPorId = new Map(e.plantios.map((p) => [p.id, p]));
  const custo = safra
    ? montarCustosPorTalhao(
        e.talhoes,
        e.atividades,
        e.lancamentos,
        (pid) => plantioPorId.get(pid)?.season_id ?? null,
        e.safras,
        { janela: safra, safraId: safra.id, farmId: null },
      )
    : null;

  return {
    numeros: {
      talhoes: e.talhoes.length,
      areaTotal: e.talhoes.reduce((s, t) => s + (t.area_ha ?? 0), 0),
      plantiosAtivos: ativos.length,
      areaPlantada,
      atividadesProximas: proximas.length,
      atividadesAtrasadas: atrasadas.length,
      ensaiosAtivos: e.ensaios.filter((x) => x.lifecycle === "active").length,
      avaliacoesRecentes: e.avaliacoes.filter(
        (x) => x.date >= somarDias(hoje, -30) && x.date <= hoje,
      ).length,
      proximaColheita: colheitas[0]
        ? { plantio: colheitas[0].plantio, dias: colheitas[0].dias }
        : null,
      custo:
        safra && custo
          ? {
              safra,
              realizado: custo.realizado,
              porHa: porHa(custo.realizado, custo.area),
            }
          : null,
    },
    colheitas: colheitas.slice(0, ITENS_POR_COLUNA),
    atividades: atividades.slice(0, ITENS_POR_COLUNA),
    avaliacoes: avaliacoes.slice(0, ITENS_POR_COLUNA),
  };
}
