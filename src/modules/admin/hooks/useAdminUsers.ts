import { useCallback, useEffect, useState } from "react";
import { api } from "@/utils/api";
import type { AdminUser, CreateUserInput } from "../types";

interface UsersResponse {
  users: AdminUser[];
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<UsersResponse>("/admin/users", { method: "GET" });
      setUsers(r.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createUser = useCallback(
    async (input: CreateUserInput) => {
      await api("/admin/users", { method: "POST", body: input });
      await refresh();
    },
    [refresh],
  );

  const updateUser = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      await api(`/admin/users/${id}`, { method: "PATCH", body: patch });
      await refresh();
    },
    [refresh],
  );

  const resetPassword = useCallback(async (id: string) => {
    return api<{ ok: true; password: string }>(
      `/admin/users/${id}/reset-password`,
      { method: "POST" },
    );
  }, []);

  const suspendUser = useCallback(
    async (id: string, suspended: boolean) => {
      await api(`/admin/users/${id}/suspend`, {
        method: "POST",
        body: { suspended },
      });
      await refresh();
    },
    [refresh],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      await api(`/admin/users/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh],
  );

  const impersonate = useCallback(async (id: string) => {
    return api<{
      hashed_token: string;
      target_email: string;
      target_name: string;
    }>(`/admin/users/${id}/impersonate`, { method: "POST" });
  }, []);

  return {
    users,
    loading,
    error,
    refresh,
    createUser,
    updateUser,
    resetPassword,
    suspendUser,
    deleteUser,
    impersonate,
  };
}
