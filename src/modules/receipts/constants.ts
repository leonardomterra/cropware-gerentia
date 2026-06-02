import type {
  ReceiptDocType,
  ReceiptPaymentMethod,
  ReceiptStatus,
} from "./types";

export const STATUS_LABEL: Record<ReceiptStatus, string> = {
  a_pagar: "Pagar",
  pago: "Pago",
  a_receber: "A receber",
  recebido: "Recebido",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

/** Mapeia status -> colorScheme do componente Badge (semantica universal). */
export const STATUS_COLOR_SCHEME: Record<
  ReceiptStatus,
  "amber" | "emerald" | "blue" | "red" | "slate"
> = {
  a_pagar: "amber",
  pago: "emerald",
  a_receber: "blue",
  recebido: "emerald",
  vencido: "red",
  cancelado: "slate",
};

export const DOC_TYPE_LABEL: Record<ReceiptDocType, string> = {
  cupom: "Cupom",
  nota_fiscal: "Nota fiscal",
  recibo: "Recibo",
  pix: "PIX",
  boleto: "Boleto",
  outro: "Outro",
};

export const DOC_TYPES: ReceiptDocType[] = [
  "cupom",
  "nota_fiscal",
  "recibo",
  "pix",
  "boleto",
  "outro",
];

export const PAYMENT_METHOD_LABEL: Record<
  NonNullable<ReceiptPaymentMethod>,
  string
> = {
  pix: "PIX",
  cartao: "Cartao",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  transferencia: "Transferencia",
};

export const PAYMENT_METHODS: NonNullable<ReceiptPaymentMethod>[] = [
  "pix",
  "cartao",
  "boleto",
  "dinheiro",
  "transferencia",
];

export const STATUSES_BY_DIRECTION: Record<
  "expense" | "income",
  ReceiptStatus[]
> = {
  expense: ["a_pagar", "pago", "vencido", "cancelado"],
  income: ["a_receber", "recebido", "cancelado"],
};
