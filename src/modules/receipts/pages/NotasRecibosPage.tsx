import { ReceiptsListPage } from "../components/ReceiptsListPage";
import type { Receipt } from "../types";

// Notas e Recibos: TODA nota fiscal e recibo (com ou sem itens), MAIS qualquer
// outro documento itemizado que não seja fatura (ex.: cupom com vários produtos).
// Lançamentos simples de item único (cupom/pix/boleto/outro) ficam só em
// Lançamentos. Referência estável (módulo) p/ não invalidar o useMemo do filtro.
const isNotaRecibo = (r: Receipt) =>
  r.doc_type !== "fatura" &&
  ((r.item_count ?? 0) > 0 ||
    r.doc_type === "nota_fiscal" ||
    r.doc_type === "recibo");

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
      countNoun={{ one: "documento", many: "documentos" }}
      titleNew="Nova Nota / Recibo"
      titleEdit="Editar Nota / Recibo"
    />
  );
}
