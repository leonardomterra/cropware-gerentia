import { useCallback, useEffect, useState } from "react";
import { api } from "@/utils/api";
import { exportFile } from "@/utils/nativeExport";
import type { AdminOrg, AdminOrgDetail } from "../types";

interface OrgsResponse {
  organizations: AdminOrg[];
}

/**
 * Backup JSON sob demanda de uma organização ou de uma pessoa. Fora do hook de
 * propósito: a tela de Usuários só quer o botão, e não a lista de organizações
 * que o hook carrega no mount.
 *
 * O arquivo sai pelo mesmo caminho do export de CSV (download no web, folha de
 * compartilhamento no iOS/Android).
 */
export async function downloadBackup(
  scope: "org" | "user",
  id: string,
  label: string,
): Promise<void> {
  const data = await api<Record<string, unknown>>(`/admin/export/${scope}/${id}`);
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || scope;
  const today = new Date().toISOString().slice(0, 10);
  await exportFile(
    `backup_${slug}_${today}.json`,
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8",
  );
}

export function useAdminOrgs() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<OrgsResponse>("/admin/orgs", { method: "GET" });
      setOrgs(r.organizations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar organizações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createOrg = useCallback(
    async (input: { name: string; cnpj?: string; seats_limit: number }) => {
      await api("/admin/orgs", { method: "POST", body: input });
      await refresh();
    },
    [refresh],
  );

  const updateOrg = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      await api(`/admin/orgs/${id}`, { method: "PATCH", body: patch });
      await refresh();
    },
    [refresh],
  );

  const loadDetail = useCallback(
    (id: string) => api<AdminOrgDetail>(`/admin/orgs/${id}`, { method: "GET" }),
    [],
  );

  /**
   * Vincula um usuário existente.
   *
   * Quem já tem histórico faz a API devolver 409 (`user_has_data`), e aí são
   * duas saídas: `move` traz os lançamentos junto, `keep` deixa na conta antiga.
   */
  const addMember = useCallback(
    (
      orgId: string,
      email: string,
      role: string,
      data: "ask" | "move" | "keep" = "ask",
    ) =>
      api<{
        ok: true;
        receipts_left_behind: number;
        moved_data: Record<string, number> | null;
      }>(`/admin/orgs/${orgId}/members`, {
        method: "POST",
        body: {
          email,
          role,
          confirm: data === "keep",
          move_data: data === "move",
        },
      }),
    [],
  );

  const setMemberRole = useCallback(
    (orgId: string, userId: string, role: string) =>
      api(`/admin/orgs/${orgId}/members/${userId}`, {
        method: "PATCH",
        body: { role },
      }),
    [],
  );

  const removeMember = useCallback(
    (orgId: string, userId: string) =>
      api<{ ok: true; new_organization_id: string }>(
        `/admin/orgs/${orgId}/members/${userId}`,
        { method: "DELETE" },
      ),
    [],
  );

  return {
    orgs,
    loading,
    error,
    refresh,
    createOrg,
    updateOrg,
    loadDetail,
    addMember,
    setMemberRole,
    removeMember,
  };
}
