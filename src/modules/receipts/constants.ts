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
  fatura: "Fatura",
  pix: "PIX",
  boleto: "Boleto",
  outro: "Outro",
};

/** Prefixo de UMA letra exibido antes da origem na lista ((N) nota fiscal,
 *  (F) fatura, (R) recibo, (C) cupom). Tipos simples (pix/boleto/outro) ficam
 *  sem prefixo. */
// Só duas classificações, espelhando as abas: N (Notas e Recibos: nota fiscal,
// recibo, cupom) e F (Faturas). Tipos simples (pix/boleto/outro) ficam sem prefixo.
export const DOC_TYPE_PREFIX: Partial<Record<ReceiptDocType, string>> = {
  nota_fiscal: "N",
  recibo: "N",
  cupom: "N",
  fatura: "F",
};

/** Rotulo curto pro badge "Tipo · N itens" (Nota fiscal vira "Nota"). */
export const DOC_TYPE_SHORT_LABEL: Record<ReceiptDocType, string> = {
  cupom: "Cupom",
  nota_fiscal: "Nota",
  recibo: "Recibo",
  fatura: "Fatura",
  pix: "PIX",
  boleto: "Boleto",
  outro: "Outro",
};

/** colorScheme do badge de tipo de documento. Tons FORA da paleta de status
 *  (amber/emerald/blue/red/slate) pra nao confundir com o badge de status. */
export const DOC_TYPE_COLOR_SCHEME: Record<
  ReceiptDocType,
  "indigo" | "sky" | "teal" | "purple" | "cyan" | "orange" | "gray"
> = {
  nota_fiscal: "indigo",
  cupom: "sky",
  recibo: "teal",
  fatura: "purple",
  pix: "cyan",
  boleto: "orange",
  outro: "gray",
};

export const DOC_TYPES: ReceiptDocType[] = [
  "cupom",
  "nota_fiscal",
  "recibo",
  "fatura",
  "pix",
  "boleto",
  "outro",
];

export const PAYMENT_METHOD_LABEL: Record<
  NonNullable<ReceiptPaymentMethod>,
  string
> = {
  pix: "PIX",
  cartao: "Cartão", // legado (genérico)
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

// Lista selecionável nos forms (o "cartao" genérico fica só pra exibir legado).
export const PAYMENT_METHODS: NonNullable<ReceiptPaymentMethod>[] = [
  "pix",
  "cartao_credito",
  "cartao_debito",
  "boleto",
  "dinheiro",
  "transferencia",
];

/** É cartão de crédito? (o tipo que pode duplicar com a fatura.) */
export function isCreditCard(
  pm: ReceiptPaymentMethod | "" | undefined,
): boolean {
  return pm === "cartao_credito";
}

export const STATUSES_BY_DIRECTION: Record<
  "expense" | "income",
  ReceiptStatus[]
> = {
  expense: ["a_pagar", "pago", "vencido", "cancelado"],
  income: ["a_receber", "recebido", "cancelado"],
};
