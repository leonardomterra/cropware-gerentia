import type { Receipt } from "../types";
import { transformImageUrl } from "@/utils/cloudflareImage";
import { formatBRL, formatDateBR } from "./receiptFormatters";

export interface AttachmentPrintItem {
  receipt: Receipt;
  url: string;
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Junta os anexos selecionados num único documento de impressão (1 por página)
 * e dispara o print do navegador — o usuário salva como PDF único. Só imagens
 * entram na impressão combinada; PDFs precisam ser abertos individualmente
 * (`pdfSkipped` informa quantos ficaram de fora).
 *
 * Retorna a quantidade de PDFs ignorados (0 = nenhum).
 */
export function printAttachments(items: AttachmentPrintItem[]): number {
  const images = items.filter((i) =>
    (i.receipt.attachment_mime ?? "").startsWith("image/"),
  );
  const pdfSkipped = items.length - images.length;

  if (images.length === 0) return pdfSkipped;

  const pages = images
    .map((i) => {
      const r = i.receipt;
      const caption = [
        r.vendor || r.description || "Documento",
        formatDateBR(r.transaction_date),
        formatBRL(r.total_value),
      ]
        .filter(Boolean)
        .join("  •  ");
      return `<div class="page">
        <div class="cap">${esc(caption)}</div>
        <img src="${esc(transformImageUrl(i.url, "full"))}" alt="${esc(r.vendor ?? "")}" />
      </div>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Anexos</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
  .page { display: flex; flex-direction: column; align-items: center; padding: 16px; min-height: 100vh; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .cap { width: 100%; font-size: 12px; color: #475569; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  img { max-width: 100%; max-height: calc(100vh - 60px); object-fit: contain; }
  @media print { @page { margin: 12mm; } .page { min-height: auto; padding: 0; } img { max-height: none; } }
</style></head><body>
  ${pages}
  <script>
    window.addEventListener('load', function () {
      var imgs = Array.prototype.slice.call(document.images);
      Promise.all(imgs.map(function (img) {
        return img.complete ? Promise.resolve() : new Promise(function (res) { img.onload = img.onerror = res; });
      })).then(function () { setTimeout(function () { window.print(); }, 200); });
    });
  </script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Permita pop-ups para imprimir os anexos.");
    return pdfSkipped;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  return pdfSkipped;
}
