import type {
  ReportDoc,
  ReportMeta,
  ReportTable,
} from "@/modules/reports/reportBuilders";
import type { AnexoDoCampo } from "../components/AnexosDoCampo";
import {
  TIPOS_DE_ENSAIO,
  produtividadeDe,
  roiDoEnsaio,
  type Caracteristica,
  type TipoDeEnsaio,
} from "./ensaios";
import { dataBr } from "./relatorioDoPlantio";

/**
 * Relatório completo do ensaio (fase 6): produtos, avaliações (uma tabela por
 * etapa), colheita e ROI. O ROI sai de `roiDoEnsaio` — a MESMA conta da aba ROI,
 * que passa a usar `tabelaDoRoi` daqui (no Flag Field eram duas fórmulas).
 */
export interface EnsaioDoRelatorio {
  name: string;
  crop: string;
  trial_type: TipoDeEnsaio;
  standard_variety: string | null;
  implantation_date: string | null;
  lifecycle: "active" | "completed";
  completed_at: string | null;
  sack_price: number | null;
  roi_reference_product_id: string | null;
  notes: string | null;
}
export interface ProdutoDoRelatorio {
  id: string;
  name: string;
  manufacturer: string | null;
  role: "principal" | "concorrente";
  catalog_product_id: string | null;
  dose_value: number | null;
  dose_unit: string | null;
  population: number | null;
  cost_ha: number | null;
}
export interface EtapaDoRelatorio {
  id: string;
  evaluation_type: string;
  stage: string | null;
  characteristics: Caracteristica[];
  created_at: string;
}
export interface AvaliacaoDoRelatorio {
  id: string;
  step_id: string | null;
  product_id: string;
  date: string;
  values: Record<string, string>;
  characteristics: Caracteristica[] | null;
  attachments?: AnexoDoCampo[];
  notes: string | null;
}
export interface ColheitaDoRelatorio {
  product_id: string;
  harvest_date: string | null;
  productivity: number;
  corrected_productivity: number | null;
  net_weight_kg: number | null;
  harvested_area_ha: number | null;
  moisture: number;
  target_moisture: number | null;
}
export interface DadosDoEnsaio {
  ensaio: EnsaioDoRelatorio;
  produtos: ProdutoDoRelatorio[];
  etapas: EtapaDoRelatorio[];
  avaliacoes: AvaliacaoDoRelatorio[];
  colheitas: ColheitaDoRelatorio[];
  fazenda: { name: string } | null;
  talhao: { name: string } | null;
  plantio: string | null;
  safra: string | null;
}

