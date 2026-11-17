/**
 * PALETA DO APP — PROPOSTA (17/11/2026), em avaliação na rota /paleta (DEV).
 *
 * Ainda NÃO está aplicada nas telas: este arquivo é a fonte da página de
 * demonstração. Quando o Leonardo aprovar, as telas passam a ler daqui (e as
 * listas de cor espalhadas pelo domínio — atividades, ensaios, finalidades,
 * calendário, centros de custo, painel — deixam de ter hex próprio).
 *
 * Quatro famílias, cada uma com UM trabalho:
 *
 * 1. MARCA — grafite (#3C3C42) e o lima da Cropware (#B3FF34). O lima é
 *    destaque raro; não é cor de dado.
 * 2. NEUTROS — a escala grafite (`slate-*` remapeado em app.css). Texto,
 *    borda, superfície, ícone.
 * 3. STATUS — sucesso, atenção, perigo, informação. Significado reservado:
 *    vermelho é SÓ erro/saída/excluir; verde é SÓ sucesso/entrada. Sempre com
 *    ícone ou rótulo junto, nunca a cor sozinha.
 * 4. CATEGORIAS — 8 cores PASTÉIS em ORDEM FIXA para identidade (gráficos,
 *    selos de tipo, legenda do calendário). Validadas com o validador da
 *    skill dataviz (OKLab, simulação de daltonismo Machado 2009) — números
 *    junto da lista. A 9ª categoria não ganha cor nova: vira "Outros".
 */

// ---------------------------------------------------------------- marca

export const MARCA = {
  grafite: "#3c3c42",
  lima: "#b3ff34",
} as const;

// --------------------------------------------------------------- status

export type PapelDeStatus = "sucesso" | "atencao" | "perigo" | "info";

/**
 * Cada papel em 5 usos, sempre o MESMO degrau. Em classes do Tailwind para
 * que o tema escuro espelhe sozinho (app.css, bloco TEMA ESCURO).
 */
export const STATUS: Record<
  PapelDeStatus,
  {
    rotulo: string;
    matiz: string;
    /** Valor, mensagem curta, link de erro. */
    texto: string;
    /** Faixa de aviso / fundo de linha marcada. */
    fundo: string;
    borda: string;
    /**
     * Ponto e barra de gráfico, em hex por tema. Construído como os pastéis
     * das categorias (17/11/2026: os tons 300 do Tailwind destoavam deles —
     * verde menta e vermelho rosado). OKLCH, saturação 0,12; o VERDE é mais
     * claro (0,80) que o VERMELHO (0,68) de propósito: verde × vermelho é o
     * par que o daltônico confunde, e a diferença de claridade é o que os
     * separa (validador: ΔE 11,6 claro / 9,6 escuro, alvo 8). O botão de
     * excluir e a bolinha de notificação seguem no #f87171 (escolha dele).
     */
    solido: { claro: string; escuro: string };
    /** Selo (Badge colorScheme). */
    selo: "emerald" | "amber" | "red" | "blue";
  }
> = {
  sucesso: {
    rotulo: "Sucesso · entrada",
    matiz: "emerald",
    texto: "text-emerald-700",
    fundo: "bg-emerald-50",
    borda: "border-emerald-200",
    solido: { claro: "#6dd6a7", escuro: "#52bc8e" },
    selo: "emerald",
  },
  atencao: {
    rotulo: "Atenção · vencendo",
    matiz: "amber",
    texto: "text-amber-700",
    fundo: "bg-amber-50",
    borda: "border-amber-200",
    solido: { claro: "#eca851", escuro: "#d49648" },
    selo: "amber",
  },
  perigo: {
    rotulo: "Perigo · saída · erro",
    matiz: "red",
    texto: "text-red-700",
    fundo: "bg-red-50",
    borda: "border-red-200",
    solido: { claro: "#d87972", escuro: "#c46760" },
    selo: "red",
  },
  info: {
    rotulo: "Informação",
    matiz: "blue",
    texto: "text-blue-700",
    fundo: "bg-blue-50",
    borda: "border-blue-200",
    solido: { claro: "#6d9eef", escuro: "#608cd5" },
    selo: "blue",
  },
};

