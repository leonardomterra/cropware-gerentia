import { downloadCsv } from "@/utils/csv";
import { openReportHtml } from "@/utils/nativeExport";
import { appRedirectBase } from "@/utils/platform";
import { formatBRL } from "@/modules/receipts/utils/receiptFormatters";
import type { ReportCell, ReportColumn, ReportDoc } from "./reportBuilders";
import {
  ALTURA_GRAFICO,
  formasDoGrafico,
  legendaDeSeries,
  type Forma,
} from "./reportCharts";
import { ACENTO, NEUTRO, TIPOGRAFIA } from "./reportTheme";
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
  for (const m of doc.meta)
    lines.push([csvCell(m.label), csvCell(m.value)].join(";"));
  lines.push("");
  for (const t of doc.tables) {
    if (t.title) lines.push(csvCell(t.title));
    lines.push(t.columns.map((c) => csvCell(c.label)).join(";"));
    for (const row of t.rows)
      lines.push(row.map((v, i) => csvVal(v, t.columns[i])).join(";"));
    if (t.total)
      lines.push(t.total.map((v, i) => csvVal(v, t.columns[i])).join(";"));
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
  if (col.money && typeof v === "number" && Number.isFinite(v))
    return formatBRL(v);
  if (col.money && (v === "" || v === null || v === undefined)) return "";
  return esc(v);
}

/**
 * As formas vêm de reportCharts (o MESMO cálculo que o PDF nativo usa); aqui só
 * viram elementos SVG. Nenhuma geometria é decidida neste arquivo.
 */
function formaSvg(f: Forma): string {
  if (f.tipo === "ret")
    return `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="1.5" fill="${f.cor}"/>`;
  if (f.tipo === "path")
    return `<path d="${f.d}" fill="${f.cor ?? "none"}"${
      f.opacidade !== undefined ? ` fill-opacity="${f.opacidade}"` : ""
    }${f.contorno ? ` stroke="${f.contorno}" stroke-width="1"` : ""}/>`;
  if (f.tipo === "linha")
    return `<line x1="${f.x1}" y1="${f.y1}" x2="${f.x2}" y2="${f.y2}" stroke="${f.cor}" stroke-width="1"/>`;
  const anc =
    f.ancora === "meio" ? "middle" : f.ancora === "fim" ? "end" : "start";
  return `<text x="${f.x}" y="${f.y}" font-size="${f.tamanho}" fill="${f.cor}" text-anchor="${anc}">${esc(f.texto)}</text>`;
}

function chartHtml(t: ReportDoc["tables"][number]): string {
  if (!t.chart) return "";
  // 690 = largura útil da folha A4 com as margens de 40px do .sheet.
  const L = 690;
  const formas = formasDoGrafico(t.chart, L, ALTURA_GRAFICO);
  if (!formas.length) return "";
  const series = legendaDeSeries(t.chart);
  // A legenda fica num card ABAIXO da figura. Dentro do SVG ela roubava altura
  // das barras e ficava no corpo de 9,5px do eixo — pequena demais no papel.
  const legenda = series.length
    ? `<div class="legenda">${series
        .map(
          (x) =>
            `<span class="li"><i style="background:${x.cor}"></i>${esc(x.nome)}</span>`,
        )
        .join("")}</div>`
    : "";
  return `<svg class="chart" viewBox="0 0 ${L} ${ALTURA_GRAFICO}" width="100%" height="${ALTURA_GRAFICO}" role="img">${formas
    .map(formaSvg)
    .join("")}</svg>${legenda}`;
}

