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
 * 4. CATEGORIAS — 8 cores em ORDEM FIXA para identidade (gráficos, selos de
 *    tipo, legenda do calendário). Validadas com o validador da skill dataviz
 *    (OKLab, simulação de daltonismo Machado 2009): pior par vizinho ΔE 14,8
 *    (alvo ≥ 8) e visão normal ≥ 24,9 (piso 15), no claro e no escuro; as 3
 *    primeiras passam também "todos os pares" (gráfico de rosca/dispersão).
 *    A 9ª categoria não ganha cor nova: vira "Outros" (grafite).
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
    /** Ponto, barra, botão cheio. */
    solido: string;
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
    solido: "bg-emerald-400",
    selo: "emerald",
  },
  atencao: {
    rotulo: "Atenção · vencendo",
    matiz: "amber",
    texto: "text-amber-700",
    fundo: "bg-amber-50",
    borda: "border-amber-200",
    solido: "bg-amber-400",
    selo: "amber",
  },
  perigo: {
    rotulo: "Perigo · saída · erro",
    matiz: "red",
    texto: "text-red-700",
    fundo: "bg-red-50",
    borda: "border-red-200",
    solido: "bg-red-400",
    selo: "red",
  },
  info: {
    rotulo: "Informação",
    matiz: "blue",
    texto: "text-blue-700",
    fundo: "bg-blue-50",
    borda: "border-blue-200",
    solido: "bg-blue-400",
    selo: "blue",
  },
};

// ----------------------------------------------------------- categorias

export interface CorDeCategoria {
  matiz: string;
  /** Degrau do Tailwind no claro / no escuro (o escuro NÃO é o espelho
   *  automático: o espelho 600→400 sai claro demais para marca de gráfico). */
  degrau: { claro: number; escuro: number };
  claro: string;
  escuro: string;
}

export const CATEGORIAS: CorDeCategoria[] = [
  { matiz: "lime", degrau: { claro: 600, escuro: 600 }, claro: "#5ea500", escuro: "#5ea500" },
  { matiz: "blue", degrau: { claro: 600, escuro: 500 }, claro: "#155dfc", escuro: "#2b7fff" },
  { matiz: "pink", degrau: { claro: 600, escuro: 500 }, claro: "#e60076", escuro: "#f6339a" },
  { matiz: "violet", degrau: { claro: 600, escuro: 500 }, claro: "#7f22fe", escuro: "#8e51ff" },
  { matiz: "teal", degrau: { claro: 600, escuro: 600 }, claro: "#009689", escuro: "#009689" },
  { matiz: "orange", degrau: { claro: 600, escuro: 600 }, claro: "#f54900", escuro: "#f54900" },
  { matiz: "sky", degrau: { claro: 600, escuro: 600 }, claro: "#0084d1", escuro: "#0084d1" },
  { matiz: "amber", degrau: { claro: 600, escuro: 600 }, claro: "#e17100", escuro: "#e17100" },
];

/** "Outros" e o que não tem categoria: grafite 400 (não compete). */
export const OUTROS = { claro: "#a1a1a7", escuro: "#6a6a72" } as const;

/** Cor da i-ésima categoria no tema; da 9ª em diante, "Outros". */
export function corDaCategoria(i: number, tema: "claro" | "escuro"): string {
  const c = CATEGORIAS[i];
  return c ? c[tema] : OUTROS[tema];
}
