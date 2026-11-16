/**
 * Tipos de atividade de campo e as listas de cada um — portados do Flag Field
 * (utils/activityTypeLabels.ts + ActivityManagement.tsx), sem os tipos mortos
 * do CDM (checklist, documentation_form, documentation, other).
 *
 * O valor do tipo é o mesmo do Flag Field (inglês) para a migração de dados da
 * fase 9 ser direta; o que a pessoa vê é o rótulo.
 */
export type TipoDeAtividade =
  | "spraying"
  | "fertilization"
  | "liming"
  | "plastering"
  | "irrigation"
  | "harvest"
  | "planting"
  | "observation"
  | "annotation"
  | "sampling"
  | "rain"
  | "climate"
  | "visit";

export interface InfoDoTipo {
  rotulo: string;
  cor: string;
  /** Da fazenda: talhão opcional e sem plantio (chuva, clima, visita). */
  daFazenda?: boolean;
  /** Tem custo agronômico. */
  comCusto?: boolean;
  /** Usa a lista de produtos (com R$/ha por produto). */
  comProdutos?: boolean;
  /** Os produtos vêm do catálogo (senão, nome livre). */
  produtosDoCatalogo?: boolean;
}

export const TIPOS: Record<TipoDeAtividade, InfoDoTipo> = {
  spraying: {
    rotulo: "Aplicação",
    cor: "#8b5cf6",
    comCusto: true,
    comProdutos: true,
    produtosDoCatalogo: true,
  },
  fertilization: {
    rotulo: "Adubação",
    cor: "#10b981",
    comCusto: true,
    comProdutos: true,
    produtosDoCatalogo: true,
  },
  liming: { rotulo: "Calagem", cor: "#d97706", comCusto: true },
  plastering: { rotulo: "Gessagem", cor: "#b45309", comCusto: true },
  irrigation: { rotulo: "Irrigação", cor: "#0ea5e9", comCusto: true },
  harvest: { rotulo: "Colheita", cor: "#ea580c", comCusto: true },
  planting: { rotulo: "Plantio", cor: "#65a30d", comCusto: true },
  observation: { rotulo: "Observação", cor: "#e11d48" },
  annotation: { rotulo: "Anotação", cor: "#06b6d4" },
  sampling: { rotulo: "Amostragem", cor: "#eab308" },
  rain: { rotulo: "Chuva", cor: "#38bdf8", daFazenda: true },
  climate: { rotulo: "Clima", cor: "#737373", daFazenda: true },
  visit: { rotulo: "Visita", cor: "#6366f1", daFazenda: true },
};

export const ORDEM_DOS_TIPOS: TipoDeAtividade[] = [
  "spraying",
  "fertilization",
  "liming",
  "plastering",
  "planting",
  "irrigation",
  "harvest",
  "observation",
  "sampling",
  "annotation",
  "rain",
  "climate",
  "visit",
];

export const UNIDADES_DE_DOSE = [
  "kg/ha",
  "L/ha",
  "t/ha",
  "g/ha",
  "mL/ha",
  "kg/planta",
  "mL/planta",
];
export const UNIDADES_DE_PRODUTIVIDADE = ["sc/ha", "t/ha", "kg/ha", "cx/ha"];

export const METODOS_DE_APLICACAO = [
  "Terrestre",
  "Aérea",
  "Fertirrigação",
  "Drone",
  "Costal",
  "Outro",
];

export const ESTADIOS = [
  "Manejo",
  "Dessecação",
  "Pré-plantio",
  "VE",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6",
  "V8",
  "V10",
  "V12",
  "Fechamento de entrelinhas",
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "Pré-colheita",
];

export const TIPOS_DE_PRODUTO_APLICADO = [
  "Herbicida",
  "Fungicida",
  "Inseticida",
  "Acaricida",
  "Nematicida",
  "Bactericida",
  "Regulador de crescimento",
  "Dessecante",
  "Adjuvante",
  "Fertilizante foliar",
  "Bioestimulante",
  "Biológico",
  "Outro",
];

