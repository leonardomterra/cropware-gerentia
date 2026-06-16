export interface Recurring {
  id: string;
  organization_id: string;
  cost_center_id: string | null;
  name: string;
  direction: "expense" | "income";
  total_value: number;
  category: string | null;
  vendor: string | null;
  description: string | null;
  payment_method: string | null;
  frequency: "monthly";
  day_of_month: number;
  next_run_date: string;
  /** Fim da recorrência (último mês que gera). null = indeterminada. */
  end_date: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringInput {
  name: string;
  direction: "expense" | "income";
  total_value: number;
  cost_center_id?: string | null;
  category?: string | null;
  vendor?: string | null;
  description?: string | null;
  payment_method?: string | null;
  day_of_month: number;
  /** Duração em meses. null/0 = indeterminada (janela rolante). */
  duration_months?: number | null;
  active?: boolean;
}
