import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatBRL } from "@/modules/receipts/utils/receiptFormatters";
import {
  appendAttachments,
  pdfDocToBlob,
  type AttachmentItem,
} from "@/modules/receipts/utils/mergeAttachmentsPdf";
import type { ReportCell, ReportColumn, ReportDoc } from "./reportBuilders";

// A4 retrato (pontos) + margem.
const W = 595.28;
const H = 841.89;
const M = 40;

const SLATE = rgb(0.06, 0.09, 0.16);
const SLATE_700 = rgb(0.25, 0.3, 0.36);
const GRAY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.88, 0.91);
const LINE_STRONG = rgb(0.75, 0.78, 0.82);
const EMERALD = rgb(0.02, 0.47, 0.34);

// Mantém só caracteres que o Helvetica (WinAnsi) consegue codificar — evita
// throw do pdf-lib com emoji/unicode exótico em nomes de fornecedor etc.
function safe(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, "");
}

/**
 * Gera o relatório como páginas PDF (pdf-lib) e, em seguida, ANEXA os arquivos
 * dos lançamentos (PDFs + imagens) logo após — tudo num único PDF. Reusa
 * `appendAttachments` da aba Anexos. Retorna o blob + quantos anexos falharam.
 */
export async function buildReportWithAttachmentsPdf(
  doc: ReportDoc,
  items: AttachmentItem[],
): Promise<{ blob: Blob; failed: number }> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([W, H]);
  let y = H - M;

  const widthOf = (s: string, size: number, f: PDFFont) => f.widthOfTextAtSize(safe(s), size);
  const trunc = (s: string, size: number, maxW: number, f: PDFFont) => {
    const t = safe(s);
    if (f.widthOfTextAtSize(t, size) <= maxW) return t;
    let lo = 0;
    let hi = t.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (f.widthOfTextAtSize(t.slice(0, mid) + "…", size) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return t.slice(0, lo) + "…";
  };
  const text = (s: string, x: number, yy: number, size: number, f: PDFFont, color = SLATE) =>
    page.drawText(safe(s), { x, y: yy, size, font: f, color });
  // Garante espaço vertical; cria página nova se faltar. Retorna true se quebrou.
  const ensure = (need: number) => {
    if (y - need < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
      return true;
    }
    return false;
  };

  // Cabeçalho
  text(doc.title, M, y, 16, bold);
  y -= 18;
  text(`${doc.periodLabel}  —  ${doc.ccLabel}`, M, y, 10, font, GRAY);
  y -= 26;

  // KPIs (meta) numa linha
  if (doc.meta.length) {
    const colW = (W - 2 * M) / doc.meta.length;
    doc.meta.forEach((m, i) => {
      const x = M + i * colW;
      text(m.label, x, y, 8, font, GRAY);
      const c = m.tone === "in" ? EMERALD : m.tone === "muted" ? GRAY : SLATE;
      text(trunc(m.value, 13, colW - 6, bold), x, y - 15, 13, bold, c);
    });
    y -= 40;
  }

  const avail = W - 2 * M;
  for (const t of doc.tables) {
    ensure(64);
    if (t.title) {
      text(t.title, M, y, 11, bold, SLATE);
      y -= 16;
    }

    // Geometria das colunas: colunas à direita (valores) com largura fixa.
    const RIGHT_W = 88;
    const rightCount = t.columns.filter((c) => c.align === "right").length;
    const leftCount = t.columns.length - rightCount;
    const leftW = (avail - rightCount * RIGHT_W) / Math.max(1, leftCount);
    const geo: { x: number; w: number }[] = [];
    let gx = M;
    for (const c of t.columns) {
      const w = c.align === "right" ? RIGHT_W : leftW;
      geo.push({ x: gx, w });
      gx += w;
    }
    const PAD = 2;

    const cell = (v: ReportCell, c: ColRef): string => {
      if (c.col.money && typeof v === "number" && Number.isFinite(v)) return formatBRL(v);
      if (c.col.money && (v === "" || v == null)) return "";
      return String(v ?? "");
    };

    const drawHeader = () => {
      t.columns.forEach((c, i) => {
        const g = geo[i];
        const label = (c.label || "").toUpperCase();
        if (c.align === "right") {
          const tw = widthOf(label, 7, bold);
          text(label, g.x + g.w - tw - PAD, y, 7, bold, GRAY);
        } else {
          text(trunc(label, 7, g.w - PAD, bold), g.x + PAD, y, 7, bold, GRAY);
        }
      });
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: LINE });
      y -= 12;
    };

    const drawRow = (cells: ReportCell[], f: PDFFont, color = SLATE_700) => {
      t.columns.forEach((c, i) => {
        const g = geo[i];
        const s = cell(cells[i], { col: c });
        if (c.align === "right") {
          const tw = widthOf(s, 9, f);
          text(s, g.x + g.w - tw - PAD, y, 9, f, color);
        } else {
          text(trunc(s, 9, g.w - PAD, f), g.x + PAD, y, 9, f, color);
        }
      });
      y -= 15;
    };

    drawHeader();
    for (const row of t.rows) {
      if (ensure(16)) drawHeader();
      drawRow(row, font);
    }
    if (t.total) {
      ensure(20);
      page.drawLine({
        start: { x: M, y: y + 4 },
        end: { x: W - M, y: y + 4 },
        thickness: 1,
        color: LINE_STRONG,
      });
      drawRow(t.total, bold, SLATE);
    }
    y -= 14;
  }

  const failed = await appendAttachments(pdf, items);
  return { blob: await pdfDocToBlob(pdf), failed };
}

interface ColRef {
  col: ReportColumn;
}
