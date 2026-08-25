import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatBRL } from "@/modules/receipts/utils/receiptFormatters";
import {
  appendAttachments,
  pdfDocToBlob,
  type AttachmentItem,
} from "@/modules/receipts/utils/mergeAttachmentsPdf";
import type { ReportCell, ReportColumn, ReportDoc } from "./reportBuilders";
import { ALTURA_GRAFICO, formasDoGrafico } from "./reportCharts";
import {
  ACENTO,
  ICONE_VIEWBOX,
  ICONES,
  NEUTRO,
  pdfRgb,
  type NomeDeIcone,
} from "./reportTheme";

// Gera o relatório como PDF vetorial (pdf-lib). Usado no app nativo (iOS/Android),
// onde não dá pra abrir uma aba de impressão — o usuário recebe um PDF real pra
// salvar/compartilhar/imprimir. No web mantemos a página HTML (reportExport).

const A4_W = 595.28;
const A4_H = 841.89;
const M = 40; // margem
const CW = A4_W - M * 2; // largura útil

// Cores vindas de reportTheme — a MESMA lista que a página HTML usa.
//
// Até 25/08/2026 estavam escritas à mão aqui como `slate-*` do Tailwind cru,
// que é azulado; o app remapeia `slate` para a família NEUTRAL no @theme. O PDF
// do celular saía com um azul que a tela não tem, e ninguém comparou os dois
// lado a lado para perceber.
const cor = (hex: string) => rgb(...pdfRgb(hex));

const INK = cor(NEUTRO[900]);
const MUTED = cor(NEUTRO[500]);
const HEAD = cor(NEUTRO[700]);
const IN = cor(ACENTO.entradaEscuro);
const OUT = cor(ACENTO.saidaEscuro);
const LINE = cor(NEUTRO[200]);
const LINE_SOFT = cor(NEUTRO[100]);
const TOT_LINE = cor(NEUTRO[300]);
const FAINT = cor(NEUTRO[400]);
const ZEBRA = cor(NEUTRO[50]);

// Helvetica (WinAnsi) não codifica nbsp/narrow-nbsp/thin-space (o Intl de moeda
// usa nbsp entre "R$" e o número) — troca por espaço normal senão drawText falha.
function san(s: unknown): string {
  return String(s ?? "").replace(/[\u00A0\u202F\u2009]/g, " ");
}

function dispCell(v: ReportCell, col: ReportColumn): string {
  if (col.money && typeof v === "number" && Number.isFinite(v))
    return formatBRL(v);
  if (col.money && (v === "" || v === null || v === undefined)) return "";
  return String(v ?? "");
}

// Larguras das colunas: as com width "56%" viram fração da largura útil; as sem
// width dividem o espaço restante (mesma regra da página HTML).
function colWidths(columns: ReportColumn[], total: number): number[] {
  const explicit = columns.map((c) =>
    c.width ? (parseFloat(c.width) / 100) * total : null,
  );
  const used = explicit.reduce<number>((s, w) => s + (w ?? 0), 0);
  const autoN = explicit.filter((w) => w === null).length;
  const autoW = autoN > 0 ? Math.max(0, (total - used) / autoN) : 0;
  return explicit.map((w) => w ?? autoW);
}

