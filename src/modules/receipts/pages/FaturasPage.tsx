import { ReceiptsListPage } from "../components/ReceiptsListPage";
import type { Receipt } from "../types";

// Faturas (cartão de crédito e similares): doc_type "fatura".
// Referência estável (módulo) pra não invalidar o useMemo do filtro.
const isFatura = (r: Receipt) => r.doc_type === "fatura";

/** Faturas: faturas de cartão e similares (várias compras agrupadas). */
export default function FaturasPage() {
  return (
    <ReceiptsListPage
      docFilter={isFatura}
      itemized
      defaultDocType="fatura"
      showCapture={false}
      createLabel="Nova Fatura"
      emptyLabel="Sem faturas"
      countNoun={{ one: "fatura", many: "faturas" }}
      titleNew="Nova Fatura"
      titleEdit="Editar Fatura"
    />
  );
}
