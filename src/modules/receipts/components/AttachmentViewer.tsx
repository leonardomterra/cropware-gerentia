import { useEffect, useRef, useState } from "react";
import Spinner from "~icons/ph/circle-notch";
import { apiGetArrayBuffer } from "@/utils/api";
import { transformImageUrl } from "@/utils/cloudflareImage";
import { abrirPdf } from "@/utils/pdfRaster";
import type { Receipt } from "../types";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";

interface AttachmentViewerProps {
  receipt: Receipt | null;
  /** Só busca enquanto estiver à vista — o URL presigned expira em ~5min. */
  ativo: boolean;
  /** Altura da área de visualização. */
  className?: string;
}

/**
 * Conteúdo do visualizador de anexo — imagem ou PDF.
 *
 * PDF é RASTERIZADO com pdf.js, não embutido num `<iframe>`. O WKWebView do iOS
 * não renderiza PDF em iframe (fica em branco), e era daí que vinha o "Pré-
 * visualização indisponível no celular". Virando imagem, funciona em toda
 * plataforma e some o caminho separado por tamanho de tela — que, além de tudo,
 * decidia por LARGURA DE JANELA: navegador de desktop com a janela estreita
 * perdia a pré-visualização sem nenhum motivo.
 *
 * Renderiza a primeira página primeiro e as demais em seguida: num PDF longo,
 * esperar tudo antes de mostrar algo trocaria "não renderiza" por "demora".
 */
export function AttachmentViewer({
  receipt,
  ativo,
  className,
}: AttachmentViewerProps) {
  const temAnexo = !!receipt?.attachment_key;
  const { url, loading, error } = useAttachmentUrl(
    receipt?.id,
    ativo && temAnexo,
  );

  const mime = receipt?.attachment_mime ?? "";
  const isPdf = mime === "application/pdf";
  const isImage = mime.startsWith("image/");
  const titulo = receipt?.vendor || receipt?.description || "Arquivo";

  const [paginas, setPaginas] = useState<string[]>([]);
  const [rasterizando, setRasterizando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  // Sem o guarda, trocar de anexo rápido deixa a resposta antiga sobrescrever a
  // nova — a corrida é silenciosa e mostra o recibo errado.
  const pedidoRef = useRef(0);

  useEffect(() => {
    if (!ativo || !isPdf || !receipt?.id) {
      setPaginas([]);
      setErroPdf(null);
      return;
    }
    const meuPedido = ++pedidoRef.current;
    let cancelado = false;
    setRasterizando(true);
    setErroPdf(null);
    setPaginas([]);

    (async () => {
      let pdf: Awaited<ReturnType<typeof abrirPdf>> | null = null;
      try {
        // Bytes pelo proxy da API, e não pelo URL presigned: o presigned é do
        // R2 e não libera CORS para leitura de bytes. É o mesmo caminho que a
        // impressão com anexos já usa.
        const bytes = await apiGetArrayBuffer(
          `/receipts/${receipt.id}/attachment`,
        );
        if (cancelado || meuPedido !== pedidoRef.current) return;
        pdf = await abrirPdf(bytes);
        for (let i = 1; i <= pdf.numeroDePaginas; i++) {
          const img = await pdf.renderizar(i);
          if (cancelado || meuPedido !== pedidoRef.current) return;
          setPaginas((atuais) => [...atuais, img]);
          if (i === 1) setRasterizando(false);
        }
      } catch {
        if (!cancelado && meuPedido === pedidoRef.current) {
          setErroPdf("Não foi possível abrir este PDF.");
        }
      } finally {
        if (!cancelado && meuPedido === pedidoRef.current) {
          setRasterizando(false);
        }
        // O worker do pdf.js não se recolhe sozinho.
        await pdf?.fechar().catch(() => {});
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [ativo, isPdf, receipt?.id]);

  const moldura =
    className ??
    "min-h-[40vh] max-h-[70vh] overflow-y-auto bg-slate-50 rounded border border-slate-200";

  if (!temAnexo) {
    return (
      <div className={`${moldura} flex items-center justify-center`}>
        <p className="text-sm text-slate-500 p-8">Sem arquivo anexado.</p>
      </div>
    );
  }

  if (loading || (isPdf && rasterizando && paginas.length === 0)) {
    return (
      <div className={`${moldura} flex items-center justify-center`}>
        <Spinner className="size-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error || erroPdf) {
    return (
      <div className={`${moldura} flex items-center justify-center`}>
        <p className="text-sm text-red-600 p-8 text-center">
          {error || erroPdf}
        </p>
      </div>
    );
  }

  if (url && isImage) {
    return (
      <div className={`${moldura} flex items-center justify-center`}>
        <img
          src={transformImageUrl(url, "full")}
          alt={titulo}
          className="w-full object-contain"
        />
      </div>
    );
  }

  if (isPdf && paginas.length > 0) {
    return (
      <div className={moldura}>
        <div className="flex flex-col items-center gap-3 p-3">
          {paginas.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${titulo} — página ${i + 1}`}
              className="w-full max-w-3xl bg-white shadow-sm rounded"
            />
          ))}
          {rasterizando && (
            <Spinner className="size-5 text-slate-400 animate-spin" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${moldura} flex items-center justify-center`}>
      <p className="text-sm text-slate-500 p-8 text-center">
        Pré-visualização não disponível para este tipo de arquivo.
      </p>
    </div>
  );
}