// ----------------------------------------------------------- categorias

export interface CorDeCategoria {
  matiz: string;
  claro: string;
  escuro: string;
}

export interface OpcaoDeCategorias {
  id: string;
  nome: string;
  descricao: string;
  /** Pior par vizinho no validador: ΔE daltonismo / ΔE visão normal (o
   *  menor entre claro e escuro). Alvo ≥ 8 / piso 15. */
  distincao: string;
  /** Menor contraste de uma cor contra o branco (marca de gráfico pede 3:1;
   *  abaixo disso, legenda e valor escrito são obrigatórios). */
  contrasteMinimo: string;
  cores: CorDeCategoria[];
}

/**
 * OPÇÕES em avaliação (17/11/2026). O Leonardo pediu tons "mais pastéis" e,
 * vendo a pastel aplicada, quis mais opções. Todas usam os MESMOS 8 matizes
 * (os do Tailwind) e mudam o clima pela claridade e saturação, construídas em
 * OKLCH. A claridade ALTERNA entre vizinhos (com todas iguais, os vizinhos
 * ficavam parecidos demais para quem enxerga normal), e a ordem saiu de uma
 * enumeração das 5.040 ordens possíveis com o lima fixo em 1º, exigindo
 * passar no claro e no escuro, inclusive as 3 primeiras em "todos os pares"
 * (rosca). A "Viva" é a primeira proposta, nos tons 600 do Tailwind.
 */
