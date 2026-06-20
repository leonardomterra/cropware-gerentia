import { PDFDocument, type PDFEmbeddedPage, type PDFImage } from "pdf-lib";
import type { Receipt } from "../types";

export interface AttachmentItem {
  receipt: Receipt;
  /** bytes do anexo (baixados via o proxy /receipts/:id/attachment). */
  bytes: ArrayBuffer;
}

export interface MergeResult {
  blob: Blob;
  /** quantos anexos não puderam ser incluídos (erro de parse). */
  failed: number;
}

// A4 retrato (pontos PDF) + margem. Todas as páginas saem nesse tamanho pra
// imprimir uniforme, independente da origem (PDF do CamScanner, foto, etc.).
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

// Encaixa (contain) um conteúdo de w×h dentro da área útil da A4, centralizado.
function fitA4(w: number, h: number) {
  const maxW = A4_W - MARGIN * 2;
  const maxH = A4_H - MARGIN * 2;
  const scale = Math.min(maxW / w, maxH / h);
  const fw = w * scale;
  const fh = h * scale;
  return { x: (A4_W - fw) / 2, y: (A4_H - fh) / 2, width: fw, height: fh };
}

/**
 * Junta os anexos selecionados num ÚNICO PDF, TODAS as páginas em A4: cada
 * página de um PDF de origem é desenhada (encaixada) numa folha A4; cada imagem
 * vira uma folha A4. Mantém a ordem recebida. Erros por item são contabilizados
 * em `failed` sem abortar o resto.
 */
export async function mergeAttachmentsToPdf(
  items: AttachmentItem[],
): Promise<MergeResult> {
  const out = await PDFDocument.create();
  let failed = 0;

  for (const it of items) {
    try {
      const mime = it.receipt.attachment_mime ?? "";

      if (mime === "application/pdf") {
        const src = await PDFDocument.load(it.bytes, { ignoreEncryption: true });
        const embedded: PDFEmbeddedPage[] = await out.embedPdf(
          src,
          src.getPageIndices(),
        );
        for (const emb of embedded) {
          const page = out.addPage([A4_W, A4_H]);
          page.drawPage(emb, fitA4(emb.width, emb.height));
        }
      } else {
        const jpeg = await imageToJpegBytes(it.bytes);
        const img: PDFImage = await out.embedJpg(jpeg);
        const page = out.addPage([A4_W, A4_H]);
        page.drawImage(img, fitA4(img.width, img.height));
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
  return { blob: new Blob([ab], { type: "application/pdf" }), failed };
}

/**
 * HTML de uma página-visualizador: barra com "Imprimir" e "Baixar PDF" + o PDF
 * embutido num iframe. Escrita numa aba nova (escapando o pop-up via gesto do
 * clique). `pdfUrl` é um blob: URL criado no app (mesma origem).
 */
export function pdfViewerHtml(pdfUrl: string, filename: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${filename}</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { display: flex; flex-direction: column; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .bar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; background: #fff; }
  .bar .t { font-size: 14px; font-weight: 600; color: #0f172a; margin-right: auto; }
  .btn { font: inherit; font-size: 13px; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; border-radius: 6px; padding: 7px 14px; cursor: pointer; text-decoration: none; }
  .btn.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
  iframe { flex: 1; width: 100%; border: 0; }
</style></head><body>
  <div class="bar">
    <span class="t">Anexos</span>
    <a class="btn" href="${pdfUrl}" download="${filename}">Baixar PDF</a>
    <button class="btn primary" onclick="printPdf()">Imprimir</button>
  </div>
  <iframe id="pdf" src="${pdfUrl}"></iframe>
  <script>
    function printPdf() {
      try {
        var f = document.getElementById('pdf');
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch (e) { window.print(); }
    }
  </script>
</body></html>`;
}
