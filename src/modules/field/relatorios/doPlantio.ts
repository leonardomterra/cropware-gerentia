import { supabase } from "@/utils/supabase/client";
import type { LancamentoDoCampo } from "../dominio/custo";
import {
  montarRelatorioDoPlantio,
  type DadosDoPlantio,
} from "../dominio/relatorioDoPlantio";
import { identidadeDoPlantio } from "../dominio/plantios";
import { gddDoPlantio } from "../hooks/useClima";
import type { useCadastros } from "../hooks/useCadastros";
import type { Atividade, Plantio } from "../types";
import { exportarRelatorio, nomeDeArquivo } from "./exportar";

export type Cadastros = ReturnType<typeof useCadastros>;
const hojeIso = () => new Date().toISOString().slice(0, 10);

/**
 * Busca, na hora, o que o relatório do plantio precisa: as atividades DELE, os
 * lançamentos do talhão e o GDD. Sob demanda para a lista de plantios não ter
 * que carregar todas as atividades da organização.
 */
export async function carregarDadosDoPlantio(
  plantio: Plantio,
  c: Cadastros,
): Promise<DadosDoPlantio> {
  const talhao = c.talhoes.find((t) => t.id === plantio.plot_id) ?? null;
  const fazenda = talhao
    ? (c.fazendas.find((f) => f.id === talhao.farm_id) ?? null)
    : null;
  const [atv, lanc, gdd] = await Promise.all([
    supabase
      .from("farm_activities")
      .select("*")
      .eq("planting_id", plantio.id)
      .limit(2000),
    supabase
      .from("farm_receipts")
      .select(
        "farm_id, plot_id, total_value, direction, status, doc_type, is_estimated, transaction_date, paid_date, description",
      )
      .eq("plot_id", plantio.plot_id)
      .eq("direction", "expense")
      .limit(5000),
    gddDoPlantio(plantio, fazenda, c.talhoes).catch(() => null),
  ]);
  if (atv.error) throw atv.error;
  const atividades = ((atv.data as Atividade[]) ?? []).map((a) => ({
    ...a,
    cost_total: a.cost_total == null ? null : Number(a.cost_total),
    treated_area_ha:
      a.treated_area_ha == null ? null : Number(a.treated_area_ha),
    attachments: a.attachments ?? [],
  }));
  return {
    plantio,
    talhao,
    fazenda,
    produtor: fazenda?.producer_id
      ? (c.produtores.find((p) => p.id === fazenda.producer_id) ?? null)
      : null,
    safra: plantio.season_id
      ? (c.safras.find((s) => s.id === plantio.season_id) ?? null)
      : null,
    atividades,
    lancamentos: ((lanc.data as LancamentoDoCampo[]) ?? []).map((r) => ({
      ...r,
      total_value: Number(r.total_value),
    })),
    gdd,
    hoje: hojeIso(),
  };
}

export const nomeDoRelatorioDoPlantio = (p: Plantio, c: Cadastros) =>
  nomeDeArquivo(
    "plantio",
    identidadeDoPlantio(p),
    c.talhoes.find((t) => t.id === p.plot_id)?.name,
  );

/** Menu ⋯ do cartão: gera direto, sem fotos. */
export async function gerarRelatorioDoPlantio(p: Plantio, c: Cadastros) {
  const dados = await carregarDadosDoPlantio(p, c);
  await exportarRelatorio(
    montarRelatorioDoPlantio(dados),
    nomeDoRelatorioDoPlantio(p, c),
  );
}
