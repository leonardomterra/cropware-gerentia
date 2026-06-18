import { ReceiptsListPage } from "../components/ReceiptsListPage";
import type { Receipt } from "../types";

// Documentos com itens que NÃO são faturas (notas fiscais, recibos, cupons…).
// Referência estável (módulo) pra não invalidar o useMemo do filtro.
const isNotaRecibo = (r: Receipt) =>
  r.doc_type !== "fatura" && (r.item_count ?? 0) > 0;

/** Notas e Recibos: documentos itemizados (notas/recibos/comprovantes). */
export default function NotasRecibosPage() {
  return (
    <ReceiptsListPage
      docFilter={isNotaRecibo}
      itemized
      defaultDocType="nota_fiscal"
      showCapture={false}
      createLabel="Nova Nota / Recibo"
      emptyLabel="Sem notas ou recibos"
    />
  );
}
