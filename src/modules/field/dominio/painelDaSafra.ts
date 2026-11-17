import { STATUS, corDaCategoria } from "@/lib/paleta";
import type { ReportDoc, ReportTable } from "@/modules/reports/reportBuilders";
import { TIPOS, type TipoDeAtividade } from "./atividades";
import {
  areaDaAtividade,
  areaDoPlantio,
  dentroDaJanela,
  safraDaAtividade,
  type JanelaDeSafra,
} from "./custo";
import {
  CICLOS,
  FINALIDADES,
  identidadeDoPlantio,
  type CicloDeVida,
  type Finalidade,
} from "./plantios";
import { porHa } from "./relatorioDeCustos";
import { dataBr, ha } from "./relatorioDoPlantio";

/**
 * Painel da safra (fase 6) — no lugar do PainelPlantios do Flag Field, enxuto:
 * o que o Dashboard (bloco Campo) e Custos por talhão já mostram não se repete.
 * Função pura; a tela e o relatório usam o mesmo resultado.
 *
 * Plantio da safra: o que tem `season_id` dela; sem safra marcada, o que foi
 * plantado dentro da janela. Atividade da safra: a regra de `safraDaAtividade`
 * (a do plantio; sem plantio, a data) — a mesma de Custos.
 */
export interface PlantioDoPainel {
  id: string;
  plot_id: string;
  season_id: string | null;
  crop: string;
  variety: string | null;
  purpose: Finalidade;
  lifecycle: CicloDeVida;
  planting_date: string | null;
  expected_harvest_date: string | null;
  area_type: "total" | "partial";
  partial_area_ha: number | null;
}
export interface TalhaoDoPainel {
  id: string;
  name: string;
  farm_id: string;
  area_ha: number;
}
export interface AtividadeDoPainel {
  farm_id: string;
  plot_id: string | null;
  planting_id: string | null;
  type: TipoDeAtividade;
  date: string;
  status: "planejada" | "realizada";
  area_type: "total" | "partial";
  treated_area_ha: number | null;
  cost_total: number | null;
  details: { produtividade?: number; produtividade_unidade?: string };
}

