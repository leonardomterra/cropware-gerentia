export type ReceiptDirection = "expense" | "income";

export type ReceiptStatus =
  | "a_pagar"
  | "pago"
  | "a_receber"
  | "recebido"
  | "vencido"
  | "cancelado";

export type ReceiptDocType =
  | "cupom"
  | "nota_fiscal"
  | "recibo"
  | "fatura"
  | "pix"
  | "boleto"
  | "outro";

export type ReceiptPaymentMethod =
  | "pix"
  | "cartao" // legado (genérico) — novos lançamentos usam crédito/débito
  | "cartao_credito"
  | "cartao_debito"
  | "boleto"
  | "dinheiro"
  | "transferencia" // inclui depósito — contabilmente é o mesmo dinheiro caindo na conta
  | "debito_automatico"
  | null;

export type ReceiptSource =
  | "manual"
  | "photo"
  | "whatsapp"
  | "telegram"
  | "csv";

/**
 * Item (line item) de um lançamento. Cada item tem categoria + centro de
 * custo PROPRIOS (split). Quando um lançamento tem itens, o total/categoria/
 * CC do cabeçalho sao derivados (total = soma; categoria/CC = null).
 */
export interface ReceiptItem {
  id: string;
  receipt_id: string;
  organization_id: string;
  position: number;
  description: string | null;
  category: string | null;
  cost_center_id: string | null;
  quantity: number | null;
  unit_value: number | null;
  total_value: number;
  /** Quando != null, o item foi DESMEMBRADO num lançamento próprio: continua
   *  visível (esmaecido), mas fora do total/contagem e das agregações. */
  promoted_to_receipt_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItemInput {
  description?: string | null;
  category?: string | null;
  cost_center_id?: string | null;
  quantity?: number | null;
  unit_value?: number | null;
  total_value: number;
  position?: number;
}

/** Linha do repetidor de itens nos forms (strings p/ inputs + key estável). */
export interface ItemRow {
  key: string;
  description: string;
  quantity: string;
  unit_value: string;
  total_value: string;
  category: string;
  cost_center_id: string;
}

export interface Receipt {
  id: string;
  organization_id: string;
  created_by: string;
  farm_id: string | null;
  cost_center_id: string | null;
  doc_type: ReceiptDocType;
  direction: ReceiptDirection;
  status: ReceiptStatus;
  total_value: number;
  currency: string;
  transaction_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  vendor: string | null;
  vendor_cnpj: string | null;
  payment_method: ReceiptPaymentMethod;
  description: string | null;
  category: string | null;
  invoice_number: string | null;
  notes: string | null;
  attachment_key: string | null;
  attachment_mime: string | null;
  source: ReceiptSource;
  ai_confidence: number | null;
  ai_raw: unknown;
  /** Qtd de itens (0 = lançamento simples, sem itens). */
  item_count: number;
  /** Lançamento PREVISTO: projetado por uma recorrência com o valor médio,
   *  ainda não confirmado. Editar o valor o transforma em confirmado (false). */
  is_estimated: boolean;
  /** Entra nas somas (Dashboard/Relatórios/CSV)? false = "informativo" — usado
   *  pra evitar duplicidade entre fatura de cartão e as compras avulsas. */
  counts_in_total: boolean;
  /** Itens embutidos no GET (presente quando item_count > 0). */
  items?: ReceiptItem[];
  created_at: string;
  updated_at: string;
}

export interface ReceiptFilters {
  /** Multiplos status (OR). Vazio = sem filtro. */
  status?: ReceiptStatus[];
  /** Multiplas categorias (OR). Vazio = sem filtro. */
  category?: string[];
  direction?: ReceiptDirection;
  cost_center_id?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface ReceiptInput {
  doc_type: ReceiptDocType;
  direction: ReceiptDirection;
  status: ReceiptStatus;
  total_value: number;
  currency?: string;
  transaction_date?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  vendor?: string | null;
  vendor_cnpj?: string | null;
  payment_method?: ReceiptPaymentMethod;
  description?: string | null;
  category?: string | null;
  invoice_number?: string | null;
  notes?: string | null;
  farm_id?: string | null;
  attachment_key?: string | null;
  attachment_mime?: string | null;
  source?: ReceiptSource;
  ai_confidence?: number | null;
  ai_raw?: unknown;
  /** Marca o lançamento como previsto (estimativa/projeção), manualmente. */
  is_estimated?: boolean;
  /** Contabilizar no total (default: fatura=false, demais=true; backend decide). */
  counts_in_total?: boolean;
  /** Itens (split). Quando presente e nao-vazio, o backend deriva
   *  total_value/category/cost_center_id do cabeçalho a partir dos itens. */
  items?: ReceiptItemInput[];
}

export interface FarmCategory {
  id: string;
  organization_id: string | null;
  slug: string;
  name: string;
  color: string | null;
  icon_lucide: string | null;
  direction: ReceiptDirection;
  is_preset: boolean;
  /** Grupo visual no select (Fazenda, Pessoal, Escritório, Viagem,
   *  Financeiro, Receitas). Pode ser null para custom user categories
   *  futuras que nao tenham grupo definido. */
  group_name: string | null;
}
