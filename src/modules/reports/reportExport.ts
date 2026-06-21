import { downloadCsv } from "@/utils/csv";
import { formatBRL } from "@/modules/receipts/utils/receiptFormatters";
import type { ReportCell, ReportColumn, ReportDoc } from "./reportBuilders";
// Fonte padrão do app (Mozilla Text) bundlada — embutida via @font-face pra
// valer na aba nova de impressão (não depende do Google Fonts).
import mozillaTextUrl from "@fontsource-variable/mozilla-text/files/mozilla-text-latin-wght-normal.woff2?url";

// ---- CSV (multi-tabela empilhada) -----------------------------------------

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[";\r\n]/.test(s) || s.startsWith(" ") || s.endsWith(" ")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvVal(v: ReportCell, col: ReportColumn): string {
  if (col.money && typeof v === "number" && Number.isFinite(v)) {
    return v.toFixed(2).replace(".", ",");
  }
  return csvCell(v);
}

export function reportToCsv(doc: ReportDoc): string {
  const lines: string[] = [];
  lines.push(csvCell(doc.title));
  lines.push(csvCell(`${doc.periodLabel} — ${doc.ccLabel}`));
  lines.push("");
  for (const m of doc.meta) lines.push([csvCell(m.label), csvCell(m.value)].join(";"));
  lines.push("");
  for (const t of doc.tables) {
    if (t.title) lines.push(csvCell(t.title));
    lines.push(t.columns.map((c) => csvCell(c.label)).join(";"));
    for (const row of t.rows) lines.push(row.map((v, i) => csvVal(v, t.columns[i])).join(";"));
    if (t.total) lines.push(t.total.map((v, i) => csvVal(v, t.columns[i])).join(";"));
    lines.push("");
  }
  return "﻿" + lines.join("\r\n");
}

export function downloadReportCsv(doc: ReportDoc, filename: string): void {
  downloadCsv(filename, reportToCsv(doc));
}

// ---- Impressão / PDF (janela isolada, sem o chrome do app) -----------------

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function dispVal(v: ReportCell, col: ReportColumn): string {
  if (col.money && typeof v === "number" && Number.isFinite(v)) return formatBRL(v);
  if (col.money && (v === "" || v === null || v === undefined)) return "";
  return esc(v);
}

function tableHtml(t: ReportDoc["tables"][number]): string {
  const head = t.columns
    .map((c) => `<th class="${c.align === "right" ? "r" : ""}">${esc(c.label)}</th>`)
    .join("");
  const body = t.rows
    .map(
      (row) =>
        `<tr>${row
          .map((v, i) => `<td class="${t.columns[i].align === "right" ? "r" : ""}">${dispVal(v, t.columns[i])}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  const total = t.total
    ? `<tr class="tot">${t.total
        .map((v, i) => `<td class="${t.columns[i].align === "right" ? "r" : ""}">${dispVal(v, t.columns[i])}</td>`)
        .join("")}</tr>`
    : "";
  return `<section><h2>${esc(t.title ?? "")}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}${total}</tbody></table></section>`;
}

// Página HTML do relatório no estilo do CDM (laudos): folha A4 com a marca, fonte
// via @import (Inter Tight — funciona em janela nova), e uma barra fixa no rodapé
// com "Imprimir / Salvar PDF" + "Cancelar" (escondida na impressão via .no-print).
export function reportPageHtml(doc: ReportDoc, attachmentsHtml = ""): string {
  const origin = window.location.origin;
  const meta = doc.meta
    .map(
      (m) =>
        `<div class="kpi ${m.tone ?? ""}"><span class="kl">${esc(m.label)}</span><span class="kv">${esc(m.value)}</span></div>`,
    )
    .join("");
  const tables = doc.tables.map(tableHtml).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${esc(doc.title)}</title>
<style>
  @font-face {
    font-family: 'Mozilla Text Variable';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url('${origin}${mozillaTextUrl}') format('woff2');
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 14mm; }
  html, body { background: #fff; color: #0f172a; font-family: 'Mozilla Text Variable', 'Mozilla Text', ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 13.5px; line-height: 1.5; }
  @media screen {
    body { background: #eef0f3; padding: 24px 0 96px; }
    /* Folha sempre A4 (mesmo tamanho independente do conteúdo) — consistência. */
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; box-shadow: 0 1px 4px rgba(15,23,42,.06), 0 2px 16px rgba(15,23,42,.05); }
  }
  .sheet { padding: 40px; }
  .brand { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; margin-bottom: 18px; }
  .brand img { height: 30px; width: auto; }
  .brand .wm { font-size: 17px; font-weight: 600; }
  .brand .wm .dot { color: #64748b; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 2px; }
  .sub { color: #64748b; font-size: 13px; margin: 0 0 18px; }
  .kpis { display: flex; gap: 12px; margin-bottom: 22px; }
  .kpi { flex: 1 1 0; min-width: 0; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
  .kpi .kl { display: block; color: #64748b; font-size: 12px; }
  .kpi .kv { display: block; font-size: 18px; font-weight: 600; margin-top: 2px; color: #0f172a; }
  .kpi.in .kv { color: #047857; }
  .kpi.muted .kv { color: #475569; }
  section { margin-bottom: 22px; page-break-inside: avoid; }
  h2 { font-size: 14px; font-weight: 600; margin: 0 0 8px; color: #334155; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #eef2f6; font-size: 13.5px; }
  th { color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .02em; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.tot td { font-weight: 700; border-top: 2px solid #cbd5e1; border-bottom: none; color: #0f172a; }
  .foot { margin-top: 24px; color: #94a3b8; font-size: 11px; }
  .att { padding: 0; display: flex; align-items: center; justify-content: center; }
  .att .att-img { max-width: 100%; max-height: 265mm; object-fit: contain; display: block; }
  @media screen { .att { min-height: 297mm; } .sheet + .sheet { margin-top: 24px; } }
  @media print { .att { break-before: page; page-break-before: always; } }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; gap: 10px; padding: 12px; background: rgba(255,255,255,.96); border-top: 1px solid #e2e8f0; }
  .btn { font: inherit; font-size: 13px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; border-radius: 6px; padding: 9px 18px; cursor: pointer; }
  .btn.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { max-width: none; margin: 0; box-shadow: none; padding: 0; }
    .no-print { display: none !important; }
  }
</style></head><body>
  <div class="sheet">
    <div class="brand">
      <img src="${origin}/icon.png" alt="" />
      <span class="wm">gerentia<span class="dot">.app</span></span>
    </div>
    <h1>${esc(doc.title)}</h1>
    <p class="sub">${esc(doc.periodLabel)} — ${esc(doc.ccLabel)}</p>
    <div class="kpis">${meta}</div>
    ${tables || '<p class="sub">Sem dados para o período.</p>'}
    <div class="foot">Gerado por gerentia.app — ${esc(new Date().toLocaleString("pt-BR"))}</div>
  </div>
  ${attachmentsHtml}
  <div class="bar no-print">
    <button class="btn primary" onclick="window.print()">Imprimir / Salvar PDF</button>
    <button class="btn" onclick="window.close()">Cancelar</button>
  </div>
</body></html>`;
}

/** Abre o relatório numa aba nova (HTML vetorial) com barra de ações no rodapé. */
export function openReportPage(doc: ReportDoc): void {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Permita pop-ups para abrir o relatório.");
    return;
  }
  w.document.write(reportPageHtml(doc));
  w.document.close();
  w.focus();
}