const num = (n: number, casas = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const rotuloDaEtapa = (e: {
  evaluation_type: string;
  stage: string | null;
}) => `${e.evaluation_type}${e.stage ? ` · ${e.stage}` : ""}`;

export const rotuloDaCaracteristica = (c: Caracteristica) =>
  c.tipo === "quantitativa"
    ? `${c.nome}${c.unidade ? ` (${c.unidade}${c.referencia ?? ""})` : ""}`
    : c.nome;

/** A tabela do ROI — a do relatório completo E a do botão da aba ROI. */
export function tabelaDoRoi(
  produtos: ProdutoDoRelatorio[],
  colheitas: ColheitaDoRelatorio[],
  precoSaca: number | null,
  referenciaId: string | null,
): ReportTable {
  const { linhas } = roiDoEnsaio(produtos, colheitas, precoSaca, referenciaId);
  return {
    title: `ROI · saca ${precoSaca ? brl(precoSaca) : "—"}`,
    columns: [
      { label: "Produto", wrap: true },
      { label: "Papel" },
      { label: "Custo/ha", money: true },
      { label: "Prod. (sc/ha)", align: "right" },
      { label: "Ganho/ha", money: true },
      { label: "Lucro/ha", money: true },
      { label: "ROI", align: "right" },
      { label: "Custo em sacas", align: "right" },
    ],
    rows: linhas.map((l) => [
      l.produto.name + (l.ehReferencia ? " (referência)" : ""),
      l.produto.role === "principal" ? "Principal" : "Concorrente",
      l.produto.cost_ha ?? 0,
      l.produtividade != null ? num(l.produtividade) : "—",
      l.ganho ?? 0,
      l.lucro ?? 0,
      l.ehReferencia
        ? "Referência"
        : l.roi != null
          ? `${l.roi.toLocaleString("pt-BR")}%`
          : "—",
      l.custoEmSacas != null ? num(l.custoEmSacas) : "—",
    ]),
  };
}

/** Fotos das avaliações, com a legenda "Etapa · data · produto · arquivo". */
export function anexosDoEnsaio(
  d: Pick<DadosDoEnsaio, "etapas" | "avaliacoes" | "produtos">,
): { anexo: AnexoDoCampo; legenda: string }[] {
  const etapa = new Map(d.etapas.map((e) => [e.id, rotuloDaEtapa(e)]));
  const produto = new Map(d.produtos.map((p) => [p.id, p.name]));
  return [...d.avaliacoes]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((a) =>
      (a.attachments ?? []).map((anexo) => ({
        anexo,
        legenda: [
          a.step_id ? etapa.get(a.step_id) : "Avulsa",
          dataBr(a.date),
          produto.get(a.product_id) ?? "Produto removido",
          anexo.nome,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    );
}

export function montarRelatorioDoEnsaio(d: DadosDoEnsaio): ReportDoc {
  const e = d.ensaio;
  const nomeDe = new Map(d.produtos.map((p) => [p.id, p.name]));
  const tables: ReportTable[] = [];

  // ---- Ficha ---------------------------------------------------------------
  const ficha: [string, string][] = [];
  const push = (l: string, v: string | null | undefined) => {
    if (v) ficha.push([l, v]);
  };
  push("Tipo", TIPOS_DE_ENSAIO[e.trial_type]?.rotulo);
  push("Cultura", e.crop);
  push("Cultivar padrão", e.standard_variety);
  push("Fazenda", d.fazenda?.name);
  push("Talhão", d.talhao?.name);
  push("Plantio", d.plantio);
  push("Safra", d.safra);
  push("Implantação", e.implantation_date ? dataBr(e.implantation_date) : null);
  push(
    "Situação",
    e.lifecycle === "completed"
      ? `Concluído${e.completed_at ? ` em ${dataBr(e.completed_at)}` : ""}`
      : "Em andamento",
  );
  push("Preço da saca", e.sack_price ? brl(e.sack_price) : null);
  push("Observações", e.notes);
  tables.push({
    title: "Dados do ensaio",
    columns: [
      { label: "Campo", width: "26%" },
      { label: "Informação", wrap: true },
    ],
    rows: ficha,
  });

  // ---- Produtos ------------------------------------------------------------
  if (d.produtos.length) {
    tables.push({
      title: "Produtos",
      columns: [
        { label: "Produto", wrap: true },
        { label: "Fabricante", wrap: true },
        { label: "Papel", width: "13%" },
        { label: "Dose", width: "15%" },
        { label: "População", align: "right", width: "13%" },
        { label: "Custo/ha", money: true, width: "13%" },
      ],
      rows: d.produtos.map((p) => [
        p.name,
        p.manufacturer ?? "",
        p.role === "principal" ? "Principal" : "Concorrente",
        p.dose_value != null
          ? `${num(p.dose_value, 3)}${p.dose_unit ? ` ${p.dose_unit}` : ""}`
          : "—",
        p.population != null ? num(p.population, 0) : "—",
        p.cost_ha ?? 0,
      ]),
    });
  }

  // ---- Avaliações: uma tabela por etapa --------------------------------------
  const etapas = [...d.etapas].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  for (const et of etapas) {
    const daEtapa = d.avaliacoes.filter((a) => a.step_id === et.id);
    if (!daEtapa.length) continue;
    tables.push({
      title: `Avaliação · ${rotuloDaEtapa(et)}`,
      columns: [
        { label: "Produto", wrap: true },
        { label: "Data", width: "12%" },
        ...et.characteristics.map((c) => ({
          label: rotuloDaCaracteristica(c),
          wrap: true,
        })),
      ],
      rows: d.produtos.map((p) => {
        const a = daEtapa.find((x) => x.product_id === p.id);
        return [
          p.name,
          a ? dataBr(a.date) : "—",
          ...et.characteristics.map((c) => (a && a.values[c.id]) || "—"),
        ];
      }),
    });
  }
  const avulsas = d.avaliacoes
    .filter((a) => !a.step_id)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (avulsas.length) {
    tables.push({
      title: "Avaliações avulsas",
      columns: [
        { label: "Produto", wrap: true, width: "24%" },
        { label: "Data", width: "12%" },
        { label: "Valores", wrap: true },
      ],
      rows: avulsas.map((a) => {
        const defs = a.characteristics ?? [];
        const valores = defs.length
          ? defs.map((c) => `${c.nome}: ${a.values[c.id] ?? "—"}`).join(" · ")
          : Object.entries(a.values)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ");
        return [
          nomeDe.get(a.product_id) ?? "Produto removido",
          dataBr(a.date),
          valores || a.notes || "",
        ];
      }),
    });
  }

  // ---- Colheita --------------------------------------------------------------
  const colheitas = d.colheitas
    .filter((c) => nomeDe.has(c.product_id))
    .sort((a, b) => produtividadeDe(b) - produtividadeDe(a));
  if (colheitas.length) {
    tables.push({
      title: "Colheita",
      columns: [
        { label: "Produto", wrap: true },
        { label: "Data", width: "12%" },
        { label: "Peso (kg)", align: "right", width: "12%" },
        { label: "Área (ha)", align: "right", width: "11%" },
        { label: "Umidade", align: "right", width: "11%" },
        { label: "Prod. (sc/ha)", align: "right", width: "14%" },
      ],
      rows: colheitas.map((c) => [
        nomeDe.get(c.product_id)!,
        dataBr(c.harvest_date),
        c.net_weight_kg != null ? num(c.net_weight_kg, 1) : "—",
        c.harvested_area_ha != null ? num(c.harvested_area_ha, 4) : "—",
        `${num(c.moisture, 1)}%${c.target_moisture != null ? ` → ${num(c.target_moisture, 1)}%` : ""}`,
        num(produtividadeDe(c)),
      ]),
      chart: {
        tipo: "barras",
        series: [{ nome: "Produtividade (sc/ha)", cor: "#65a30d" }],
        grupos: colheitas.map((c) => ({
          rotulo: (nomeDe.get(c.product_id) ?? "").slice(0, 14),
          valores: [produtividadeDe(c)],
        })),
      },
    });
    tables.push(
      tabelaDoRoi(
        d.produtos,
        d.colheitas,
        e.sack_price,
        e.roi_reference_product_id,
      ),
    );
  }

  const meta: ReportMeta[] = [
    { label: "Produtos", value: String(d.produtos.length) },
    { label: "Avaliações", value: String(d.avaliacoes.length) },
  ];
  if (colheitas.length)
    meta.push({
      label: "Maior produtividade",
      value: `${num(produtividadeDe(colheitas[0]))} sc/ha`,
      tone: "in",
    });

  return {
    title: `Ensaio — ${e.name}`,
    periodLabel: [e.crop, d.safra].filter(Boolean).join(" · "),
    ccLabel: [d.fazenda?.name, d.talhao?.name].filter(Boolean).join(" · "),
    meta,
    tables,
  };
}
