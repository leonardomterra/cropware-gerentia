import { toast } from "sonner";
import { apiGetArrayBuffer } from "@/utils/api";
import { exportFile } from "@/utils/nativeExport";
import { isNativeCapacitorApp } from "@/utils/platform";
import { openReportPage } from "@/modules/reports/reportExport";
import { reportToPdf } from "@/modules/reports/reportPdf";
import { attachmentsToPagesHtml } from "@/modules/reports/reportAttachments";
import type { ReportDoc } from "@/modules/reports/reportBuilders";
import type { AttachmentItem } from "@/modules/receipts/utils/mergeAttachmentsPdf";
import type { AnexoDoCampo } from "../components/AnexosDoCampo";

/**
 * Exporta um relatório do Field (fase 6) — o MESMO caminho do financeiro
 * (ReportsPage.runPrint): no celular vira PDF (pdf-lib) e abre a folha de
 * compartilhamento; na web abre a página de imprimir. As fotos, quando pedidas,
 * entram em páginas no fim, cada uma com a legenda dela.
 */
export interface AnexoParaRelatorio {
  anexo: AnexoDoCampo;
  legenda: string;
}

/** Baixa N por vez (não dispara 40 downloads juntos no 4G). */
async function emLotes<T, R>(
  itens: T[],
  n: number,
  f: (x: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < itens.length; i += n) {
    out.push(...(await Promise.all(itens.slice(i, i + n).map(f))));
  }
  return out;
}

export async function exportarRelatorio(
  doc: ReportDoc,
  nomeDoArquivo: string,
  anexos: AnexoParaRelatorio[] = [],
): Promise<void> {
  const toastId = toast.loading(
    anexos.length
      ? `Gerando relatório + ${anexos.length} anexo${anexos.length === 1 ? "" : "s"}…`
      : "Gerando relatório…",
  );
  try {
    let falhas = 0;
    const baixados = await emLotes(
      anexos,
      4,
      async (a): Promise<AttachmentItem | null> => {
        try {
          const bytes = await apiGetArrayBuffer(
            `/campo/anexos/arquivo?key=${encodeURIComponent(a.anexo.key)}`,
          );
          return { mime: a.anexo.mime, bytes, legenda: a.legenda };
        } catch {
          falhas += 1;
          return null;
        }
      },
    );
    const items = baixados.filter((x): x is AttachmentItem => x !== null);
    if (isNativeCapacitorApp()) {
      const r = await reportToPdf(doc, items);
      falhas += r.failed;
      await exportFile(`${nomeDoArquivo}.pdf`, r.blob, "application/pdf");
    } else {
      const att = items.length
        ? await attachmentsToPagesHtml(items)
        : { html: "", failed: 0 };
      falhas += att.failed;
      await openReportPage(doc, att.html);
    }
    if (falhas > 0)
      toast.warning(
        `${falhas} anexo${falhas === 1 ? "" : "s"} não pôde ser incluído.`,
        { id: toastId },
      );
    else toast.dismiss(toastId);
  } catch {
    toast.error("Erro ao gerar o relatório.", { id: toastId });
  }
}

/** Nome de arquivo sem acento nem símbolo. */
export function nomeDeArquivo(
  ...partes: (string | null | undefined)[]
): string {
  return partes
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
