import { COR, COR_OUTROS } from "@/lib/paleta";
import type { CategoriaDeProduto } from "./catalogo";

/**
 * Ensaios (desenvolvimento de mercado) — listas e contas, portadas do Flag
 * Field (TrialManager.tsx, AnalisesDeEnsaios.tsx, lib/eval-constants.ts).
 * Funções puras: a tela e o relatório usam AS MESMAS (no Flag Field a prévia da
 * correção e o ROI do relatório divergiam do que era salvo).
 */

// ---- Tipos de ensaio ---------------------------------------------------------
export type TipoDeEnsaio =
  | "sementes"
  | "nutricao"
  | "biologicos"
  | "defensivos"
  | "fertilizantes"
  | "especialidades"
  | "outros";

/** Cores na ordem fixa da paleta do app (src/lib/paleta.ts, 17/11/2026);
 *  "Outros" em grafite. */
export const TIPOS_DE_ENSAIO: Record<
  TipoDeEnsaio,
  { rotulo: string; cor: string }
> = {
  sementes: { rotulo: "Sementes", cor: COR.lime },
  nutricao: { rotulo: "Nutrição", cor: COR.blue },
  biologicos: { rotulo: "Biológicos", cor: COR.pink },
  defensivos: { rotulo: "Defensivos", cor: COR.sky },
  fertilizantes: { rotulo: "Fertilizantes", cor: COR.orange },
  especialidades: { rotulo: "Especialidades", cor: COR.violet },
  outros: { rotulo: "Outros", cor: COR_OUTROS },
};

/** Que categorias do catálogo cada tipo de ensaio oferece (TrialManager.tsx:99). */
export const CATEGORIAS_POR_TIPO: Record<
  TipoDeEnsaio,
  CategoriaDeProduto[] | null
> = {
  sementes: ["sementes", "inoculantes", "fisiologia"],
  defensivos: ["defensivos", "adjuvantes"],
  biologicos: ["biologicos", "inoculantes", "adjuvantes"],
  nutricao: ["nutricao", "fertilizantes", "adjuvantes"],
  fertilizantes: ["fertilizantes", "nutricao"],
  especialidades: ["especialidades", "outros", "adjuvantes", "fisiologia"],
  outros: null, // todas
};

export const UNIDADES_DE_DOSE_DE_ENSAIO = [
  "L/ha",
  "kg/ha",
  "mL/ha",
  "g/ha",
  "L/100L",
  "mL/100L",
];

export const TIPOS_DE_AVALIACAO = [
  "Inicial",
  "Plantio",
  "Vegetativo",
  "Reprodutivo",
  "Fitossanidade",
  "Seletividade",
  "Pós-aplicação",
  "Manejo",
  "Monitoramento",
  "Pré-colheita",
];

export const ESTADIOS_DE_ENSAIO = [
  "VE",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6",
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R9",
];

// ---- Características da avaliação -------------------------------------------
export type TipoDeCaracteristica = "quantitativa" | "qualitativa";

export interface Caracteristica {
  id: string;
  nome: string;
  tipo: TipoDeCaracteristica;
  unidade?: string;
  referencia?: string;
  /** Qualitativa: uma das ESCALAS (ou texto livre se "personalizada"). */
  escala?: string;
}

export const UNIDADES_QUANTITATIVAS = [
  "nº",
  "cm",
  "mm",
  "m",
  "g",
  "kg",
  "sc",
  "%",
  "mL",
  "L",
];
export const REFERENCIAS = [
  "/planta",
  "/metro",
  "/m²",
  "/parcela",
  "/ha",
  "/amostra",
  "/vaso",
  "",
];

/** Escalas qualitativas: o valor é ESCOLHIDO da lista (no Flag Field era texto livre). */
export const ESCALAS: Record<
  string,
  { rotulo: string; opcoes: string[] | null }
> = {
  "nota-1-9": {
    rotulo: "Nota 1 a 9",
    opcoes: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  },
  "nota-1-5": { rotulo: "Nota 1 a 5", opcoes: ["1", "2", "3", "4", "5"] },
  percentual: { rotulo: "Percentual (0–100%)", opcoes: null },
  "presente-ausente": {
    rotulo: "Presente / ausente",
    opcoes: ["Presente", "Ausente"],
  },
  "baixo-medio-alto": {
    rotulo: "Baixo / médio / alto",
    opcoes: ["Baixo", "Médio", "Alto"],
  },
  personalizada: { rotulo: "Personalizada", opcoes: null },
};

