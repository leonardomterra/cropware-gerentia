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
    /** Ponto e barra de gráfico. Tom 300 (17/11/2026), para conversar com as
     *  categorias pastéis; no escuro espelha para o 700. O botão de excluir e
     *  a bolinha de notificação seguem no #f87171 (escolha do Leonardo). */
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
    solido: "bg-emerald-300",
    selo: "emerald",
  },
  atencao: {
    rotulo: "Atenção · vencendo",
    matiz: "amber",
    texto: "text-amber-700",
    fundo: "bg-amber-50",
    borda: "border-amber-200",
    solido: "bg-amber-300",
    selo: "amber",
  },
  perigo: {
    rotulo: "Perigo · saída · erro",
    matiz: "red",
    texto: "text-red-700",
    fundo: "bg-red-50",
    borda: "border-red-200",
    solido: "bg-red-300",
    selo: "red",
  },
  info: {
    rotulo: "Informação",
    matiz: "blue",
    texto: "text-blue-700",
    fundo: "bg-blue-50",
    borda: "border-blue-200",
    solido: "bg-blue-300",
    selo: "blue",
  },
};

// ----------------------------------------------------------- categorias

export interface CorDeCategoria {
  matiz: string;
  claro: string;
  escuro: string;
}

/**
 * PASTÉIS (escolha de 17/11/2026: "uns tons um pouco mais pastéis"). Os tons
 * 300/400 do Tailwind ficam claros mas berrantes (quase neon), e o 300 falha
 * na distinção entre vizinhos; então a cor é construída em OKLCH: o matiz do
 * Tailwind, saturação baixa (C 0,13 no claro / 0,12 no escuro) e claridade
 * ALTERNADA entre vizinhos (0,70/0,78 no claro, 0,64/0,72 no escuro) — com
 * todas na mesma claridade, os vizinhos ficavam parecidos demais para quem
 * enxerga normal. A ordem foi escolhida por enumeração para essa alternância.
 *
 * Validador da skill dataviz: vizinhos ΔE 13,0 daltonismo / 20,0 visão normal
 * (claro) e 12,4 / 19,4 (escuro); as 3 primeiras passam "todos os pares".
 * Custo de ser pastel: no fundo branco ficam entre 1,9 e 2,9:1 de contraste,
 * abaixo dos 3:1 — por isso todo gráfico leva legenda e valor escrito (regra
 * de alívio), nunca a cor sozinha.
 */
export const CATEGORIAS: CorDeCategoria[] = [
  { matiz: "lime", claro: "#82af54", escuro: "#729b49" },
  { matiz: "blue", claro: "#85b8ff", escuro: "#77a5ef" },
  { matiz: "pink", claro: "#dc7aa3", escuro: "#c46b91" },
  { matiz: "sky", claro: "#5ac3ff", escuro: "#50afe6" },
  { matiz: "orange", claro: "#df8353", escuro: "#c67448" },
  { matiz: "violet", claro: "#baa7ff", escuro: "#a796e9" },
  { matiz: "amber", claro: "#d18f35", escuro: "#ba7e2d" },
  { matiz: "teal", claro: "#30d2be", escuro: "#2abdab" },
];

/** A primeira proposta (tons 600 do Tailwind), guardada para comparar na
 *  página. Vizinhos ΔE 14,8 / 24,9; contraste ≥ 3:1 no branco. */
export const CATEGORIAS_VIVAS: CorDeCategoria[] = [
  { matiz: "lime", claro: "#5ea500", escuro: "#5ea500" },
  { matiz: "blue", claro: "#155dfc", escuro: "#2b7fff" },
  { matiz: "pink", claro: "#e60076", escuro: "#f6339a" },
  { matiz: "violet", claro: "#7f22fe", escuro: "#8e51ff" },
  { matiz: "teal", claro: "#009689", escuro: "#009689" },
  { matiz: "orange", claro: "#f54900", escuro: "#f54900" },
  { matiz: "sky", claro: "#0084d1", escuro: "#0084d1" },
  { matiz: "amber", claro: "#e17100", escuro: "#e17100" },
];

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
