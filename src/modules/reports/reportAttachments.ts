import type { AttachmentItem } from "@/modules/receipts/utils/mergeAttachmentsPdf";
// A rasterização mora em utils/pdfRaster: o visualizador de anexos usa a mesma,
// e duas cópias divergiriam na primeira correção de escala.
import { pdfParaImagens } from "@/utils/pdfRaster";

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bytesToDataUrl(bytes: ArrayBuffer, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(
      new Blob([bytes], { type: mime || "application/octet-stream" }),
    );
  });
}

export interface AttachmentsHtmlResult {
  /** uma <div class="sheet att"> por página (imagem). */
  html: string;
  /** anexos que não puderam ser incluídos. */
  failed: number;
}

/**
 * Converte os anexos (PDFs rasterizados + imagens) em páginas HTML (<img>) pra
 * embutir na própria página do relatório — mesmo modelo de impressão pros dois.
 */
export async function attachmentsToPagesHtml(
  items: AttachmentItem[],
): Promise<AttachmentsHtmlResult> {
  let failed = 0;
  const parts: string[] = [];
  for (const it of items) {
    try {
      const mime = it.mime ?? "";
      let urls: string[] = [];
      if (mime === "application/pdf") urls = await pdfParaImagens(it.bytes);
      else if (mime.startsWith("image/"))
        urls = [await bytesToDataUrl(it.bytes, mime)];
      else {
        failed += 1;
        continue;
      }
      for (const u of urls) {
        const legenda = it.legenda
          ? `<p class="att-legenda">${escaparHtml(it.legenda)}</p>`
          : "";
        parts.push(
          `<div class="sheet att"><img class="att-img" src="${u}" alt="" />${legenda}</div>`,
        );
      }
    } catch {
      failed += 1;
    }
  }
  return { html: parts.join(""), failed };
}
