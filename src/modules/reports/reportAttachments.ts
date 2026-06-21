import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { AttachmentItem } from "@/modules/receipts/utils/mergeAttachmentsPdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

function bytesToDataUrl(bytes: ArrayBuffer, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(new Blob([bytes], { type: mime || "application/octet-stream" }));
  });
}

// Rasteriza cada página de um PDF em JPEG (data URL) via pdf.js.
async function pdfToImageDataUrls(bytes: ArrayBuffer): Promise<string[]> {
  const task = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const doc = await task.promise;
  const urls: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      urls.push(canvas.toDataURL("image/jpeg", 0.82));
    }
  } finally {
    await task.destroy();
  }
  return urls;
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
      const mime = it.receipt.attachment_mime ?? "";
      let urls: string[] = [];
      if (mime === "application/pdf") urls = await pdfToImageDataUrls(it.bytes);
      else if (mime.startsWith("image/")) urls = [await bytesToDataUrl(it.bytes, mime)];
      else {
        failed += 1;
        continue;
      }
      for (const u of urls) {
        parts.push(`<div class="sheet att"><img class="att-img" src="${u}" alt="" /></div>`);
      }
    } catch {
      failed += 1;
    }
  }
  return { html: parts.join(""), failed };
}