export interface LinhaDoPainel {
  plantio: PlantioDoPainel;
  talhao: TalhaoDoPainel | null;
  area: number;
  realizadas: number;
  planejadas: number;
  atrasadas: number;
}
export interface Painel {
  area: number;
  plantios: number;
  porCiclo: Record<CicloDeVida, number>;
  atrasadas: number;
  colheitasEm15: number;
  porCultura: { cultura: string; area: number }[];
  porFinalidade: { finalidade: Finalidade; area: number }[];
  produtividade: {
    cultura: string;
    unidade: string;
    valor: number;
    area: number;
  }[];
  custoPorTipo: { tipo: TipoDeAtividade; valor: number }[];
  custo: number;
  linhas: LinhaDoPainel[];
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function montarPainelDaSafra(e: {
  safra: JanelaDeSafra;
  safras: JanelaDeSafra[];
  plantios: PlantioDoPainel[];
  talhoes: TalhaoDoPainel[];
  atividades: AtividadeDoPainel[];
  farmId: string | null;
  hoje: string;
}): Painel {
  const talhao = new Map(e.talhoes.map((t) => [t.id, t]));
  const plantios = e.plantios.filter((p) => {
    const t = talhao.get(p.plot_id);
    if (e.farmId && t?.farm_id !== e.farmId) return false;
    return p.season_id
      ? p.season_id === e.safra.id
      : dentroDaJanela(p.planting_date, e.safra);
  });
  const ids = new Set(plantios.map((p) => p.id));
  const safraDoPlantio = new Map(e.plantios.map((p) => [p.id, p.season_id]));
  const atividades = e.atividades.filter(
    (a) =>
      (!e.farmId || a.farm_id === e.farmId) &&
      (a.planting_id
        ? ids.has(a.planting_id)
        : safraDaAtividade(
            a,
            (id) => safraDoPlantio.get(id) ?? null,
            e.safras,
          ) === e.safra.id),
  );

  const areaDe = new Map(
    plantios.map((p) => [
      p.id,
      areaDoPlantio(p, talhao.get(p.plot_id)?.area_ha ?? 0),
    ]),
  );
  const area = [...areaDe.values()].reduce((s, x) => s + x, 0);

  const porCiclo: Record<CicloDeVida, number> = {
    planned: 0,
    active: 0,
    completed: 0,
  };
  const cultura = new Map<string, number>();
  const finalidade = new Map<Finalidade, number>();
  for (const p of plantios) {
    porCiclo[p.lifecycle] += 1;
    const a = areaDe.get(p.id) ?? 0;
    cultura.set(p.crop, (cultura.get(p.crop) ?? 0) + a);
    finalidade.set(p.purpose, (finalidade.get(p.purpose) ?? 0) + a);
  }

  const limite15 = somarDias(e.hoje, 15);
  const colheitasEm15 = plantios.filter(
    (p) =>
      p.lifecycle !== "completed" &&
      !!p.expected_harvest_date &&
      p.expected_harvest_date >= e.hoje &&
      p.expected_harvest_date <= limite15,
  ).length;

  const atrasada = (a: AtividadeDoPainel) =>
    a.status === "planejada" && a.date < e.hoje;

  // Produtividade: colheitas REALIZADAS dos plantios, ponderadas pela área
  // colhida, por cultura E unidade (sc/ha não se soma com t/ha).
  const prod = new Map<
    string,
    {
      cultura: string;
      unidade: string;
      soma: number;
      area: number;
      simples: number;
      n: number;
    }
  >();
  const plantioPorId = new Map(plantios.map((p) => [p.id, p]));
  for (const a of atividades) {
    const v = a.details?.produtividade;
    if (a.type !== "harvest" || a.status !== "realizada" || v == null) continue;
    const p = a.planting_id ? plantioPorId.get(a.planting_id) : undefined;
    if (!p) continue;
    const unidade = a.details.produtividade_unidade || "sc/ha";
    const ar = areaDaAtividade({ ...a, areaDoAlvo: areaDe.get(p.id) ?? 0 });
    const k = `${p.crop}|${unidade}`;
    const x = prod.get(k) ?? {
      cultura: p.crop,
      unidade,
      soma: 0,
      area: 0,
      simples: 0,
      n: 0,
    };
    prod.set(k, {
      ...x,
      soma: x.soma + v * ar,
      area: x.area + ar,
      simples: x.simples + v,
      n: x.n + 1,
    });
  }

  const custo = new Map<TipoDeAtividade, number>();
  for (const a of atividades) {
    if (a.status !== "realizada" || !TIPOS[a.type]?.comCusto || !a.cost_total)
      continue;
    custo.set(a.type, (custo.get(a.type) ?? 0) + a.cost_total);
  }

  const linhas: LinhaDoPainel[] = plantios
    .map((p) => {
      const minhas = atividades.filter((a) => a.planting_id === p.id);
      return {
        plantio: p,
        talhao: talhao.get(p.plot_id) ?? null,
        area: areaDe.get(p.id) ?? 0,
        realizadas: minhas.filter((a) => a.status === "realizada").length,
        planejadas: minhas.filter((a) => a.status === "planejada").length,
        atrasadas: minhas.filter(atrasada).length,
      };
    })
    .sort(
      (a, b) =>
        a.plantio.crop.localeCompare(b.plantio.crop) ||
        (a.talhao?.name ?? "").localeCompare(b.talhao?.name ?? ""),
    );

  const custoPorTipo = [...custo.entries()]
    .map(([tipo, valor]) => ({ tipo, valor }))
    .sort((a, b) => b.valor - a.valor);
  return {
    area,
    plantios: plantios.length,
    porCiclo,
    atrasadas: atividades.filter(atrasada).length,
    colheitasEm15,
    porCultura: [...cultura.entries()]
      .map(([c, a]) => ({ cultura: c, area: a }))
      .sort((a, b) => b.area - a.area),
    porFinalidade: [...finalidade.entries()]
      .map(([f, a]) => ({ finalidade: f, area: a }))
      .sort((a, b) => b.area - a.area),
    produtividade: [...prod.values()]
      .map((x) => ({
        cultura: x.cultura,
        unidade: x.unidade,
        area: x.area,
        valor: x.area > 0 ? x.soma / x.area : x.simples / x.n,
      }))
      .sort((a, b) => a.cultura.localeCompare(b.cultura)),
    custoPorTipo,
    custo: custoPorTipo.reduce((s, x) => s + x.valor, 0),
    linhas,
  };
}

/**
 * Cor da cultura no gráfico: a ordem segue a área — a maior pega a 1ª cor da
 * paleta do app (src/lib/paleta.ts). Da 9ª em diante, "Outros" (grafite), e
 * nunca de novo a 1ª: repetir cor faria duas culturas parecerem a mesma.
 */
export const corDaCultura = (i: number) => corDaCategoria(i, "claro");

const num = (n: number, c = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: c });
const pct = (v: number, total: number) =>
  total > 0 ? `${num((v / total) * 100, 1)}%` : "—";

