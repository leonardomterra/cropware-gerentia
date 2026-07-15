export type TaskPriority = "low" | "normal" | "high";

export interface Task {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  done: boolean;
  priority: TaskPriority;
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
}
