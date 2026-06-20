import { PDFDocument } from "pdf-lib";
import type { Receipt } from "../types";

export interface AttachmentItem {
  receipt: Receipt;
  /** bytes do anexo (baixados via o proxy /receipts/:id/attachment). */
  bytes: ArrayBuffer;
}

export interface MergeResult {
  blob: Blob;
  /** quantos anexos não puderam ser incluídos (erro de fetch/parse). */
  failed: number;
}

// A4 retrato (pontos PDF) + margem.
const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 24;

// Converte qualquer imagem (webp/png/jpeg/...) em JPEG via canvas, já que o
// pdf-lib só embute PNG/JPEG (e nossos uploads agora são WebP). Fundo branco
// porque JPEG não tem transparência.
async function imageToJpegBytes(bytes: ArrayBuffer): Promise<Uint8Array> {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context indisponível");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Junta os anexos selecionados num ÚNICO PDF: PDFs têm as páginas copiadas;
 * imagens viram uma página A4 cada (encaixadas com margem). Mantém a ordem
 * recebida. Erros por item são contabilizados em `failed` sem abortar o resto.
 */
export async function mergeAttachmentsToPdf(
  items: AttachmentItem[],
): Promise<MergeResult> {
  const out = await PDFDocument.create();
  let failed = 0;

  for (const it of items) {
    try {
      const bytes = it.bytes;
      const mime = it.receipt.attachment_mime ?? "";

      if (mime === "application/pdf") {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      } else {
        const jpeg = await imageToJpegBytes(bytes);
        const img = await out.embedJpg(jpeg);
        const maxW = A4_W - MARGIN * 2;
        const maxH = A4_H - MARGIN * 2;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const page = out.addPage([A4_W, A4_H]);
        page.drawImage(img, {
          x: (A4_W - w) / 2,
          y: (A4_H - h) / 2,
          width: w,
          height: h,
        });
      }
    } catch {
      failed += 1;
    }
  }

  const pdfBytes = await out.save();
  // Copia pra um ArrayBuffer concreto (o Uint8Array do pdf-lib é genérico e o
  // tipo do Blob recusa ArrayBufferLike/SharedArrayBuffer).
  const ab = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;
  return {
    blob: new Blob([ab], { type: "application/pdf" }),
    failed,
  };
}