export function documentoDoPainel(
  p: Painel,
  rotulos: {
    safra: string;
    fazenda: string | null;
  },
): ReportDoc {
  const tables: ReportTable[] = [];
  if (p.porCultura.length)
    tables.push({
      title: "Área por cultura",
      columns: [
        { label: "Cultura" },
        { label: "Área (ha)", align: "right", width: "20%" },
        { label: "%", align: "right", width: "14%" },
      ],
      rows: p.porCultura.map((c) => [
        c.cultura,
        num(c.area),
        pct(c.area, p.area),
      ]),
      total: ["Total", num(p.area), "100%"],
      chart: {
        tipo: "rosca",
        fatias: p.porCultura.map((c, i) => ({
          rotulo: c.cultura,
          valor: c.area,
          cor: corDaCultura(i),
        })),
      },
    });
  if (p.porFinalidade.length)
    tables.push({
      title: "Área por finalidade",
      columns: [
        { label: "Finalidade" },
        { label: "Área (ha)", align: "right", width: "20%" },
        { label: "%", align: "right", width: "14%" },
      ],
      rows: p.porFinalidade.map((f) => [
        FINALIDADES[f.finalidade]?.rotulo ?? f.finalidade,
        num(f.area),
        pct(f.area, p.area),
      ]),
    });
  if (p.produtividade.length)
    tables.push({
      title: "Produtividade colhida",
      columns: [
        { label: "Cultura" },
        { label: "Área colhida (ha)", align: "right", width: "22%" },
        { label: "Produtividade", align: "right", width: "22%" },
      ],
      rows: p.produtividade.map((x) => [
        x.cultura,
        x.area > 0 ? num(x.area) : "—",
        `${num(x.valor)} ${x.unidade}`,
      ]),
    });
  if (p.custoPorTipo.length)
    tables.push({
      title: "Custo agronômico por tipo",
      columns: [
        { label: "Tipo" },
        { label: "R$", money: true, width: "20%" },
        { label: "R$/ha", money: true, width: "20%" },
      ],
      rows: p.custoPorTipo.map((x) => [
        TIPOS[x.tipo].rotulo,
        x.valor,
        porHa(x.valor, p.area),
      ]),
      total: ["Total", p.custo, porHa(p.custo, p.area)],
      chart: {
        tipo: "barras",
        series: [{ nome: "Custo", cor: STATUS.perigo.solido.claro }],
        grupos: p.custoPorTipo.map((x) => ({
          rotulo: TIPOS[x.tipo].rotulo,
          valores: [x.valor],
        })),
      },
    });
  if (p.linhas.length)
    tables.push({
      title: "Plantios",
      columns: [
        { label: "Cultura", wrap: true },
        { label: "Talhão", wrap: true },
        { label: "Área", align: "right", width: "10%" },
        { label: "Plantio", width: "14%" },
        { label: "Colheita", width: "14%" },
        { label: "Situação", width: "17%" },
        { label: "Atividades", align: "right", width: "15%" },
      ],
      rows: p.linhas.map((l) => [
        identidadeDoPlantio(l.plantio),
        l.talhao?.name ?? "—",
        ha(l.area),
        dataBr(l.plantio.planting_date),
        dataBr(l.plantio.expected_harvest_date),
        CICLOS[l.plantio.lifecycle],
        `${l.realizadas}/${l.realizadas + l.planejadas}` +
          (l.atrasadas ? ` (${l.atrasadas} atras.)` : ""),
      ]),
    });
  return {
    title: `Painel da safra — ${rotulos.safra}`,
    periodLabel: rotulos.safra,
    ccLabel: rotulos.fazenda ?? "Todas as fazendas",
    meta: [
      { label: "Área plantada", value: ha(p.area) },
      { label: "Plantios", value: String(p.plantios) },
      {
        label: "Atividades atrasadas",
        value: String(p.atrasadas),
        tone: p.atrasadas ? "out" : undefined,
      },
      { label: "Colheitas em 15 dias", value: String(p.colheitasEm15) },
    ],
    tables,
    empty: p.plantios === 0,
  };
}
