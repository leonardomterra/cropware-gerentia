import { identidadeDoPlantio } from "../dominio/plantios";
import {
  anexosDoEnsaio,
  montarRelatorioDoEnsaio,
  type DadosDoEnsaio,
} from "../dominio/relatorioDoEnsaio";
import type { DadosDosEnsaios } from "../hooks/useEnsaios";
import type { Ensaio, Fazenda, Plantio, Safra, Talhao } from "../types";
import { exportarRelatorio, nomeDeArquivo } from "./exportar";

/**
 * Junta o que o relatório do ensaio precisa a partir do que a tela já tem
 * carregado (useEnsaios + cadastros) — nada de buscar de novo.
 */
export function dadosDoEnsaio(
  ensaio: Ensaio,
  dados: Pick<
    DadosDosEnsaios,
    "produtos" | "etapas" | "avaliacoes" | "colheitas"
  >,
  cad: {
    fazendas: Fazenda[];
    talhoes: Talhao[];
    plantios: Plantio[];
    safras: Safra[];
  },
): DadosDoEnsaio {
  const doEnsaio = <T extends { trial_id: string }>(xs: T[]) =>
    xs.filter((x) => x.trial_id === ensaio.id);
  const plantio = ensaio.planting_id
    ? cad.plantios.find((p) => p.id === ensaio.planting_id)
    : null;
  return {
    ensaio,
    produtos: doEnsaio(dados.produtos),
    etapas: doEnsaio(dados.etapas),
    avaliacoes: doEnsaio(dados.avaliacoes),
    colheitas: doEnsaio(dados.colheitas),
    fazenda: cad.fazendas.find((f) => f.id === ensaio.farm_id) ?? null,
    talhao: ensaio.plot_id
      ? (cad.talhoes.find((t) => t.id === ensaio.plot_id) ?? null)
      : null,
    plantio: plantio ? identidadeDoPlantio(plantio) : null,
    safra: ensaio.season_id
      ? (cad.safras.find((s) => s.id === ensaio.season_id)?.name ?? null)
      : null,
  };
}

export const nomeDoRelatorioDoEnsaio = (e: Ensaio) =>
  nomeDeArquivo("ensaio", e.name, e.crop);

export function relatorioDoEnsaio(d: DadosDoEnsaio) {
  return {
    montar: () => montarRelatorioDoEnsaio(d),
    nome: nomeDoRelatorioDoEnsaio(d.ensaio as Ensaio),
    anexos: anexosDoEnsaio(d),
  };
}

/** Menu ⋯ do cartão: gera direto, sem fotos. */
export function gerarRelatorioDoEnsaio(d: DadosDoEnsaio) {
  const r = relatorioDoEnsaio(d);
  return exportarRelatorio(r.montar(), r.nome);
}
