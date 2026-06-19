import { downloadCsv } from "@/utils/csv";
import { formatBRL } from "@/modules/receipts/utils/receiptFormatters";
import type { ReportCell, ReportColumn, ReportDoc } from "./reportBuilders";

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

function reportHtml(doc: ReportDoc): string {
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
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 32px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #64748b; font-size: 12px; margin: 0 0 18px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 22px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; min-width: 130px; }
  .kpi .kl { display: block; color: #64748b; font-size: 11px; }
  .kpi .kv { display: block; font-size: 16px; font-weight: 600; margin-top: 2px; }
  .kpi.in .kv { color: #047857; }
  .kpi.out .kv { color: #0f172a; }
  .kpi.muted .kv { color: #475569; }
  section { margin-bottom: 22px; page-break-inside: avoid; }
  h2 { font-size: 13px; margin: 0 0 6px; color: #334155; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .02em; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; }
  tr.tot td { font-weight: 700; border-top: 2px solid #cbd5e1; border-bottom: none; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; }
  @media print { body { margin: 0; } @page { margin: 16mm; } }
</style></head><body>
  <h1>${esc(doc.title)}</h1>
  <p class="sub">${esc(doc.periodLabel)} — ${esc(doc.ccLabel)}</p>
  <div class="kpis">${meta}</div>
  ${tables || '<p class="sub">Sem dados para o período.</p>'}
  <footer>Gerado por gerentia.app — ${new Date().toLocaleString("pt-BR")}</footer>
</body></html>`;
}

export function printReport(doc: ReportDoc): void {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Permita pop-ups para imprimir o relatório.");
    return;
  }
  w.document.write(reportHtml(doc));
  w.document.close();
  w.focus();
  // Pequeno atraso pro layout assentar antes do diálogo de impressão.
  setTimeout(() => w.print(), 300);
}