function tableHtml(t: ReportDoc["tables"][number]): string {
  const head = t.columns
    .map(
      (c) =>
        `<th class="${c.align === "right" ? "r" : ""}"${c.width ? ` style="width:${c.width}"` : ""}>${esc(c.label)}</th>`,
    )
    .join("");
  const body = t.rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (v, i) =>
              `<td class="${t.columns[i].align === "right" ? "r" : ""}">${dispVal(v, t.columns[i])}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const total = t.total
    ? `<tr class="tot">${t.total
        .map(
          (v, i) =>
            `<td class="${t.columns[i].align === "right" ? "r" : ""}">${dispVal(v, t.columns[i])}</td>`,
        )
        .join("")}</tr>`
    : "";
  return `<section><h2>${esc(t.title ?? "")}</h2>${chartHtml(t)}<table><thead><tr>${head}</tr></thead><tbody>${body}${total}</tbody></table></section>`;
}

// Página HTML do relatório no estilo do CDM (laudos): folha A4 com a marca, fonte
// via @import (Inter Tight — funciona em janela nova), e uma barra fixa no rodapé
// com "Imprimir / Salvar PDF" + "Cancelar" (escondida na impressão via .no-print).
export function reportPageHtml(doc: ReportDoc, attachmentsHtml = ""): string {
  // No app nativo a origin é capacitor://localhost — inacessível quando o .html
  // é aberto no Safari. Aponta assets (logo/fonte) pro domínio público.
  const origin = appRedirectBase();
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
  html, body { background: #fff; color: ${NEUTRO[900]}; font-family: 'Mozilla Text Variable', 'Mozilla Text', ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: ${TIPOGRAFIA.corpo}px; line-height: 1.5; letter-spacing: -0.015em; }
  @media screen {
    body { background: #eef0f3; padding: 24px 0 96px; }
    /* Folha sempre A4 (mesmo tamanho independente do conteúdo) — consistência. */
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; box-shadow: 0 1px 4px rgba(15,23,42,.06), 0 2px 16px rgba(15,23,42,.05); }
  }
  .sheet { padding: 40px; }
  .brand { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid ${NEUTRO[200]}; margin-bottom: 18px; }
  .brand img { height: 30px; width: auto; }
  .brand .wm { font-size: 17px; font-weight: 600; letter-spacing: -0.015em; }
  .brand .wm .lt { font-weight: 300; }
  h1 { font-size: ${TIPOGRAFIA.h1}px; font-weight: 600; margin: 0 0 2px; }
  .sub { color: ${NEUTRO[500]}; font-size: 13px; margin: 0 0 18px; }
  .kpis { display: flex; gap: 12px; margin-bottom: 22px; }
  /* Sem faixa de cor e sem ícone: num relatório impresso o número já está
     grande e sozinho no card, e a cor do próprio valor basta para dizer o
     sinal. Enfeite ao redor competia com ele. */
  .kpi { flex: 1 1 0; min-width: 0; border: 1px solid ${NEUTRO[200]}; border-radius: 6px; padding: 10px 14px; }
  .kpi .kl { display: block; color: ${NEUTRO[500]}; font-size: ${TIPOGRAFIA.rotulo}px; }
  .kpi .kv { display: block; font-size: ${TIPOGRAFIA.kpiValor}px; font-weight: 600; margin-top: 2px; color: ${NEUTRO[900]}; }
  .kpi.in .kv { color: ${ACENTO.entradaEscuro}; }
  .kpi.out .kv { color: ${ACENTO.saidaEscuro}; }
  .kpi.muted .kv { color: ${NEUTRO[600]}; }
  /* Separação entre seções: linha + respiro generoso. Numa folha com quatro
     tabelas seguidas, só o espaço não basta — o olho precisa de um corte para
     saber que a contagem recomeçou. */
  section { margin-bottom: 26px; page-break-inside: avoid; }
  section + section { border-top: 1px solid ${NEUTRO[200]}; padding-top: 24px; }
  h2 { font-size: ${TIPOGRAFIA.h2}px; font-weight: 600; margin: 0 0 10px; color: ${NEUTRO[800]}; }
  .chart { display: block; margin: 2px 0 0; }
  .legenda { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 8px 0 14px; padding: 9px 12px; border: 1px solid ${NEUTRO[200]}; border-radius: 6px; background: ${NEUTRO[50]}; }
  .legenda .li { display: inline-flex; align-items: center; gap: 7px; font-size: ${TIPOGRAFIA.corpo}px; color: ${NEUTRO[700]}; }
  .legenda i { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid ${NEUTRO[100]}; font-size: ${TIPOGRAFIA.corpo}px; overflow-wrap: anywhere; }
  th { color: ${NEUTRO[500]}; font-weight: 600; font-size: ${TIPOGRAFIA.rotulo}px; text-transform: uppercase; letter-spacing: .02em; }
  td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tbody tr:nth-child(even) td { background: ${NEUTRO[50]}; }
  tr.tot td { font-weight: 700; border-top: 2px solid ${NEUTRO[300]}; border-bottom: none; color: ${NEUTRO[900]}; background: #fff !important; }
  .foot { margin-top: 24px; color: ${NEUTRO[400]}; font-size: ${TIPOGRAFIA.miudo}px; }
  .att { padding: 0; display: flex; align-items: center; justify-content: center; }
  .att .att-img { max-width: 100%; max-height: 265mm; object-fit: contain; display: block; }
  @media screen { .att { min-height: 297mm; } .sheet + .sheet { margin-top: 24px; } }
  @media print { .att { break-before: page; page-break-before: always; } }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; gap: 10px; padding: 12px; background: rgba(255,255,255,.96); border-top: 1px solid #e5e5e5; }
  .btn { font: inherit; font-size: 13px; border: 1px solid #d4d4d4; background: #fff; color: #171717; border-radius: 6px; padding: 9px 18px; cursor: pointer; }
  .btn.primary { background: #171717; color: #fff; border-color: #171717; }
  @media print {
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { max-width: none; margin: 0; box-shadow: none; padding: 0; }
    .no-print { display: none !important; }
  }
</style></head><body>
  <div class="sheet">
    <div class="brand">
      <img src="${origin}/gerentia-symbol.svg" alt="" />
      <span class="wm">gerent<span class="lt">ia.app</span></span>
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

function reportFileName(doc: ReportDoc): string {
  const base = (doc.title || "relatorio").replace(/[\\/:*?"<>|]+/g, "-").trim();
  return `${base} — ${doc.periodLabel}.html`.replace(/\s+/g, " ");
}

/**
 * Abre o relatório (HTML vetorial, com barra de ações).
 * Web: aba nova via Blob URL (com botão "Imprimir / Salvar PDF"); se o popup for
 * bloqueado, cai pra download do .html.
 * Nativo (iOS/Android): compartilha o .html — o usuário abre no Safari e usa
 * Compartilhar → Imprimir → Salvar em PDF. `attachmentsHtml` embute os anexos.
 */
export function openReportPage(
  doc: ReportDoc,
  attachmentsHtml = "",
): Promise<void> {
  const html = reportPageHtml(doc, attachmentsHtml);
  return openReportHtml(reportFileName(doc), html);
}
