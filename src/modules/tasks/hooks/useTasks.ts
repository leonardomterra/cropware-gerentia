import { useCallback, useEffect, useState } from "react";
import { api } from "@/utils/api";
import type { Task, TaskInput } from "../types";

interface ListResponse { tasks: Task[] }
interface SingleResponse { task: Task }

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<ListResponse>("/tasks", { method: "GET" });
      setTasks(r.tasks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar lembretes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = useCallback(async (input: TaskInput): Promise<Task | null> => {
    try {
      const r = await api<SingleResponse>("/tasks", { method: "POST", body: input });
      await refresh();
      return r.task;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar lembrete");
      return null;
    }
  }, [refresh]);

  const update = useCallback(async (id: string, patch: Partial<TaskInput>): Promise<boolean> => {
    try {
      await api(`/tasks/${id}`, { method: "PATCH", body: patch });
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
      return false;
    }
  }, [refresh]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api(`/tasks/${id}`, { method: "DELETE" });
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
      return false;
    }
  }, [refresh]);

  const toggleDone = useCallback(
    (t: Task): Promise<boolean> => update(t.id, { done: !t.done }),
    [update],
  );

  return { tasks, loading, error, refresh, create, update, remove, toggleDone };
}
