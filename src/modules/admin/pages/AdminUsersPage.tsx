import { useMemo, useState } from "react";

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
    resendInvite,
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

  const [inviteOpen, setInviteOpen] = useState(false);
  const [iForm, setIForm] = useState({ email: "", full_name: "" });
  const [inviting, setInviting] = useState(false);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [eForm, setEForm] = useState({
    full_name: "",
    role: "owner",
    trial_ends_at: "",
  });

  const [changingPasswordFor, setChangingPasswordFor] = useState<AdminUser | null>(null);
  const [pwForm, setPwForm] = useState({ password: "", password_confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const [changingEmailFor, setChangingEmailFor] = useState<AdminUser | null>(null);
  const [emailForm, setEmailForm] = useState({ email: "" });
  const [savingEmail, setSavingEmail] = useState(false);

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

  async function handleInvite() {
    if (!iForm.email.trim()) { toast.error("Email é obrigatório"); return; }
    setInviting(true);
    try {
      await createUser({
        email: iForm.email.trim(),
        full_name: iForm.full_name.trim() || undefined,
        invite: true,
      });
      toast.success("Convite enviado");
      setInviteOpen(false);
      setIForm({ email: "", full_name: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  }

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
      await updateUser(editing.id, patch);
      toast.success("Usuário atualizado");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function handleSavePassword() {
    if (!changingPasswordFor) return;
    if (!pwForm.password.trim()) {
      toast.error("Informe a nova senha");
      return;
    }
    if (pwForm.password !== pwForm.password_confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPw(true);
    try {
      await updateUser(changingPasswordFor.id, { password: pwForm.password.trim() });
      toast.success("Senha alterada");
      setChangingPasswordFor(null);
      setPwForm({ password: "", password_confirm: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar senha");
    } finally {
      setSavingPw(false);
    }
  }

  async function handleSaveEmail() {
    if (!changingEmailFor) return;
    const email = emailForm.email.trim();
    if (!email) { toast.error("Informe o novo email"); return; }
    setSavingEmail(true);
    try {
      await updateUser(changingEmailFor.id, { email });
      toast.success("Email alterado");
      setChangingEmailFor(null);
      setEmailForm({ email: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar email");
    } finally {
      setSavingEmail(false);
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
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            Convidar Usuário
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <span className="mr-1 text-base leading-none">+</span>
            Novo Usuário
          </Button>
        </div>
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
                        {suspended && (
                          <Badge size="compact" colorScheme="rose">
                            suspenso
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.is_master ? (
                        <Badge size="compact" colorScheme="amber">master</Badge>
                      ) : u.trial_ends_at ? (
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
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {/* Convidar usuário */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setIForm({ email: "", full_name: "" }); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Email *</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={iForm.email}
                onChange={(e) => setIForm((s) => ({ ...s, email: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Nome <span className="text-slate-400 font-normal">(opcional)</span></label>
              <Input
                placeholder="Nome completo"
                value={iForm.full_name}
                onChange={(e) => setIForm((s) => ({ ...s, full_name: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting || !iForm.email.trim()}>
              {inviting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  Trial termina em
                </label>
                <Input
                  type="date"
                  value={eForm.trial_ends_at}
                  onChange={(e) => setEForm((s) => ({ ...s, trial_ends_at: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChangingEmailFor(editing);
                    setEmailForm({ email: editing?.email ?? "" });
                  }}
                >
                  Alterar Email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChangingPasswordFor(editing);
                    setPwForm({ password: "", password_confirm: "" });
                  }}
                >
                  Alterar Senha
                </Button>
              </div>

              {!editing?.is_master && (
                <>
                  <hr className="border-slate-100" />
                  <div className="flex flex-wrap gap-2">
                    {!editing?.email_confirmed_at && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await resendInvite(editing!.id);
                            toast.success("Convite reenviado");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro ao reenviar convite");
                          }
                        }}
                      >
                        Enviar Convite
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { handleImpersonate(editing!); setEditing(null); }}
                    >
                      <LoginIcon className="size-4 mr-1.5" />
                      Entrar Como
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { handleReset(editing!); }}
                    >
                      <KeyIcon className="size-4 mr-1.5" />
                      Resetar Senha
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { handleSuspend(editing!); setEditing(null); }}
                    >
                      {isSuspended(editing!) ? (
                        <><CheckIcon className="size-4 mr-1.5" />Reativar</>
                      ) : (
                        <><BlockIcon className="size-4 mr-1.5" />Suspender</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                      onClick={() => { handleDelete(editing!); setEditing(null); }}
                    >
                      <Trash2 className="size-4 mr-1.5" />
                      Excluir
                    </Button>
                  </div>
                </>
              )}
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

      {/* Alterar senha */}
      <Dialog
        open={!!changingPasswordFor}
        onOpenChange={(o) => {
          if (!o) {
            setChangingPasswordFor(null);
            setPwForm({ password: "", password_confirm: "" });
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nova senha
              </label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={pwForm.password}
                onChange={(e) => setPwForm((s) => ({ ...s, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Confirmar nova senha
              </label>
              <Input
                type="password"
                placeholder="Repita a senha"
                value={pwForm.password_confirm}
                onChange={(e) => setPwForm((s) => ({ ...s, password_confirm: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChangingPasswordFor(null);
                setPwForm({ password: "", password_confirm: "" });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSavePassword} disabled={savingPw}>
              {savingPw ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alterar email */}
      <Dialog
        open={!!changingEmailFor}
        onOpenChange={(o) => {
          if (!o) { setChangingEmailFor(null); setEmailForm({ email: "" }); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Novo email
              </label>
              <Input
                type="email"
                placeholder="novo@email.com"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setChangingEmailFor(null); setEmailForm({ email: "" }); }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEmail} disabled={savingEmail}>
              {savingEmail ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
