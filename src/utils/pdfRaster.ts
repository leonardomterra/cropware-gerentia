/**
 * Rasterização de PDF em imagem, via pdf.js.
 *
 * POR QUE EXISTE: o WKWebView do iOS **não renderiza PDF dentro de `<iframe>`
 * nem `<embed>`** — o quadro fica em branco. É limitação da plataforma, não do
 * layout: nenhum arranjo de tela conserta. O que conserta é transformar a
 * página do PDF numa imagem, que todo lugar sabe desenhar.
 *
 * O módulo nasceu de `modules/reports/reportAttachments.ts`, onde a mesma
 * mecânica já rodava para "Imprimir com anexos". Virou utilitário quando o
 * visualizador de anexos passou a precisar dela — duas cópias divergiriam na
 * primeira correção de escala.
 */

// pdf.js é grande: carrega só quando alguém realmente abre um PDF, fora do
// chunk das páginas. O módulo fica em cache depois da primeira vez.
let _pdfjs: typeof import("pdfjs-dist") | null = null;

export async function carregarPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (_pdfjs) return _pdfjs;
  const lib = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  _pdfjs = lib;
  return lib;
}

export interface PdfAberto {
  numeroDePaginas: number;
  /** Desenha uma página (1-based) e devolve um data URL JPEG. */
  renderizar: (pagina: number, escala?: number) => Promise<string>;
  /** SEMPRE chamar ao terminar: o worker do pdf.js não se recolhe sozinho. */
  fechar: () => Promise<void>;
}

/**
 * Abre um PDF e devolve um handle que rende páginas sob demanda.
 *
 * Sob demanda, e não tudo de uma vez, porque no visualizador a primeira página
 * é o que a pessoa espera ver — rasterizar um PDF de 40 páginas antes de
 * mostrar qualquer coisa seria trocar "não renderiza" por "demora demais".
 */
export async function abrirPdf(bytes: ArrayBuffer): Promise<PdfAberto> {
  const pdfjs = await carregarPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const doc = await task.promise;

  return {
    numeroDePaginas: doc.numPages,
    async renderizar(pagina: number, escala = 2) {
      const page = await doc.getPage(pagina);
      const viewport = page.getViewport({ scale: escala });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      // Fundo branco explícito: PDF sem cor de fundo sai transparente, e
      // transparente vira preto ao virar JPEG.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      return canvas.toDataURL("image/jpeg", 0.82);
    },
    fechar: () => task.destroy(),
  };
}

/** Todas as páginas de uma vez — usado pela impressão, que precisa do conjunto. */
export async function pdfParaImagens(bytes: ArrayBuffer): Promise<string[]> {
  const pdf = await abrirPdf(bytes);
  const urls: string[] = [];
  try {
    for (let i = 1; i <= pdf.numeroDePaginas; i++) {
      urls.push(await pdf.renderizar(i));
    }
  } finally {
    await pdf.fechar();
  }
  return urls;
}
