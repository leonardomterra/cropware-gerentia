import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatBRL } from "@/modules/receipts/utils/receiptFormatters";
import {
  appendAttachments,
  pdfDocToBlob,
  type AttachmentItem,
} from "@/modules/receipts/utils/mergeAttachmentsPdf";
import type { ReportCell, ReportColumn, ReportDoc } from "./reportBuilders";

// Gera o relatório como PDF vetorial (pdf-lib). Usado no app nativo (iOS/Android),
// onde não dá pra abrir uma aba de impressão — o usuário recebe um PDF real pra
// salvar/compartilhar/imprimir. No web mantemos a página HTML (reportExport).

const A4_W = 595.28;
const A4_H = 841.89;
const M = 40; // margem
const CW = A4_W - M * 2; // largura útil

const INK = rgb(0.06, 0.09, 0.16); // slate-900
const MUTED = rgb(0.39, 0.45, 0.55); // slate-500
const HEAD = rgb(0.2, 0.25, 0.33); // slate-700
const IN = rgb(0.02, 0.47, 0.34); // emerald-700
const LINE = rgb(0.89, 0.91, 0.94); // slate-200
const LINE_SOFT = rgb(0.93, 0.95, 0.97); // #eef2f6
const TOT_LINE = rgb(0.8, 0.84, 0.88); // slate-300
const FAINT = rgb(0.58, 0.64, 0.7); // slate-400

// Helvetica (WinAnsi) não codifica nbsp/narrow-nbsp/thin-space (o Intl de moeda
// usa nbsp entre "R$" e o número) — troca por espaço normal senão drawText falha.
function san(s: unknown): string {
  return String(s ?? "").replace(/[\u00A0\u202F\u2009]/g, " ");
}

function dispCell(v: ReportCell, col: ReportColumn): string {
  if (col.money && typeof v === "number" && Number.isFinite(v)) return formatBRL(v);
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

  // ---- Cabeçalho ----------------------------------------------------------
  ensure(70);
  draw("gerentia.app", M, y - 12, 12, bold, INK);
  y -= 12 + 16;
  draw(fit(doc.title, bold, 18, CW), M, y - 18, 18, bold, INK);
  y -= 18 + 5;
  const sub = `${doc.periodLabel} — ${doc.ccLabel}`;
  draw(fit(sub, font, 10.5, CW), M, y - 10.5, 10.5, font, MUTED);
  y -= 10.5 + 14;
  page.drawLine({ start: { x: M, y }, end: { x: A4_W - M, y }, thickness: 1, color: LINE });
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
      draw(fit(m.label, font, 9, bw - 20), bx + 11, top - 19, 9, font, MUTED);
      const vColor = m.tone === "in" ? IN : m.tone === "muted" ? MUTED : INK;
      draw(fit(m.value, bold, 15, bw - 20), bx + 11, top - 39, 15, bold, vColor);
    });
    y = top - bh - 20;
  }

  // ---- Tabelas ------------------------------------------------------------
  const drawTable = (t: ReportDoc["tables"][number]) => {
    if (t.title) {
      ensure(11 + 10);
      draw(fit(t.title, bold, 11, CW), M, y - 11, 11, bold, HEAD);
      y -= 11 + 10;
    }
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
      opts: { header?: boolean; total?: boolean } = {},
    ) => {
      const rh = size + 11;
      ensure(rh);
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
        const raw = opts.header ? String(cell) : dispCell(cell as ReportCell, col);
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

    rowCells(t.columns.map((c) => c.label.toUpperCase()), bold, 8, MUTED, { header: true });
    for (const row of t.rows) rowCells(row, font, 10, INK);
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
