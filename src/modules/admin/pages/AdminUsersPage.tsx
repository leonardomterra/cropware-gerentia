import { useMemo, useState } from "react";

import KeyIcon from "~icons/material-symbols-light/key-outline";
import BlockIcon from "~icons/material-symbols-light/block-outline";
import CheckIcon from "~icons/material-symbols-light/check-circle-outline";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import LoginIcon from "~icons/material-symbols-light/login";
import MailIcon from "~icons/material-symbols-light/mail-outline";
import ChevronDown from "~icons/material-symbols-light/keyboard-arrow-down";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
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
  const [editPending, setEditPending] = useState(false);

  const [changingPasswordFor, setChangingPasswordFor] = useState<AdminUser | null>(null);
  const [pwForm, setPwForm] = useState({ password: "", password_confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const [changingEmailFor, setChangingEmailFor] = useState<AdminUser | null>(null);
  const [emailForm, setEmailForm] = useState({ email: "" });
  const [savingEmail, setSavingEmail] = useState(false);

  type SortBy = "name" | "last_access" | "trial";
  type FilterStatus = "suspended" | "trial_expired" | "pending_invite";

  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [filterStatus, setFilterStatus] = useState<FilterStatus | null>(null);

  // Confirmação genérica (reset/excluir/impersonar) — substitui confirm() nativo.
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    loadingLabel: string;
    errorLabel: string;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmRunning, setConfirmRunning] = useState(false);

  async function runConfirm() {
    if (!confirmState) return;
    setConfirmRunning(true);
    try {
      await confirmState.run();
      setConfirmState(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : confirmState.errorLabel);
    } finally {
      setConfirmRunning(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users
      .filter((u) => {
        const matchSearch =
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.organization_name ?? "").toLowerCase().includes(q);
        if (!matchSearch) return false;
        if (filterStatus === "suspended" && !isSuspended(u)) return false;
        if (filterStatus === "trial_expired" && (
          !u.trial_ends_at || new Date(u.trial_ends_at).getTime() > Date.now()
        )) return false;
        if (filterStatus === "pending_invite" && (!!u.email_confirmed_at || !!u.last_sign_in_at)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_master !== b.is_master) return a.is_master ? 1 : -1;
        if (sortBy === "name") {
          return (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "", "pt-BR");
        }
        if (sortBy === "last_access") {
          return (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? "");
        }
        if (sortBy === "trial") {
          return (a.trial_ends_at ?? "9999").localeCompare(b.trial_ends_at ?? "9999");
        }
        return 0;
      });
  }, [users, search, sortBy, filterStatus]);

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
    setEditPending(true);
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
    } finally {
      setEditPending(false);
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

  function askReset(u: AdminUser) {
    setConfirmState({
      title: "Resetar Senha",
      description: `Resetar a senha de ${u.email}? Uma nova senha será gerada e copiada.`,
      confirmLabel: "Resetar",
      loadingLabel: "Resetando...",
      errorLabel: "Erro ao resetar senha",
      run: async () => {
        const r = await resetPassword(u.id);
        await navigator.clipboard.writeText(r.password).catch(() => {});
        toast.success(`Nova senha: ${r.password} (copiada)`, { duration: 12000 });
      },
    });
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

  function askDelete(u: AdminUser) {
    setConfirmState({
      title: "Excluir Usuário",
      description: `Excluir ${u.email}? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      loadingLabel: "Excluindo...",
      errorLabel: "Erro ao excluir",
      run: async () => {
        await deleteUser(u.id);
        toast.success("Usuário excluído");
      },
    });
  }

  function askImpersonate(u: AdminUser) {
    setConfirmState({
      title: "Entrar como Usuário",
      description: `Entrar como ${u.email}? Você verá o app na conta dele; um aviso fica no topo pra você voltar.`,
      confirmLabel: "Entrar",
      loadingLabel: "Entrando...",
      errorLabel: "Erro ao impersonar",
      run: async () => {
        const r = await impersonate(u.id);
        const { startImpersonation } = await import("@/utils/impersonate");
        await startImpersonation({
          hashedToken: r.hashed_token,
          targetEmail: r.target_email,
          targetName: r.target_name,
        });
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
        {/* Busca: full width no mobile, cresce no desktop */}
        <div className="sm:flex-1 sm:min-w-0">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Filtros: 2 colunas no mobile, inline no desktop */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 sm:shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`h-9 w-full sm:w-auto inline-flex items-center justify-between gap-1.5 px-3 rounded-md transition-colors text-sm shadow-sm focus-visible:outline-none ${
                  filterStatus
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {filterStatus === "suspended" && "Suspensos"}
                {filterStatus === "trial_expired" && "Expirado"}
                {filterStatus === "pending_invite" && "Pendentes"}
                {!filterStatus && "Filtrar"}
                <ChevronDown className="size-4 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              <DropdownMenuItem onClick={() => setFilterStatus(null)} className={!filterStatus ? "bg-slate-100 font-medium" : ""}>
                Todos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("suspended")} className={filterStatus === "suspended" ? "bg-slate-100 font-medium" : ""}>
                Suspensos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("trial_expired")} className={filterStatus === "trial_expired" ? "bg-slate-100 font-medium" : ""}>
                Trial Expirado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("pending_invite")} className={filterStatus === "pending_invite" ? "bg-slate-100 font-medium" : ""}>
                Aguardando Convite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-9 w-full sm:w-auto inline-flex items-center justify-between gap-1.5 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm shadow-sm focus-visible:outline-none"
              >
                {sortBy === "name" && "Nome"}
                {sortBy === "last_access" && "Acesso"}
                {sortBy === "trial" && "Trial"}
                <ChevronDown className="size-4 text-slate-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              <DropdownMenuItem onClick={() => setSortBy("name")} className={sortBy === "name" ? "bg-slate-100 font-medium" : ""}>
                Nome
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("last_access")} className={sortBy === "last_access" ? "bg-slate-100 font-medium" : ""}>
                Último Acesso
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("trial")} className={sortBy === "trial" ? "bg-slate-100 font-medium" : ""}>
                Trial
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Botões: 2 colunas no mobile, inline no desktop */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 sm:shrink-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setInviteOpen(true)}>
            <MailIcon className="size-4 mr-1.5" />
            <span className="sm:hidden">Convidar</span>
            <span className="hidden sm:inline">Convidar Usuário</span>
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            <span className="mr-1 text-base leading-none">+</span>
            <span className="sm:hidden">Novo</span>
            <span className="hidden sm:inline">Novo Usuário</span>
          </Button>
        </div>
      </div>

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
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Trial</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Último Acesso</th>
                <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const suspended = isSuspended(u);
                const trialActive =
                  !!u.trial_ends_at &&
                  new Date(u.trial_ends_at).getTime() > Date.now();
                return (
                  <tr key={u.id} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50 sm:cursor-default" onClick={() => openEdit(u)}>
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
                      <div className="text-xs text-slate-400 mt-0.5 sm:hidden">
                        {u.is_master ? (
                          <Badge size="compact" colorScheme="amber">master</Badge>
                        ) : u.trial_ends_at ? (
                          <span className={trialActive ? "text-slate-500" : "text-rose-500"}>
                            {trialActive ? "trial até " : "trial expirou "}
                            {fmtDate(u.trial_ends_at)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs hidden sm:table-cell">
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
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                      {fmtDate(u.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEdit(u); }}
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
            <DialogTitle>
              <span className="sm:hidden">Editar</span>
              <span className="hidden sm:inline">Editar {editing?.full_name || editing?.email}</span>
            </DialogTitle>
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 min-w-[calc(50%-4px)]"
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
                  className="flex-1 min-w-[calc(50%-4px)]"
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
                    {!editing?.email_confirmed_at && !editing?.last_sign_in_at && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 min-w-[calc(50%-4px)]"
                        disabled={editPending}
                        onClick={async () => {
                          setEditPending(true);
                          try {
                            await resendInvite(editing!.id);
                            toast.success("Convite reenviado");
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "";
                            if (msg.includes("already_confirmed")) {
                              toast.info("Usuário já confirmou a conta");
                            } else {
                              toast.error(msg || "Erro ao reenviar convite");
                            }
                          } finally {
                            setEditPending(false);
                          }
                        }}
                      >
                        <MailIcon className="size-4 mr-1.5" />
                        Convidar
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 min-w-[calc(50%-4px)]"
                      disabled={editPending}
                      onClick={() => { askImpersonate(editing!); setEditing(null); }}
                    >
                      <LoginIcon className="size-4 mr-1.5" />
                      Entrar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 min-w-[calc(50%-4px)]"
                      disabled={editPending}
                      onClick={() => { askReset(editing!); setEditing(null); }}
                    >
                      <KeyIcon className="size-4 mr-1.5" />
                      Resetar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 min-w-[calc(50%-4px)]"
                      disabled={editPending}
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
                      className="flex-1 min-w-[calc(50%-4px)] text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                      disabled={editPending}
                      onClick={() => { askDelete(editing!); setEditing(null); }}
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
            <Button variant="outline" disabled={editPending} onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={editPending}>
              {editPending ? "Salvando..." : "Salvar"}
            </Button>
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

      <ConfirmActionDialog
        open={confirmState !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title={confirmState?.title}
        description={confirmState?.description ?? ""}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel="Cancelar"
        loading={confirmRunning}
        loadingLabel={confirmState?.loadingLabel}
        onConfirm={runConfirm}
      />
    </div>
  );
}
