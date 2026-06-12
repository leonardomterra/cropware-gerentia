import { useMemo, useState } from "react";
import UserPlus from "~icons/material-symbols-light/person-add-outline";
import KeyIcon from "~icons/material-symbols-light/key-outline";
import BlockIcon from "~icons/material-symbols-light/block";
import CheckIcon from "~icons/material-symbols-light/check-circle-outline";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import LoginIcon from "~icons/material-symbols-light/login";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAdminUsers } from "../hooks/useAdminUsers";
import type { AdminUser } from "../types";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function isSuspended(u: AdminUser): boolean {
  return !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
}

export default function AdminUsersPage() {
  const {
    users,
    loading,
    error,
    createUser,
    updateUser,
    resetPassword,
    suspendUser,
    deleteUser,
    impersonate,
  } = useAdminUsers();

  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [cForm, setCForm] = useState({
    email: "",
    full_name: "",
    farm_name: "",
    password: "",
    invite: false,
  });
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [eForm, setEForm] = useState({
    full_name: "",
    role: "owner",
    trial_ends_at: "",
    password: "",
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users
      .filter(
        (u) =>
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.organization_name ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.is_master !== b.is_master) return a.is_master ? 1 : -1;
        return (a.full_name ?? a.email ?? "").localeCompare(
          b.full_name ?? b.email ?? "",
          "pt-BR",
        );
      });
  }, [users, search]);

  async function handleCreate() {
    if (!cForm.email.trim()) {
      toast.error("Email é obrigatório");
      return;
    }
    if (!cForm.invite && !cForm.password.trim()) {
      toast.error("Senha obrigatória (ou marque convidar por email)");
      return;
    }
    setCreating(true);
    try {
      await createUser({
        email: cForm.email.trim(),
        full_name: cForm.full_name.trim() || undefined,
        farm_name: cForm.farm_name.trim() || undefined,
        password: cForm.invite ? undefined : cForm.password,
        invite: cForm.invite || undefined,
      });
      toast.success(cForm.invite ? "Convite enviado" : "Usuário criado");
      setCreateOpen(false);
      setCForm({ email: "", full_name: "", farm_name: "", password: "", invite: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEForm({
      full_name: u.full_name ?? "",
      role: u.role ?? "owner",
      trial_ends_at: u.trial_ends_at ? u.trial_ends_at.slice(0, 10) : "",
      password: "",
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    try {
      const patch: Record<string, unknown> = {
        full_name: eForm.full_name.trim(),
        role: eForm.role,
      };
      if (eForm.trial_ends_at) {
        patch.trial_ends_at = new Date(eForm.trial_ends_at).toISOString();
      }
      if (eForm.password.trim()) patch.password = eForm.password.trim();
      await updateUser(editing.id, patch);
      toast.success("Usuário atualizado");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function handleReset(u: AdminUser) {
    if (!confirm(`Resetar a senha de ${u.email}?`)) return;
    try {
      const r = await resetPassword(u.id);
      await navigator.clipboard.writeText(r.password).catch(() => {});
      toast.success(`Nova senha: ${r.password} (copiada)`, { duration: 12000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao resetar senha");
    }
  }

  async function handleSuspend(u: AdminUser) {
    const suspend = !isSuspended(u);
    try {
      await suspendUser(u.id, suspend);
      toast.success(suspend ? "Conta suspensa" : "Conta reativada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar status");
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Excluir ${u.email}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteUser(u.id);
      toast.success("Usuário excluído");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  async function handleImpersonate(u: AdminUser) {
    if (
      !confirm(
        `Entrar como ${u.email}? Você verá o app na conta dele; um aviso fica no topo pra você voltar.`,
      )
    ) {
      return;
    }
    try {
      const r = await impersonate(u.id);
      const { startImpersonation } = await import("@/utils/impersonate");
      await startImpersonation({
        hashedToken: r.hashed_token,
        targetEmail: r.target_email,
        targetName: r.target_name,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao impersonar");
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-medium text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestão de todos os usuários do gerentia. {users.length} no total.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4 mr-1" />
          Novo Usuário
        </Button>
      </header>

      <Input
        placeholder="Buscar por nome, email ou organização..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Carregando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Usuário</th>
                <th className="text-left px-4 py-2 font-medium">Organização</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Trial</th>
                <th className="text-left px-4 py-2 font-medium">Último acesso</th>
                <th className="text-right px-4 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const suspended = isSuspended(u);
                const trialActive =
                  !!u.trial_ends_at &&
                  new Date(u.trial_ends_at).getTime() > Date.now();
                return (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {u.full_name || "(sem nome)"}
                        {u.is_master && (
                          <Badge size="compact" colorScheme="amber">
                            master
                          </Badge>
                        )}
                        {suspended && (
                          <Badge size="compact" colorScheme="rose">
                            suspenso
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {u.organization_name || (
                        <span className="text-xs italic text-rose-500">
                          sem org
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.role ? (
                        <Badge
                          size="compact"
                          colorScheme={
                            u.role === "owner"
                              ? "amber"
                              : u.role === "admin"
                                ? "blue"
                                : "slate"
                          }
                        >
                          {u.role}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.trial_ends_at ? (
                        <span className={trialActive ? "text-slate-600" : "text-rose-500"}>
                          {trialActive ? "até " : "expirou "}
                          {fmtDate(u.trial_ends_at)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {fmtDate(u.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="text-xs text-slate-600 hover:text-slate-900"
                        >
                          Editar
                        </button>
                        {!u.is_master && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleImpersonate(u)}
                              title="Entrar como (login como)"
                              className="text-slate-500 hover:text-slate-900"
                            >
                              <LoginIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReset(u)}
                              title="Resetar senha"
                              className="text-slate-500 hover:text-slate-900"
                            >
                              <KeyIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSuspend(u)}
                              title={suspended ? "Reativar" : "Suspender"}
                              className="text-slate-500 hover:text-slate-900"
                            >
                              {suspended ? (
                                <CheckIcon className="size-4" />
                              ) : (
                                <BlockIcon className="size-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(u)}
                              title="Excluir"
                              className="text-slate-500 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {/* Criar usuário */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Email *
              </label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={cForm.email}
                onChange={(e) => setCForm((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome
              </label>
              <Input
                placeholder="Nome completo"
                value={cForm.full_name}
                onChange={(e) => setCForm((s) => ({ ...s, full_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome da organização
              </label>
              <Input
                placeholder="Minha Fazenda"
                value={cForm.farm_name}
                onChange={(e) => setCForm((s) => ({ ...s, farm_name: e.target.value }))}
              />
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={cForm.invite}
                onChange={(e) => setCForm((s) => ({ ...s, invite: e.target.checked }))}
                className="mt-0.5"
              />
              <span className="text-slate-700">
                Convidar por email (em vez de definir senha). O usuário recebe um
                link e define a própria senha.
              </span>
            </label>
            {!cForm.invite && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Senha *
                </label>
                <Input
                  type="text"
                  placeholder="Mínimo 6 caracteres"
                  value={cForm.password}
                  onChange={(e) => setCForm((s) => ({ ...s, password: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Criando..." : cForm.invite ? "Enviar Convite" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar usuário */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editing?.full_name || editing?.email}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Nome
                </label>
                <Input
                  value={eForm.full_name}
                  onChange={(e) => setEForm((s) => ({ ...s, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Role
                </label>
                <select
                  value={eForm.role}
                  onChange={(e) => setEForm((s) => ({ ...s, role: e.target.value }))}
                  className="w-full h-9 rounded-md border border-slate-200 px-2 text-sm bg-white"
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Trial termina em
                </label>
                <Input
                  type="date"
                  value={eForm.trial_ends_at}
                  onChange={(e) => setEForm((s) => ({ ...s, trial_ends_at: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Nova senha (opcional)
                </label>
                <Input
                  type="text"
                  placeholder="Deixe em branco pra manter"
                  value={eForm.password}
                  onChange={(e) => setEForm((s) => ({ ...s, password: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
