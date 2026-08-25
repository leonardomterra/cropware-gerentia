/**
 * Geometria dos gráficos do relatório — UM cálculo, DOIS pintores.
 *
 * O HTML vira `<svg>` e o pdf-lib vira `drawRectangle`/`drawSvgPath`. Se cada
 * renderizador calculasse as próprias barras, o gráfico do celular e o do
 * navegador acabariam diferentes — que é exatamente o que aconteceu com as
 * cores antes de existir `reportTheme.ts`.
 *
 * SISTEMA DE COORDENADAS: origem no CANTO SUPERIOR ESQUERDO, y cresce para
 * baixo (convenção do SVG). O pdf-lib usa o oposto e inverte na hora de pintar
 * — a conversão mora lá, num lugar só.
 */

import { FUNDO, NEUTRO } from "./reportTheme";

export interface SerieDeBarras {
  nome: string;
  cor: string;
}
export interface GrupoDeBarras {
  rotulo: string;
  /** um valor por série, na mesma ordem de `series` */
  valores: number[];
  /** projeção, não realizado — sai em tom neutro e com o rótulo em itálico */
  esmaecido?: boolean;
}
export interface ChartBarras {
  tipo: "barras";
  series: SerieDeBarras[];
  grupos: GrupoDeBarras[];
}

export interface FatiaDeRosca {
  rotulo: string;
  valor: number;
  cor: string;
}
export interface ChartRosca {
  tipo: "rosca";
  fatias: FatiaDeRosca[];
}

export type ReportChart = ChartBarras | ChartRosca;

export type Forma =
  | { tipo: "ret"; x: number; y: number; w: number; h: number; cor: string }
  | { tipo: "path"; d: string; cor: string }
  | {
      tipo: "linha";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      cor: string;
    }
  | {
      tipo: "texto";
      x: number;
      y: number;
      texto: string;
      tamanho: number;
      cor: string;
      /** "inicio" (padrão), "meio" ou "fim" — âncora horizontal */
      ancora?: "inicio" | "meio" | "fim";
      italico?: boolean;
    };

/** Rótulo de eixo — pequeno de propósito, é referência e não leitura. */
const ROTULO = 9.5;
/** Legenda. Maior que o rótulo do eixo: é o que explica a cor, e cor sem
 *  explicação legível não informa nada. */
const LEGENDA = 11.5;

/**
 * Séries de um gráfico de barras, para o renderizador montar a legenda FORA da
 * figura. Ela saiu de dentro do SVG em 25/08/2026: no topo do gráfico, roubava
 * altura útil das barras e ficava pequena demais para se ler no papel.
 */
export function legendaDeSeries(c: ReportChart): SerieDeBarras[] {
  return c.tipo === "barras" && c.series.length > 1 ? c.series : [];
}

/**
 * Barras agrupadas. Sem eixo Y de propósito: a tabela logo abaixo tem os
 * números exatos, e um eixo com escala repetiria a informação ocupando altura
 * que o A4 não tem sobrando. O gráfico aqui serve para ver a FORMA — em que mês
 * entrou mais do que saiu — e o resto se lê na tabela.
 */
