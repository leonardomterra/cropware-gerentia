import { ReceiptsListPage } from "../components/ReceiptsListPage";
import type { Receipt } from "../types";

// Anexos: lançamentos que têm um arquivo (imagem/PDF) anexado — repositório de
// documentos enviados (notas, recibos, faturas, comprovantes).
// Referência estável (módulo) pra não invalidar o useMemo do filtro.
const hasAttachment = (r: Receipt) => !!r.attachment_key;

/** Anexos: visão dos arquivos enviados, cada um vinculado ao seu lançamento. */
export default function AnexosPage() {
  return (
    <ReceiptsListPage
      docFilter={hasAttachment}
      showCapture={false}
      showCreate={false}
      viewOnly
      emptyLabel="Nenhum arquivo anexado neste mês"
      countNoun={{ one: "anexo", many: "anexos" }}
    />
  );
}