export async function reportToPdf(
  doc: ReportDoc,
  items: AttachmentItem[] = [],
): Promise<{ blob: Blob; failed: number }> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([A4_W, A4_H]);
  let y = A4_H - M;

  const newPage = () => {
    page = pdf.addPage([A4_W, A4_H]);
    y = A4_H - M;
  };
  const ensure = (h: number) => {
    if (y - h < M) newPage();
  };
  // Trunca com "…" pra caber em maxW.
  const fit = (s: string, f: PDFFont, size: number, maxW: number): string => {
    s = san(s);
    if (f.widthOfTextAtSize(s, size) <= maxW) return s;
    let t = s;
    while (t.length > 1 && f.widthOfTextAtSize(t + "…", size) > maxW) {
      t = t.slice(0, -1);
    }
    return t + "…";
  };
  const draw = (
    s: string,
    x: number,
    baseline: number,
    size: number,
    f: PDFFont,
    color = INK,
  ) => page.drawText(san(s), { x, y: baseline, size, font: f, color });

  /**
   * Ícone duotone. `drawSvgPath` do pdf-lib desenha o path com y crescendo PARA
   * BAIXO a partir da âncora — a mesma convenção do SVG —, então a âncora é o
   * canto SUPERIOR esquerdo, e não o inferior como no resto desta função.
   */
  const icone = (
    nome: NomeDeIcone,
    x: number,
    topo: number,
    px: number,
    hex: string,
  ) => {
    const i = ICONES[nome];
    const escala = px / ICONE_VIEWBOX;
    const c = cor(hex);
    page.drawSvgPath(i.fundo, {
      x,
      y: topo,
      scale: escala,
      color: c,
      opacity: 0.2,
    });
    page.drawSvgPath(i.frente, { x, y: topo, scale: escala, color: c });
  };

  /**
   * Gráfico. As formas vêm de reportCharts — o MESMO cálculo da página HTML —
   * em coordenadas com origem no topo e y para baixo. Aqui elas viram
   * coordenadas de PDF (origem embaixo, y para cima) num lugar só.
   */
  const grafico = (t: ReportDoc["tables"][number]) => {
    if (!t.chart) return;
    const formas = formasDoGrafico(t.chart, CW, ALTURA_GRAFICO);
    if (!formas.length) return;
    ensure(ALTURA_GRAFICO + 10);
    const topo = y;
    const py = (v: number) => topo - v;
    for (const f of formas) {
      if (f.tipo === "ret") {
        page.drawRectangle({
          x: M + f.x,
          y: py(f.y + f.h),
          width: f.w,
          height: f.h,
          color: cor(f.cor),
        });
      } else if (f.tipo === "linha") {
        page.drawLine({
          start: { x: M + f.x1, y: py(f.y1) },
          end: { x: M + f.x2, y: py(f.y2) },
          thickness: 0.7,
          color: cor(f.cor),
        });
      } else if (f.tipo === "path") {
        // O path já está em coordenadas y-para-baixo: drawSvgPath usa a mesma
        // convenção, então basta ancorar no topo do gráfico.
        page.drawSvgPath(f.d, { x: M, y: topo, scale: 1, color: cor(f.cor) });
      } else {
        const txt = san(f.texto);
        const larg = font.widthOfTextAtSize(txt, f.tamanho);
        const dx =
          f.ancora === "meio" ? -larg / 2 : f.ancora === "fim" ? -larg : 0;
        draw(txt, M + f.x + dx, py(f.y), f.tamanho, font, cor(f.cor));
      }
    }
    y = topo - ALTURA_GRAFICO - 10;
  };

  // ---- Cabeçalho ----------------------------------------------------------
  ensure(70);
  draw("gerentia.app", M, y - 12, 12, bold, INK);
  y -= 12 + 16;
  draw(fit(doc.title, bold, 18, CW), M, y - 18, 18, bold, INK);
  y -= 18 + 5;
  const sub = `${doc.periodLabel} — ${doc.ccLabel}`;
  draw(fit(sub, font, 10.5, CW), M, y - 10.5, 10.5, font, MUTED);
  y -= 10.5 + 14;
  page.drawLine({
    start: { x: M, y },
    end: { x: A4_W - M, y },
    thickness: 1,
    color: LINE,
  });
  y -= 18;

  // ---- KPIs ---------------------------------------------------------------
  if (doc.meta.length) {
    const gap = 10;
    const n = doc.meta.length;
    const bw = (CW - gap * (n - 1)) / n;
    const bh = 48;
    ensure(bh + 20);
    const top = y;
    doc.meta.forEach((m, i) => {
      const bx = M + i * (bw + gap);
      page.drawRectangle({
        x: bx,
        y: top - bh,
        width: bw,
        height: bh,
        borderColor: LINE,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });
      // Faixa de cor à esquerda, igual à do card na tela: diz "entrou" ou
      // "saiu" antes de o olho chegar no número.
      const faixa =
        m.tone === "in"
          ? ACENTO.entrada
          : m.tone === "out"
            ? ACENTO.saida
            : NEUTRO[300];
      page.drawRectangle({
        x: bx,
        y: top - bh,
        width: 3,
        height: bh,
        color: cor(faixa),
      });
      if (m.icon) {
        icone(
          m.icon,
          bx + bw - 24,
          top - 10,
          14,
          m.tone === "in"
            ? ACENTO.entrada
            : m.tone === "out"
              ? ACENTO.saida
              : NEUTRO[400],
        );
      }
      draw(fit(m.label, font, 9, bw - 40), bx + 13, top - 19, 9, font, MUTED);
      const vColor =
        m.tone === "in"
          ? IN
          : m.tone === "out"
            ? OUT
            : m.tone === "muted"
              ? MUTED
              : INK;
      draw(
        fit(m.value, bold, 15, bw - 20),
        bx + 13,
        top - 39,
        15,
        bold,
        vColor,
      );
    });
    y = top - bh - 20;
  }

  // ---- Tabelas ------------------------------------------------------------
  const drawTable = (t: ReportDoc["tables"][number]) => {
    if (t.title) {
      // Reserva o título E o gráfico JUNTOS. Separados, o `ensure` de cada um
      // deixava o título no fim de uma página e a figura no começo da outra —
      // um cabeçalho órfão, que é o pior dos dois mundos: ocupa espaço e não
      // explica nada.
      ensure(11 + 10 + (t.chart ? ALTURA_GRAFICO + 10 : 0));
      let tx = M;
      if (t.icon) {
        icone(t.icon, M, y - 1, 13, t.accent ?? NEUTRO[500]);
        tx = M + 18;
      }
      draw(fit(t.title, bold, 11, CW - (tx - M)), tx, y - 11, 11, bold, HEAD);
      y -= 11 + 10;
    }
    grafico(t);
    const widths = colWidths(t.columns, CW);
    const xs: number[] = [];
    let cx = M;
    for (const w of widths) {
      xs.push(cx);
      cx += w;
    }
    const pad = 6;

    const rowCells = (
      cells: (string | ReportCell)[],
      f: PDFFont,
      size: number,
      color: import("pdf-lib").RGB,
      opts: { header?: boolean; total?: boolean; zebra?: boolean } = {},
    ) => {
      const rh = size + 11;
      ensure(rh);
      // Faixa alternada: em tabela longa é o que impede o olho de pular de
      // linha ao atravessar a folha.
      if (opts.zebra) {
        page.drawRectangle({
          x: M,
          y: y - rh + 2,
          width: CW,
          height: rh,
          color: ZEBRA,
        });
      }
      if (opts.total) {
        page.drawLine({
          start: { x: M, y },
          end: { x: A4_W - M, y },
          thickness: 1.4,
          color: TOT_LINE,
        });
      }
      const baseline = y - size - 3;
      cells.forEach((cell, i) => {
        const col = t.columns[i];
        const raw = opts.header
          ? String(cell)
          : dispCell(cell as ReportCell, col);
        const right = col.align === "right";
        const maxW = widths[i] - pad * 2;
        const s = fit(raw, f, size, maxW);
        const w = f.widthOfTextAtSize(s, size);
        const tx = right ? xs[i] + widths[i] - pad - w : xs[i] + pad;
        draw(s, tx, baseline, size, f, color);
      });
      y -= rh;
      if (!opts.total) {
        page.drawLine({
          start: { x: M, y: y + 2 },
          end: { x: A4_W - M, y: y + 2 },
          thickness: opts.header ? 0.75 : 0.5,
          color: opts.header ? LINE : LINE_SOFT,
        });
      }
    };

    rowCells(
      t.columns.map((c) => c.label.toUpperCase()),
      bold,
      8,
      MUTED,
      { header: true },
    );
    t.rows.forEach((row, i) =>
      rowCells(row, font, 10, INK, { zebra: i % 2 === 1 }),
    );
    if (t.total) rowCells(t.total, bold, 10, INK, { total: true });
    y -= 16;
  };

  if (doc.tables.length) {
    for (const t of doc.tables) drawTable(t);
  } else {
    ensure(14);
    draw("Sem dados para o período.", M, y - 11, 11, font, MUTED);
    y -= 20;
  }

  // ---- Rodapé -------------------------------------------------------------
  ensure(12);
  draw(
    `Gerado por gerentia.app — ${new Date().toLocaleString("pt-BR")}`,
    M,
    y - 8,
    8,
    font,
    FAINT,
  );

  // ---- Anexos (opcional) --------------------------------------------------
  const failed = items.length ? await appendAttachments(pdf, items) : 0;
  return { blob: await pdfDocToBlob(pdf), failed };
}