export const OPCOES_DE_CATEGORIAS: OpcaoDeCategorias[] = [
  {
    id: "pastel",
    nome: "Pastel",
    descricao: "Claridade 0,70/0,78, saturação 0,13.",
    distincao: "13,0 / 20,0",
    contrasteMinimo: "1,9:1",
    cores: [
      { matiz: "lime", claro: "#82af54", escuro: "#729b49" },
      { matiz: "blue", claro: "#85b8ff", escuro: "#77a5ef" },
      { matiz: "pink", claro: "#dc7aa3", escuro: "#c46b91" },
      { matiz: "sky", claro: "#5ac3ff", escuro: "#50afe6" },
      { matiz: "orange", claro: "#df8353", escuro: "#c67448" },
      { matiz: "violet", claro: "#baa7ff", escuro: "#a796e9" },
      { matiz: "amber", claro: "#d18f35", escuro: "#ba7e2d" },
      { matiz: "teal", claro: "#30d2be", escuro: "#2abdab" },
    ],
  },
  {
    id: "algodao",
    nome: "Bem clara",
    descricao: "Claridade 0,76/0,84, saturação 0,10. A mais leve.",
    distincao: "10,4 / 16,0",
    contrasteMinimo: "1,6:1",
    cores: [
      { matiz: "lime", claro: "#9bbe7a", escuro: "#7d9f5c" },
      { matiz: "blue", claro: "#a4ccff", escuro: "#85acea" },
      { matiz: "pink", claro: "#e496b5", escuro: "#c27896" },
      { matiz: "sky", claro: "#89d5ff", escuro: "#6ab4e2" },
      { matiz: "orange", claro: "#e69d79", escuro: "#c47f5b" },
      { matiz: "violet", claro: "#ccbfff", escuro: "#ad9fe5" },
      { matiz: "amber", claro: "#daa668", escuro: "#b98749" },
      { matiz: "teal", claro: "#79e0d0", escuro: "#57bfb0" },
    ],
  },
  {
    id: "suave",
    nome: "Suave",
    descricao: "Claridade 0,66/0,74, saturação 0,10. Pastel mais acinzentado.",
    distincao: "11,0 / 16,7",
    contrasteMinimo: "2,2:1",
    cores: [
      { matiz: "lime", claro: "#7d9f5c", escuro: "#6b8c4b" },
      { matiz: "blue", claro: "#85acea", escuro: "#7399d6" },
      { matiz: "pink", claro: "#c27896", escuro: "#af6684" },
      { matiz: "sky", claro: "#6ab4e2", escuro: "#57a1ce" },
      { matiz: "orange", claro: "#c47f5b", escuro: "#b16d49" },
      { matiz: "violet", claro: "#ad9fe5", escuro: "#9a8dd1" },
      { matiz: "amber", claro: "#b98749", escuro: "#a67537" },
      { matiz: "teal", claro: "#57bfb0", escuro: "#41ac9d" },
    ],
  },
  {
    id: "terrosa",
    nome: "Terrosa",
    descricao: "Claridade 0,58/0,66, saturação 0,09. Tons de terra, sóbrios.",
    distincao: "10,5 / 15,4",
    contrasteMinimo: "3,0:1",
    cores: [
      { matiz: "lime", claro: "#68854b", escuro: "#739157" },
      { matiz: "blue", claro: "#7193c9", escuro: "#7d9fd7" },
      { matiz: "pink", claro: "#a4637e", escuro: "#b16f8a" },
      { matiz: "sky", claro: "#599ac3", escuro: "#65a7d0" },
      { matiz: "orange", claro: "#a6694a", escuro: "#b37556" },
      { matiz: "violet", claro: "#9488c5", escuro: "#a094d2" },
      { matiz: "amber", claro: "#9c703a", escuro: "#a97c46" },
      { matiz: "teal", claro: "#48a497", escuro: "#56b1a3" },
    ],
  },
  {
    id: "profunda",
    nome: "Profunda",
    descricao: "Claridade 0,50/0,60, saturação 0,13. Escura e elegante.",
    distincao: "13,2 / 20,7",
    contrasteMinimo: "3,6:1",
    cores: [
      { matiz: "lime", claro: "#48710e", escuro: "#648f34" },
      { matiz: "blue", claro: "#507fcd", escuro: "#6798e8" },
      { matiz: "pink", claro: "#993e68", escuro: "#ba5c85" },
      { matiz: "sky", claro: "#088ac4", escuro: "#35a3de" },
      { matiz: "orange", claro: "#9c470e", escuro: "#bd6533" },
      { matiz: "violet", claro: "#846fc6", escuro: "#9b88e1" },
      { matiz: "amber", claro: "#915200", escuro: "#b17000" },
      { matiz: "teal", claro: "#009887", escuro: "#00b29f" },
    ],
  },
  {
    id: "viva",
    nome: "Viva",
    descricao: "Tons 600 do Tailwind. A primeira proposta.",
    distincao: "14,8 / 24,9",
    contrasteMinimo: "3,1:1",
    cores: [
      { matiz: "lime", claro: "#5ea500", escuro: "#5ea500" },
      { matiz: "blue", claro: "#155dfc", escuro: "#2b7fff" },
      { matiz: "pink", claro: "#e60076", escuro: "#f6339a" },
      { matiz: "violet", claro: "#7f22fe", escuro: "#8e51ff" },
      { matiz: "teal", claro: "#009689", escuro: "#009689" },
      { matiz: "orange", claro: "#f54900", escuro: "#f54900" },
      { matiz: "sky", claro: "#0084d1", escuro: "#0084d1" },
      { matiz: "amber", claro: "#e17100", escuro: "#e17100" },
    ],
  },
];

/** A opção em uso nas demonstrações até o Leonardo escolher. */
export const CATEGORIAS: CorDeCategoria[] = OPCOES_DE_CATEGORIAS[0].cores;

/** "Outros" e o que não tem categoria: grafite 400 (não compete). */
export const OUTROS = { claro: "#a1a1a7", escuro: "#6a6a72" } as const;

/** Cor da i-ésima categoria no tema; da 9ª em diante, "Outros". */
export function corDaCategoria(
  i: number,
  tema: "claro" | "escuro",
  paleta: CorDeCategoria[] = CATEGORIAS,
): string {
  const c = paleta[i];
  return c ? c[tema] : OUTROS[tema];
}