/** As 22 sugestões do Flag Field, com o que cada uma já traz preenchido. */
export const SUGESTOES_DE_CARACTERISTICA: Omit<Caracteristica, "id">[] = [
  {
    nome: "Estande",
    tipo: "quantitativa",
    unidade: "nº",
    referencia: "/metro",
  },
  {
    nome: "Altura de planta",
    tipo: "quantitativa",
    unidade: "cm",
    referencia: "/planta",
  },
  {
    nome: "Germinação / emergência",
    tipo: "quantitativa",
    unidade: "%",
    referencia: "",
  },
  {
    nome: "Vagens por planta",
    tipo: "quantitativa",
    unidade: "nº",
    referencia: "/planta",
  },
  {
    nome: "Inserção da 1ª vagem",
    tipo: "quantitativa",
    unidade: "cm",
    referencia: "/planta",
  },
  {
    nome: "Altura de espiga",
    tipo: "quantitativa",
    unidade: "cm",
    referencia: "/planta",
  },
  {
    nome: "Produtividade",
    tipo: "quantitativa",
    unidade: "sc",
    referencia: "/ha",
  },
  { nome: "PMG", tipo: "quantitativa", unidade: "g", referencia: "/amostra" },
  { nome: "Desfolha", tipo: "quantitativa", unidade: "%", referencia: "" },
  {
    nome: "Cobertura do solo",
    tipo: "quantitativa",
    unidade: "%",
    referencia: "",
  },
  {
    nome: "Umidade de colheita",
    tipo: "quantitativa",
    unidade: "%",
    referencia: "",
  },
  { nome: "Sanidade foliar", tipo: "qualitativa", escala: "nota-1-9" },
  { nome: "Vigor vegetativo", tipo: "qualitativa", escala: "nota-1-9" },
  { nome: "Fitotoxicidade", tipo: "qualitativa", escala: "nota-1-9" },
  { nome: "Incidência de pragas", tipo: "qualitativa", escala: "nota-1-9" },
  { nome: "Tolerância a doenças", tipo: "qualitativa", escala: "nota-1-9" },
  { nome: "Acamamento", tipo: "qualitativa", escala: "nota-1-9" },
  { nome: "Seletividade", tipo: "qualitativa", escala: "nota-1-9" },
  { nome: "Maturação", tipo: "qualitativa", escala: "nota-1-5" },
  { nome: "Enchimento de grãos", tipo: "qualitativa", escala: "nota-1-5" },
  { nome: "Qualidade de grãos", tipo: "qualitativa", escala: "nota-1-5" },
  { nome: "Eficácia de controle", tipo: "qualitativa", escala: "percentual" },
];

// ---- Colheita ----------------------------------------------------------------
const duas = (n: number) => Math.round(n * 100) / 100;

/** Modo "calculada": peso líquido (kg) e área colhida (ha) → sc/ha (saca de 60 kg). */
export function produtividadeCalculada(pesoKg: number, areaHa: number): number {
  if (!(pesoKg > 0) || !(areaHa > 0)) return 0;
  return duas(pesoKg / 60 / areaHa);
}

/**
 * Correção para a umidade padrão: bruta × (100 − umidade) / (100 − alvo).
 * `alvo` nulo = sem correção. É A função da prévia E do salvar.
 */
export function corrigirUmidade(
  bruta: number,
  umidade: number,
  alvo: number | null,
): number {
  if (alvo == null || umidade === alvo) return duas(bruta);
  return duas((bruta * (100 - umidade)) / (100 - alvo));
}

/** A produtividade que vale para tudo: a corrigida, senão a bruta. */
export function produtividadeDe(c: {
  productivity: number;
  corrected_productivity: number | null;
}): number {
  return Number(c.corrected_productivity ?? c.productivity);
}

// ---- ROI ---------------------------------------------------------------------
export interface ProdutoDoEnsaio {
  id: string;
  name: string;
  role: "principal" | "concorrente";
  catalog_product_id: string | null;
  cost_ha: number | null;
}
export interface ColheitaDoEnsaio {
  product_id: string;
  productivity: number;
  corrected_productivity: number | null;
}

export interface LinhaDoRoi {
  produto: ProdutoDoEnsaio;
  produtividade: number | null;
  ehReferencia: boolean;
  /** (prod − prod_ref) × preço da saca */
  ganho: number | null;
  /** ganho − custo do produto (custo TOTAL — decisão de 16/11/2026) */
  lucro: number | null;
  /** lucro ÷ custo × 100 */
  roi: number | null;
  /** custo ÷ preço da saca */
  custoEmSacas: number | null;
}

/**
 * ROI do ensaio — a conta da aba ROI do Flag Field (custo TOTAL do produto),
 * agora a única: o relatório usa esta mesma função.
 * Referência: a escolhida; senão o 1º principal com colheita.
 */