export const TIPOS_DE_ADUBACAO = [
  "Plantio",
  "Cobertura",
  "Pré-plantio",
  "Foliar",
  "Fertirrigação",
  "Correção",
  "Manutenção",
  "Biológica",
  "Orgânica",
  "Organomineral",
  "Outro",
];

export const TIPOS_DE_CALCARIO = [
  "Dolomítico",
  "Calcítico",
  "Magnesiano",
  "Cal virgem",
  "Cal hidratada",
  "Filler",
  "Outro",
];
export const TIPOS_DE_GESSO = ["Gesso agrícola", "Fosfogesso", "Outro"];

export const METODOS_DE_COLHEITA = ["Mecanizada", "Manual", "Outro"];
export const SERVICOS_DE_COLHEITA = ["Própria", "Terceirizada", "Outra"];

export const EVENTOS_CLIMATICOS = [
  "Chuva",
  "Granizo",
  "Geada",
  "Vento forte",
  "Chuva excessiva",
  "Seca",
  "Enchente",
  "Raio",
  "Outro",
];

export const TIPOS_DE_VISITA = [
  "Técnica",
  "Comercial",
  "Supervisão",
  "Regulatória",
  "Institucional",
  "Auditoria",
];

export const CATEGORIAS_DE_ANOTACAO = [
  "Geral",
  "Manejo",
  "Infraestrutura",
  "Máquinas",
  "Mão de obra",
  "Clima",
  "Solo",
  "Pragas",
  "Doenças",
  "Plantas daninhas",
  "Fertilidade",
  "Irrigação",
  "Colheita",
  "Comercial",
  "Documentação",
  "Outro",
];

export const CATEGORIAS_DE_OBSERVACAO = [
  "Pragas",
  "Doenças",
  "Nematoides",
  "Plantas daninhas",
  "Fitotoxidez",
  "Deficiência nutricional",
  "Estresse hídrico",
  "Acamamento",
  "Danos físicos/clima",
  "Qualidade de grãos",
  "Solo/compactação",
  "Estabelecimento de stand",
  "Maturação",
  "Outro",
];
export const SEVERIDADES = ["Baixa", "Média", "Alta", "Crítica"];

/** Um produto da atividade. Custo em R$/ha, digitado (o catálogo não tem preço). */
export interface ProdutoDaAtividade {
  produto_id?: string | null;
  nome: string;
  tipo?: string | null;
  dose?: number | null;
  unidade?: string | null;
  custo_ha?: number | null;
}

export interface ObservacaoDaAtividade {
  categoria: string;
  alvo: string;
  severidade: string;
}

/**
 * Campos próprios de cada tipo — guardados em `farm_activities.details`. Tudo
 * opcional: o que não se aplica ao tipo simplesmente não vai.
 */
export interface DetalhesDaAtividade {
  metodo?: string;
  estadio?: string;
  tipo_adubacao?: string;
  /** Calagem/gessagem. */
  corretivo_tipo?: string;
  corretivo_dose?: number;
  corretivo_unidade?: string;
  /** R$ por unidade da dose (ex.: R$/t). */
  corretivo_preco?: number;
  /** Irrigação. */
  lamina_mm?: number;
  custo_mm_ha?: number;
  /** Colheita / plantio: custo direto em R$/ha. */
  custo_ha?: number;
  colheita_metodo?: string;
  colheita_servico?: string;
  produtividade?: number;
  produtividade_unidade?: string;
  /** Chuva. */
  chuva_mm?: number;
  /** Clima. */
  evento?: string;
  /** Visita. */
  visita_empresa?: string;
  visita_objetivo?: string;
  visita_tipo?: string;
  /** Anotação. */
  categoria?: string;
  /** Observação. */
  observacoes?: ObservacaoDaAtividade[];
}
