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
  | "pix"
  | "boleto"
  | "outro";

export type ReceiptPaymentMethod =
  | "pix"
  | "cartao"
  | "boleto"
  | "dinheiro"
  | "transferencia"
  | null;

export type ReceiptSource =
  | "manual"
  | "photo"
  | "whatsapp"
  | "telegram"
  | "csv";

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
