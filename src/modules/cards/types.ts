/** Cartão de crédito. Ver docs/CARTOES-E-FATURAS.md. */
export interface Card {
  id: string;
  organization_id: string;
  /** Dono. Null quando a conta foi apagada — o cartão é da organização. */
  user_id: string | null;
  nome: string;
  bandeira: string | null;
  emissor: string | null;
  /** Texto, não número: zero à esquerda é significativo ("0042" ≠ 42). */
  ultimos_digitos: string | null;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  limite: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Bandeiras do <select>. A coluna no banco é texto SEM check constraint de
 * propósito: a lista cresce (bandeiras regionais, private label de rede) e cada
 * acréscimo exigiria migração só para liberar um valor. Quem restringe é aqui.
 */
export const BANDEIRAS = [
  { valor: "visa", rotulo: "Visa" },
  { valor: "mastercard", rotulo: "Mastercard" },
  { valor: "elo", rotulo: "Elo" },
  { valor: "amex", rotulo: "American Express" },
  { valor: "hipercard", rotulo: "Hipercard" },
  { valor: "outra", rotulo: "Outra" },
] as const;