export function formasDeBarras(
  c: ChartBarras,
  largura: number,
  altura: number,
): Forma[] {
  const formas: Forma[] = [];
  const alturaRotulo = 14;
  const base = altura - alturaRotulo;
  // Sem reserva para legenda: ela agora é um card abaixo da figura, montado
  // pelo renderizador (ver `legendaDeSeries`). Toda a altura vira barra.
  const util = base;
  if (util <= 0 || !c.grupos.length) return formas;

  const max = Math.max(
    1,
    ...c.grupos.flatMap((g) => g.valores.map((v) => Math.abs(v) || 0)),
  );

  const larguraGrupo = largura / c.grupos.length;
  // 0.62 do grupo é barra e o resto é respiro. Menos que isso e as barras de
  // meses vizinhos encostam; mais, e some o agrupamento visual.
  const larguraBarra = Math.max(
    2,
    (larguraGrupo * 0.62) / Math.max(1, c.series.length),
  );

  c.grupos.forEach((g, gi) => {
    const centro = gi * larguraGrupo + larguraGrupo / 2;
    const largoTotal = larguraBarra * c.series.length;
    g.valores.forEach((v, si) => {
      const h = (Math.abs(v) / max) * util;
      if (h <= 0) return;
      formas.push({
        tipo: "ret",
        x: centro - largoTotal / 2 + si * larguraBarra,
        y: base - h,
        w: larguraBarra - 1,
        h,
        // Projeção não pode competir visualmente com o realizado.
        cor: g.esmaecido ? FUNDO.previsto : c.series[si].cor,
      });
    });
    formas.push({
      tipo: "texto",
      x: centro,
      y: altura - 3,
      texto: g.rotulo,
      tamanho: ROTULO,
      cor: NEUTRO[500],
      ancora: "meio",
      italico: g.esmaecido,
    });
  });

  formas.push({
    tipo: "linha",
    x1: 0,
    y1: base,
    x2: largura,
    y2: base,
    cor: NEUTRO[200],
  });
  return formas;
}

/** Um ponto do arco. Ângulo em graus, 0 = meio-dia, sentido horário. */
function ponto(cx: number, cy: number, r: number, ang: number) {
  const a = ((ang - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * Rosca com legenda ao lado. O buraco no meio não é enfeite: numa fatia fina, o
 * anel deixa o olho comparar comprimento de arco, que é mais fácil de julgar do
 * que a área de uma cunha estreita.
 */
export function formasDeRosca(
  c: ChartRosca,
  largura: number,
  altura: number,
): Forma[] {
  const formas: Forma[] = [];
  const total = c.fatias.reduce((s, f) => s + Math.abs(f.valor), 0);
  if (total <= 0) return formas;

  const r = Math.min(altura, largura * 0.42) / 2;
  const cx = r + 4;
  const cy = altura / 2;
  const rInterno = r * 0.58;

  let ang = 0;
  for (const f of c.fatias) {
    const fatia = (Math.abs(f.valor) / total) * 360;
    if (fatia <= 0) continue;
    // 359.9 e não 360: um arco de volta completa tem início e fim no mesmo
    // ponto, e o SVG desenha nada em vez de tudo.
    const varre = Math.min(fatia, 359.9);
    const fim = ang + varre;
    const grande = varre > 180 ? 1 : 0;
    const pe = ponto(cx, cy, r, ang);
    const ps = ponto(cx, cy, r, fim);
    const qe = ponto(cx, cy, rInterno, fim);
    const qs = ponto(cx, cy, rInterno, ang);
    formas.push({
      tipo: "path",
      cor: f.cor,
      d:
        `M ${pe.x} ${pe.y} A ${r} ${r} 0 ${grande} 1 ${ps.x} ${ps.y} ` +
        `L ${qe.x} ${qe.y} A ${rInterno} ${rInterno} 0 ${grande} 0 ${qs.x} ${qs.y} Z`,
    });
    ang = fim;
  }

  const lx = cx + r + 18;
  const alturaLinha = 19;
  const inicio = cy - (c.fatias.length * alturaLinha) / 2 + alturaLinha / 2;
  c.fatias.forEach((f, i) => {
    const y = inicio + i * alturaLinha;
    formas.push({ tipo: "ret", x: lx, y: y - 6, w: 10, h: 10, cor: f.cor });
    const pct = ((Math.abs(f.valor) / total) * 100).toFixed(0);
    formas.push({
      tipo: "texto",
      x: lx + 16,
      y: y + 3,
      texto: `${f.rotulo} — ${pct}%`,
      tamanho: LEGENDA,
      cor: NEUTRO[600],
    });
  });
  return formas;
}

export function formasDoGrafico(
  c: ReportChart,
  largura: number,
  altura: number,
): Forma[] {
  return c.tipo === "barras"
    ? formasDeBarras(c, largura, altura)
    : formasDeRosca(c, largura, altura);
}

/** Altura reservada para o gráfico, em px/pt. Igual nos dois renderizadores. */
export const ALTURA_GRAFICO = 120;