export function roiDoEnsaio(
  produtos: ProdutoDoEnsaio[],
  colheitas: ColheitaDoEnsaio[],
  precoSaca: number | null,
  referenciaId: string | null,
): { referenciaId: string | null; linhas: LinhaDoRoi[] } {
  const prod = new Map(
    colheitas.map((c) => [c.product_id, produtividadeDe(c)]),
  );
  const ref =
    (referenciaId && produtos.find((p) => p.id === referenciaId)?.id) ||
    produtos.find((p) => p.role === "principal" && prod.has(p.id))?.id ||
    null;
  const prodRef = ref ? (prod.get(ref) ?? null) : null;

  const linhas = produtos.map((p): LinhaDoRoi => {
    const pr = prod.get(p.id) ?? null;
    const custo = p.cost_ha;
    const ehReferencia = p.id === ref;
    const custoEmSacas =
      custo != null && precoSaca ? duas(custo / precoSaca) : null;
    if (ehReferencia) {
      return {
        produto: p,
        produtividade: pr,
        ehReferencia,
        ganho: 0,
        lucro: custo != null ? -custo : null,
        roi: null,
        custoEmSacas,
      };
    }
    const ganho =
      pr != null && prodRef != null && precoSaca
        ? duas((pr - prodRef) * precoSaca)
        : null;
    const lucro = ganho != null && custo != null ? duas(ganho - custo) : null;
    const roi =
      lucro != null && custo ? Math.round((lucro / custo) * 1000) / 10 : null;
    return {
      produto: p,
      produtividade: pr,
      ehReferencia,
      ganho,
      lucro,
      roi,
      custoEmSacas,
    };
  });
  return { referenciaId: ref, linhas };
}

// ---- Análises (entre ensaios) ---------------------------------------------------
export interface EnsaioParaAnalise {
  id: string;
  nome: string;
  produtos: ProdutoDoEnsaio[];
  colheitas: ColheitaDoEnsaio[];
}

export interface LinhaDoRanking {
  chave: string;
  nome: string;
  papel: "principal" | "concorrente";
  media: number;
  minima: number;
  maxima: number;
  ensaios: number;
  colheitas: number;
}
export interface GanhoDoEnsaio {
  ensaioId: string;
  nome: string;
  principal: number;
  concorrente: number;
  diferenca: number;
  percentual: number;
  vencedor: "principal" | "concorrente" | "empate";
}

const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Ranking por PRODUTO DO CATÁLOGO (no Flag Field era pelo texto do nome, e
 * "Produto X" e "produto x" viravam dois) e ganho principal × concorrente.
 */
export function analisar(ensaios: EnsaioParaAnalise[]) {
  const grupos = new Map<
    string,
    { nome: string; papeis: string[]; valores: number[]; ensaios: Set<string> }
  >();
  const ganhos: GanhoDoEnsaio[] = [];

  for (const e of ensaios) {
    const prod = new Map(
      e.colheitas.map((c) => [c.product_id, produtividadeDe(c)]),
    );
    for (const p of e.produtos) {
      const v = prod.get(p.id);
      if (v == null || !(v > 0)) continue;
      const chave =
        p.catalog_product_id ?? `nome:${p.name.trim().toLowerCase()}`;
      const g = grupos.get(chave) ?? {
        nome: p.name,
        papeis: [],
        valores: [],
        ensaios: new Set(),
      };
      g.papeis.push(p.role);
      g.valores.push(v);
      g.ensaios.add(e.id);
      grupos.set(chave, g);
    }
    const lado = (r: "principal" | "concorrente") =>
      e.produtos
        .filter((p) => p.role === r && prod.has(p.id))
        .map((p) => prod.get(p.id)!);
    const P = lado("principal");
    const C = lado("concorrente");
    if (P.length && C.length) {
      const mp = media(P);
      const mc = media(C);
      const dif = duas(mp - mc);
      ganhos.push({
        ensaioId: e.id,
        nome: e.nome,
        principal: duas(mp),
        concorrente: duas(mc),
        diferenca: dif,
        percentual: mc > 0 ? Math.round(((mp - mc) / mc) * 1000) / 10 : 0,
        vencedor: dif > 0 ? "principal" : dif < 0 ? "concorrente" : "empate",
      });
    }
  }

  const ranking: LinhaDoRanking[] = [...grupos.entries()]
    .map(([chave, g]) => ({
      chave,
      nome: g.nome,
      papel: (g.papeis.filter((x) => x === "principal").length >=
      g.papeis.length / 2
        ? "principal"
        : "concorrente") as LinhaDoRanking["papel"],
      media: duas(media(g.valores)),
      minima: Math.min(...g.valores),
      maxima: Math.max(...g.valores),
      ensaios: g.ensaios.size,
      colheitas: g.valores.length,
    }))
    .sort((a, b) => b.media - a.media);

  const resumo = ganhos.length
    ? {
        ensaios: ganhos.length,
        ganhoMedio: duas(
          media(ganhos.map((g) => g.principal)) -
            media(ganhos.map((g) => g.concorrente)),
        ),
        percentual:
          Math.round(
            ((media(ganhos.map((g) => g.principal)) -
              media(ganhos.map((g) => g.concorrente))) /
              media(ganhos.map((g) => g.concorrente))) *
              1000,
          ) / 10,
        vitorias: ganhos.filter((g) => g.vencedor === "principal").length,
        empates: ganhos.filter((g) => g.vencedor === "empate").length,
      }
    : null;

  return { ranking, ganhos, resumo };
}
