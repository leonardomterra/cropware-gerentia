import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { formatBRL } from "@/modules/receipts/utils/receiptFormatters";
import type { ReportCell, ReportColumn, ReportDoc } from "./reportBuilders";

// A4 retrato (pontos PDF) e a largura de render (px @ ~96dpi).
const A4_W = 595.28;
const A4_H = 841.89;
const RENDER_W = 794;

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cellText(v: ReportCell, col: ReportColumn): string {
  if (col.money && typeof v === "number" && Number.isFinite(v)) return formatBRL(v);
  if (col.money && (v === "" || v == null)) return "";
  return String(v ?? "");
}

function toneColor(tone?: "in" | "out" | "muted"): string {
  if (tone === "in") return "#047857";
  if (tone === "muted") return "#475569";
  return "#0f172a";
}

function tableHtml(t: ReportDoc["tables"][number]): string {
  const align = (c: ReportColumn) => (c.align === "right" ? "right" : "left");
  const head = t.columns
    .map(
      (c) =>
        `<th style="text-align:${align(c)};padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;">${esc(c.label)}</th>`,
    )
    .join("");
  const body = t.rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (v, i) =>
              `<td style="text-align:${align(t.columns[i])};padding:6px 8px;border-bottom:1px solid #eef2f6;font-size:12px;color:#334155;${t.columns[i].align === "right" ? "font-variant-numeric:tabular-nums;white-space:nowrap;" : ""}">${esc(cellText(v, t.columns[i]))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const total = t.total
    ? `<tr>${t.total
        .map(
          (v, i) =>
            `<td style="text-align:${align(t.columns[i])};padding:6px 8px;border-top:2px solid #cbd5e1;font-size:12px;font-weight:700;color:#0f172a;${t.columns[i].align === "right" ? "font-variant-numeric:tabular-nums;white-space:nowrap;" : ""}">${esc(cellText(v, t.columns[i]))}</td>`,
        )
        .join("")}</tr>`
    : "";
  return `<section style="margin-bottom:22px;">
    ${t.title ? `<div style="font-size:13px;font-weight:600;color:#334155;margin:0 0 6px;">${esc(t.title)}</div>` : ""}
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}${total}</tbody>
    </table>
  </section>`;
}

function reportHtml(doc: ReportDoc): string {
  const meta = doc.meta
    .map(
      (m) =>
        `<div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;min-width:130px;">
          <div style="font-size:11px;color:#64748b;">${esc(m.label)}</div>
          <div style="font-size:16px;font-weight:600;margin-top:2px;color:${toneColor(m.tone)};">${esc(m.value)}</div>
        </div>`,
    )
    .join("");
  const tables = doc.tables.map(tableHtml).join("");
  // Sem font-family: herda a fonte do app (Mozilla Text). Cores em hex pra não
  // esbarrar no parser de oklch do html2canvas.
  return `<div style="width:${RENDER_W}px;box-sizing:border-box;padding:40px;background:#ffffff;color:#0f172a;">
    <div style="display:flex;align-items:center;gap:10px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;margin-bottom:18px;">
      <img src="/icon.png" style="height:30px;width:auto;" crossorigin="anonymous" />
      <span style="font-size:17px;font-weight:600;color:#0f172a;">gerentia<span style="color:#64748b;">.app</span></span>
    </div>
    <h1 style="font-size:20px;font-weight:600;margin:0 0 2px;">${esc(doc.title)}</h1>
    <p style="font-size:12px;color:#64748b;margin:0 0 18px;">${esc(doc.periodLabel)} — ${esc(doc.ccLabel)}</p>
    <div style="display:flex;gap:16px;margin-bottom:22px;flex-wrap:wrap;">${meta}</div>
    ${tables || '<p style="font-size:12px;color:#64748b;">Sem dados para o período.</p>'}
    <div style="margin-top:24px;font-size:10px;color:#94a3b8;">Gerado por gerentia.app — ${esc(new Date().toLocaleString("pt-BR"))}</div>
  </div>`;
}

/**
 * Renderiza o relatório como HTML (no próprio app, então usa a fonte padrão +
 * o logo) e rasteriza com html2canvas, fatiando em páginas A4 dentro de uma doc
 * pdf-lib. Devolve a PDFDocument (pronta pra anexar arquivos depois).
 */
export async function renderReportToPdf(doc: ReportDoc): Promise<PDFDocument> {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${RENDER_W}px;background:#ffffff;color:#0f172a;`;
  host.innerHTML = reportHtml(doc);
  document.body.appendChild(host);

  try {
    // Garante fonte + logo carregados antes de capturar.
    if (document.fonts?.ready) await document.fonts.ready;
    const img = host.querySelector("img");
    if (img && !img.complete) {
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
      });
    }

    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: RENDER_W,
    });

    const pdf = await PDFDocument.create();
    const pageHpx = Math.floor(canvas.width * (A4_H / A4_W));
    let offset = 0;
    while (offset < canvas.height) {
      const sliceH = Math.min(pageHpx, canvas.height - offset);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("canvas 2d indisponível");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, sliceH);
      ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const blob: Blob | null = await new Promise((res) =>
        slice.toBlob((b) => res(b), "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("falha ao rasterizar o relatório");
      const jpg = await pdf.embedJpg(await blob.arrayBuffer());

      const imgH = (sliceH / canvas.width) * A4_W; // altura em pts c/ largura = A4
      const page = pdf.addPage([A4_W, A4_H]);
      page.drawImage(jpg, { x: 0, y: A4_H - imgH, width: A4_W, height: imgH });
      offset += sliceH;
    }
    return pdf;
  } finally {
    document.body.removeChild(host);
  }
}
