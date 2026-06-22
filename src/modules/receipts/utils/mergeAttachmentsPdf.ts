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

// Carrega a imagem: createImageBitmap quando disponível, senão <img> + objectURL
// (fallback p/ WKWebView/iOS, onde createImageBitmap pode faltar).
async function decodeImage(blob: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height, cleanup: () => bmp.close?.() };
    } catch {
      /* cai pro <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("falha ao carregar imagem"));
    el.src = url;
  });
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

// Converte qualquer imagem (webp/png/jpeg/...) em JPEG via canvas, já que o
// pdf-lib só embute PNG/JPEG (e nossos uploads agora são WebP). Fundo branco
// porque JPEG não tem transparência. Usa OffscreenCanvas quando há; senão cai
// pra <canvas> (OffscreenCanvas pode faltar no WKWebView/iOS).
async function imageToJpegBytes(bytes: ArrayBuffer): Promise<Uint8Array> {
  const { source, width, height, cleanup } = await decodeImage(new Blob([bytes]));
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      try {
        const off = new OffscreenCanvas(width, height);
        const octx = off.getContext("2d");
        if (octx) {
          octx.fillStyle = "#ffffff";
          octx.fillRect(0, 0, width, height);
          octx.drawImage(source, 0, 0);
          const b = await off.convertToBlob({ type: "image/jpeg", quality: 0.9 });
          return new Uint8Array(await b.arrayBuffer());
        }
      } catch {
        /* cai pro <canvas> */
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas context indisponível");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.9),
    );
    if (!blob) throw new Error("toBlob falhou");
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    cleanup();
  }
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
/**
 * Anexa os arquivos (PDFs + imagens) como páginas A4 numa doc pdf-lib EXISTENTE.
 * Reusado pelo merge da aba Anexos e pelo "relatório com anexos". Retorna quantos
 * itens falharam (sem abortar o resto).
 */
export async function appendAttachments(
  out: PDFDocument,
  items: AttachmentItem[],
): Promise<number> {
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
  return failed;
}

/** Serializa uma doc pdf-lib num Blob (copia p/ ArrayBuffer concreto — o
 *  Uint8Array do pdf-lib é genérico e o tipo do Blob recusa ArrayBufferLike). */
export async function pdfDocToBlob(out: PDFDocument): Promise<Blob> {
  const pdfBytes = await out.save();
  const ab = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([ab], { type: "application/pdf" });
}

export async function mergeAttachmentsToPdf(
  items: AttachmentItem[],
): Promise<MergeResult> {
  const out = await PDFDocument.create();
  const failed = await appendAttachments(out, items);
  return { blob: await pdfDocToBlob(out), failed };
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
