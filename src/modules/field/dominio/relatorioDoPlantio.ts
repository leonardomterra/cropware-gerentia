import type {
  ReportDoc,
  ReportMeta,
  ReportTable,
} from "@/modules/reports/reportBuilders";
import {
  TIPOS,
  type ProdutoDaAtividade,
  type TipoDeAtividade,
} from "./atividades";
import {
  areaDaAtividade,
  areaDoPlantio,
  contaNoRealizado,
  dataDoLancamento,
  dentroDaJanela,
  type LancamentoDoCampo,
} from "./custo";
import { porHa } from "./relatorioDeCustos";
import type { AnexoDoCampo } from "../components/AnexosDoCampo";
import {
  CICLOS,
  FINALIDADES,
  identidadeDoPlantio,
  type CicloDeVida,
  type Finalidade,
} from "./plantios";

/**
 * Relatório do plantio (fase 6) — o `generatePlantingReport` do Flag Field,
 * agora no formato `ReportDoc` do financeiro (CSV, página de imprimir, PDF no
 * celular). Função pura: recebe tudo já carregado.
 *
 * Custo: o AGRONÔMICO soma as atividades REALIZADAS (como em Custos por
 * talhão); as planejadas aparecem na lista, mas fora do total. Os lançamentos
 * do financeiro ligados ao talhão vão numa tabela À PARTE, sem misturar
 * (decisão de 16/11/2026).
 */
export interface PlantioDoRelatorio {
  id: string;
  crop: string;
  variety: string | null;
  purpose: Finalidade;
  lifecycle: CicloDeVida;
  planting_date: string | null;
  expected_harvest_date: string | null;
  completed_at: string | null;
  population: number | null;
  population_unit: "plantas_ha" | "kg_ha" | null;
  area_type: "total" | "partial";
  partial_area_ha: number | null;
  seed_category_planted: string | null;
  seed_category_harvested: string | null;
  seed_homologation: string | null;
  notes: string | null;
}
export interface AtividadeDoPlantio {
  type: TipoDeAtividade;
  date: string;
  status: "planejada" | "realizada";
  area_type: "total" | "partial";
  treated_area_ha: number | null;
  products: ProdutoDaAtividade[];
  cost_total: number | null;
  details: { produtividade?: number; produtividade_unidade?: string };
  description: string | null;
  attachments?: AnexoDoCampo[];
}
export interface DadosDoPlantio {
  plantio: PlantioDoRelatorio;
  talhao: { id: string; name: string; area_ha: number } | null;
  fazenda: { name: string; city: string | null; state: string | null } | null;
  produtor: { name: string } | null;
  safra: { name: string; starts_on: string; ends_on: string } | null;
  /** As atividades DESTE plantio (planting_id = plantio.id). */
  atividades: AtividadeDoPlantio[];
  /** Lançamentos do campo (todos); aqui entram só os do talhão na janela. */
  lancamentos: LancamentoDoCampo[];
  gdd: { valor: number; tbase: number } | null;
  /** "aaaa-mm-dd" — fecha a janela quando não há safra nem colheita. */
  hoje: string;
}

