export type TaskPriority = "low" | "normal" | "high";

/**
 * Um Lembrete: compromisso financeiro que ainda não virou lançamento.
 *
 * `total_value` e `cost_center_id` são opcionais porque o lembrete costuma
 * nascer de um "anota: X" no WhatsApp, onde o usuário ainda não sabe o valor.
 */
export interface Task {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  done: boolean;
  priority: TaskPriority;
  total_value: number | null;
  cost_center_id: string | null;
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  notes?: string | null;
  due_date?: string | null;
  done?: boolean;
  priority?: TaskPriority;
  total_value?: number | null;
  cost_center_id?: string | null;
}
