import type {
  Receipt,
  ReceiptDirection,
  ReceiptStatus,
} from "../types";

/**
 * "Linha de lançamento" — a unidade de agregação que unifica lançamentos
 * com e sem itens. Um lançamento COM itens vira 1 linha por item (categoria/
 * CC/valor do item; direction/status/date do cabeçalho); SEM itens vira 1
 * linha = o próprio cabeçalho. Dashboard e CSV consomem linhas, então os dois
 * casos ficam idênticos.
 */
export interface ReceiptLine {
  receipt_id: string;
  direction: ReceiptDirection;
  status: ReceiptStatus;
  /** paid_date || transaction_date (data efetiva). */
  date: string | null;
  category: string | null;
  cost_center_id: string | null;
  value: number;
  /** descrição do item (null quando a linha é o próprio cabeçalho). */
  item_description: string | null;
}

export function receiptLines(r: Receipt): ReceiptLine[] {
  const date = r.paid_date || r.transaction_date || null;
  if (r.items && r.items.length > 0) {
    return r.items.map((it) => ({
      receipt_id: r.id,
      direction: r.direction,
      status: r.status,
      date,
      category: it.category,
      cost_center_id: it.cost_center_id,
      value: Number(it.total_value) || 0,
      item_description: it.description,
    }));
  }
  return [
    {
      receipt_id: r.id,
      direction: r.direction,
      status: r.status,
      date,
      category: r.category,
      cost_center_id: r.cost_center_id,
      value: Number(r.total_value) || 0,
      item_description: null,
    },
  ];
}

export function receiptsToLines(rs: Receipt[]): ReceiptLine[] {
  return rs.flatMap(receiptLines);
}
