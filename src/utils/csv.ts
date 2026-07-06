/**
 * Helpers de export CSV (RFC 4180-ish, separador `;` pra abrir bonito no Excel BR
 * sem precisar mudar regional). UTF-8 com BOM pra Excel reconhecer acentos.
 */

import { exportFile } from "./nativeExport";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Quote se contem separador, aspas, newline ou comeca com espaco.
  if (/[";\r\n]/.test(s) || s.startsWith(" ") || s.endsWith(" ")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(";"), ...rows.map((r) => r.map(csvCell).join(";"))];
  return "﻿" + lines.join("\r\n"); // BOM + CRLF
}

export function downloadCsv(filename: string, csv: string): Promise<void> {
  // Web = download; iOS/Android = grava e abre a folha de compartilhamento.
  return exportFile(filename, csv, "text/csv;charset=utf-8");
}