export const dataBr = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
const num = (n: number, casas = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
export const ha = (n: number) => `${num(n)} ha`;

function produtosEmTexto(ps: ProdutoDaAtividade[]): string {
  return ps
    .map((p) =>
      p.dose != null
        ? `${p.nome} ${num(p.dose, 3)}${p.unidade ? ` ${p.unidade}` : ""}`
        : p.nome,
    )
    .join("; ");
}

/**
 * Produtividade colhida: média das colheitas REALIZADAS com produtividade,
 * ponderada pela área de cada uma, por unidade (sc/ha não se mistura com t/ha).
 */
export function produtividadeColhida(
  atividades: AtividadeDoPlantio[],
  areaDoAlvo: number,
): { valor: number; unidade: string }[] {
  const porUnidade = new Map<
    string,
    { soma: number; area: number; n: number; simples: number }
  >();
  for (const a of atividades) {
    const v = a.details?.produtividade;
    if (a.type !== "harvest" || a.status !== "realizada" || v == null) continue;
    const u = a.details.produtividade_unidade || "sc/ha";
    const area = areaDaAtividade({ ...a, areaDoAlvo });
    const x = porUnidade.get(u) ?? { soma: 0, area: 0, n: 0, simples: 0 };
    porUnidade.set(u, {
      soma: x.soma + v * area,
      area: x.area + area,
      n: x.n + 1,
      simples: x.simples + v,
    });
  }
  return [...porUnidade.entries()].map(([unidade, x]) => ({
    unidade,
    // Sem área (talhão sem área), cai na média simples.
    valor: x.area > 0 ? x.soma / x.area : x.simples / x.n,
  }));
}

/** Fotos das atividades do plantio, com a legenda "data · tipo · arquivo". */
export function anexosDoPlantio(
  atividades: AtividadeDoPlantio[],
): { anexo: AnexoDoCampo; legenda: string }[] {
  return [...atividades]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((a) =>
      (a.attachments ?? []).map((anexo) => ({
        anexo,
        legenda: [dataBr(a.date), TIPOS[a.type]?.rotulo ?? a.type, anexo.nome]
          .filter(Boolean)
          .join(" · "),
      })),
    );
}

export function montarRelatorioDoPlantio(d: DadosDoPlantio): ReportDoc {
  const p = d.plantio;
  const area = areaDoPlantio(p, d.talhao?.area_ha ?? 0);
  const atividades = [...d.atividades].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const realizadas = atividades.filter((a) => a.status === "realizada");
  const custoRealizado = realizadas.reduce(
    (s, a) => s + (a.cost_total ?? 0),
    0,
  );
  const custoPlanejado = atividades
    .filter((a) => a.status === "planejada")
    .reduce((s, a) => s + (a.cost_total ?? 0), 0);

  // ---- Ficha (tabela de 2 colunas) e cartões de número ---------------------
  // Os cartões (`meta`) são UMA fileira no PDF: no máximo 4, só números.
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const ficha: [string, string][] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) ficha.push([label, value]);
  };
  push("Produtor", d.produtor?.name);
  push(
    "Fazenda",
    d.fazenda
      ? [
          d.fazenda.name,
          [d.fazenda.city, d.fazenda.state].filter(Boolean).join("/"),
        ]
          .filter(Boolean)
          .join(" · ")
      : null,
  );
  push("Talhão", d.talhao?.name);
  push("Safra", d.safra?.name);
  push("Cultura", identidadeDoPlantio(p));
  push("Finalidade", FINALIDADES[p.purpose]?.rotulo);
  push("Situação", CICLOS[p.lifecycle]);
  push("Plantio", p.planting_date ? dataBr(p.planting_date) : null);
  push(
    "Colheita prevista",
    p.expected_harvest_date ? dataBr(p.expected_harvest_date) : null,
  );
  push(
    "Área",
    area > 0
      ? `${ha(area)}${p.area_type === "partial" ? " (parcial)" : ""}`
      : null,
  );
  push(
    "População",
    p.population != null
      ? `${num(p.population, 0)} ${p.population_unit === "kg_ha" ? "kg/ha" : "plantas/ha"}`
      : null,
  );
  push(
    "Semente",
    [
      p.seed_category_planted && `plantada ${p.seed_category_planted}`,
      p.seed_category_harvested && `colhida ${p.seed_category_harvested}`,
      p.seed_homologation && `homologação ${p.seed_homologation}`,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  push(
    "Graus-dia",
    d.gdd
      ? `${num(d.gdd.valor, 1)} desde o plantio (temperatura-base ${d.gdd.tbase} °C)`
      : null,
  );
  const colhida = produtividadeColhida(atividades, area);
  for (const x of colhida)
    push("Produtividade colhida", `${num(x.valor)} ${x.unidade}`);
  push("Planejado (a fazer)", custoPlanejado > 0 ? brl(custoPlanejado) : null);
  push("Observações", p.notes);

  const meta: ReportMeta[] = [
    { label: "Área", value: area > 0 ? ha(area) : "—" },
    { label: "Custo agronômico", value: brl(custoRealizado), tone: "out" },
    {
      label: "Custo por hectare",
      value: area > 0 ? brl(porHa(custoRealizado, area)) : "—",
    },
  ];
  if (colhida.length)
    meta.push({
      label: "Produtividade",
      value: `${num(colhida[0].valor)} ${colhida[0].unidade}`,
      tone: "in",
    });
  else if (d.gdd) meta.push({ label: "Graus-dia", value: num(d.gdd.valor, 0) });

  // ---- Tabelas -------------------------------------------------------------
  const tables: ReportTable[] = [
    {
      title: "Dados do plantio",
      columns: [
        { label: "Campo", width: "26%" },
        { label: "Informação", wrap: true },
      ],
      rows: ficha,
    },
  ];
  if (atividades.length) {
    tables.push({
      title: "Atividades",
      columns: [
        { label: "Data", width: "11%" },
        { label: "Tipo", width: "13%" },
        { label: "Situação", width: "11%" },
        { label: "Área", align: "right", width: "10%" },
        { label: "Produtos / descrição", wrap: true },
        { label: "Custo", money: true, width: "13%" },
      ],
      rows: atividades.map((a) => [
        dataBr(a.date),
        TIPOS[a.type]?.rotulo ?? a.type,
        a.status === "realizada" ? "Realizada" : "Planejada",
        ha(areaDaAtividade({ ...a, areaDoAlvo: area })),
        produtosEmTexto(a.products ?? []) || a.description || "",
        a.cost_total ?? 0,
      ]),
      total: ["Total realizado", "", "", "", "", custoRealizado],
    });
  }

  const porTipo = new Map<TipoDeAtividade, number>();
  for (const a of realizadas) {
    if (!TIPOS[a.type]?.comCusto || !a.cost_total) continue;
    porTipo.set(a.type, (porTipo.get(a.type) ?? 0) + a.cost_total);
  }
  const tipos = [...porTipo.entries()].sort((a, b) => b[1] - a[1]);
  if (tipos.length) {
    tables.push({
      title: "Custo agronômico por tipo",
      columns: [
        { label: "Tipo" },
        { label: "R$", money: true, width: "20%" },
        { label: "R$/ha", money: true, width: "20%" },
        { label: "%", align: "right", width: "12%" },
      ],
      rows: tipos.map(([t, v]) => [
        TIPOS[t].rotulo,
        v,
        porHa(v, area),
        `${num((v / custoRealizado) * 100, 1)}%`,
      ]),
      total: ["Total", custoRealizado, porHa(custoRealizado, area), "100%"],
      chart: {
        tipo: "rosca",
        fatias: tipos.map(([t, v]) => ({
          rotulo: TIPOS[t].rotulo,
          valor: v,
          cor: TIPOS[t].cor,
        })),
      },
    });
  }

  // Lançamentos do talhão: na janela da safra; sem safra, do plantio até a
  // colheita (ou hoje).
  const janela = d.safra
    ? { starts_on: d.safra.starts_on, ends_on: d.safra.ends_on }
    : p.planting_date
      ? {
          starts_on: p.planting_date,
          ends_on:
            p.completed_at?.slice(0, 10) || p.expected_harvest_date || d.hoje,
        }
      : null;
  const doTalhao =
    d.talhao && janela
      ? d.lancamentos
          .filter(
            (r) =>
              r.plot_id === d.talhao!.id &&
              contaNoRealizado(r) &&
              dentroDaJanela(dataDoLancamento(r), janela),
          )
          .sort((a, b) =>
            (dataDoLancamento(a) ?? "").localeCompare(
              dataDoLancamento(b) ?? "",
            ),
          )
      : [];
  if (doTalhao.length) {
    const total = doTalhao.reduce((s, r) => s + Number(r.total_value), 0);
    tables.push({
      title: `Lançamentos do financeiro no talhão (${dataBr(janela!.starts_on)} a ${dataBr(janela!.ends_on)})`,
      columns: [
        { label: "Data", width: "14%" },
        { label: "Descrição", wrap: true },
        { label: "Valor", money: true, width: "18%" },
      ],
      rows: doTalhao.map((r) => [
        dataBr(dataDoLancamento(r)),
        r.description || "Lançamento",
        Number(r.total_value),
      ]),
      total: ["Total", "", total],
    });
  }

  return {
    title: `Plantio — ${identidadeDoPlantio(p)}`,
    periodLabel:
      [d.safra?.name, p.planting_date && `plantio ${dataBr(p.planting_date)}`]
        .filter(Boolean)
        .join(" · ") || "Plantio",
    ccLabel: [d.fazenda?.name, d.talhao?.name].filter(Boolean).join(" · "),
    meta,
    tables,
    empty: false,
  };
}
