/**
 * Tokens dos relatórios — FONTE ÚNICA para os dois renderizadores.
 *
 * O mesmo `ReportDoc` é desenhado de duas formas: página HTML no web
 * (`reportExport.ts`) e PDF vetorial no app nativo (`reportPdf.ts`). Até
 * 25/08/2026 cada um tinha a própria lista de cores, e elas divergiram sem
 * ninguém notar:
 *
 *   tinta     HTML #171717 (o neutro do app)   PDF slate-900 #0f172a (azulado)
 *   apoio     HTML #737373                     PDF slate-500 #64748b
 *
 * A causa: o app REMAPEIA `slate-*` para a família neutra no `@theme`
 * (`app.css`), mas o `pdf-lib` usava os valores do Tailwind cru. O PDF do
 * celular saía com um azul que a tela não tem.
 *
 * Por isso as cores moram aqui, em hex, e o helper `pdfRgb` converte para o
 * formato do pdf-lib. Mudar a paleta do relatório = editar este arquivo.
 */

import { STATUS } from "@/lib/paleta";

/** Neutros — espelham `--color-slate-*` de app.css (escala GRAFITE da marca
 *  desde 17/11/2026; antes, família NEUTRAL). */
export const NEUTRO = {
  50: "#f7f7f9",
  100: "#f1f1f3",
  200: "#e2e2e6",
  300: "#cacacf",
  400: "#a1a1a7",
  500: "#7c7c83",
  600: "#606066",
  700: "#4c4c52",
  800: "#3c3c42",
  900: "#2b2b30",
} as const;

/**
 * Cores de acento. Estas NÃO são remapeadas pelo app — são as do Tailwind — e
 * são as mesmas dos ícones duotone das telas, de propósito: o relatório tem que
 * parecer a continuação do app, não um documento de outro sistema.
 */
export const ACENTO = {
  entrada: "#10b981", // emerald-500
  /**
   * Verde e vermelho dos VALORES. Tons 800, e não 600/700: no relatório o
   * número já está grande e sozinho no card — a cor só precisa dizer o sinal,
   * não gritar. Saturação alta em texto grande cansa numa folha inteira.
   */
  entradaEscuro: "#065f46", // emerald-800
  saida: "#f87171", // red-400 — o mesmo das barras e do botão destrutivo
  saidaEscuro: "#991b1b", // red-800
  alerta: "#d97706", // amber-600
  info: "#0ea5e9", // sky-500
  roxo: "#8b5cf6", // violet-500
  indigo: "#6366f1",
  teal: "#14b8a6",
} as const;

/**
 * Preenchimento das barras. São EXATAMENTE as cores do gráfico do Dashboard
 * (`COLOR_IN`/`COLOR_OUT` em DashboardPage) — o relatório é a mesma figura da
 * tela impressa, e um verde diferente no papel denuncia que são dois sistemas.
 */
export const FUNDO = {
  /** "Sólido" de status da paleta do app (src/lib/paleta.ts, 17/11/2026),
   *  valor do tema claro — o papel não tem tema. */
  entrada: STATUS.sucesso.solido.claro,
  saida: STATUS.perigo.solido.claro,
  /** Projeção: cinza, para não competir com o realizado. */
  previsto: "#e2e2e6",
} as const;

export const TIPOGRAFIA = {
  h1: 22,
  h2: 14,
  corpo: 13.5,
  rotulo: 12,
  miudo: 11,
  kpiValor: 18,
} as const;

/** hex "#rrggbb" → [0..1, 0..1, 0..1], que é o que `rgb()` do pdf-lib espera. */
export function pdfRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}
