import { useMemo, useState } from "react";

import KeyIcon from "~icons/ph/key";
import BlockIcon from "~icons/ph/prohibit";
import CheckIcon from "~icons/ph/check-circle";
import Trash2 from "~icons/ph/trash";
import LoginIcon from "~icons/ph/sign-in";
import MailIcon from "~icons/ph/envelope-simple";
import Download from "~icons/ph/download-simple";
import Pencil from "~icons/ph/pencil-simple";
import ArrowLeft from "~icons/ph/arrow-left";
import UsersThree from "~icons/ph/users-three-duotone";
import Save from "~icons/ph/floppy-disk";
import ChevronDown from "~icons/ph/caret-down";
import Search from "~icons/ph/magnifying-glass";
import ArrowsDownUp from "~icons/ph/arrows-down-up";
import Plus from "~icons/ph/plus";
import X from "~icons/ph/x";
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
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { AREAS_DE_ATUACAO } from "@/utils/areasDeAtuacao";
import { dicaDeSenha, senhaAceita } from "@/utils/senha";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { CardSensivel } from "../components/CardSensivel";
import { LoadingState } from "@/components/ui/LoadingState";
import { cn } from "@/components/ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Obrigatorio } from "@/components/ui/Obrigatorio";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import {
  BOTAO_BARRA,
  BOTAO_BARRA_PRIMARIO,
  ICONE_BOTAO_BARRA,
  MENU_DA_BARRA,
  ROTULO_PAINEL_ESCURO,
  SETA_BOTAO_BARRA,
} from "@/lib/ui-tokens";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { downloadBackup } from "../hooks/useAdminOrgs";
import type { AdminUser } from "../types";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function isSuspended(u: AdminUser): boolean {
  return !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
}

/** Ver `aoSair` em AdminOrgsPage: a tela tem um nível a mais que o hub. */
export default function AdminUsersPage({
  aoSair,
  buscaInicial = "",
}: {
  aoSair?: () => void;
  /** Preenche a busca ao abrir — usado por "editar" vindo de Organizações. */
  buscaInicial?: string;
}) {
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

  // Backup por pessoa: suporte e pedido de LGPD começam por esta tela.
  const [backingUp, setBackingUp] = useState<string | null>(null);

  async function handleBackup(u: AdminUser) {
    setBackingUp(u.id);
    try {
      await downloadBackup("user", u.id, u.full_name || u.email || "usuario");
      toast.success("Backup gerado");
    } catch {
      toast.error("Erro ao gerar o backup");
    } finally {
      setBackingUp(null);
    }
  }

  const [search, setSearch] = useState(buscaInicial);

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
    email: "",
    // Vazio = não mexer na senha. Trocar senha e salvar o perfil viraram a
    // MESMA ação: eram dois diálogos, e alterar e-mail exigia três cliques
    // para uma edição que já estava aberta.
    password: "",
    password2: "",
    phone: "",
    cpf: "",
    city: "",
    state: "",
    activity_area: "",
  });
  const [editPending, setEditPending] = useState(false);
  // Travas dos cards sensíveis (e-mail e senha). Ver CardSensivel: os campos só
  // aceitam digitação depois de um "sim" explícito.
  const [emailDestravado, setEmailDestravado] = useState(false);
  const [senhaDestravada, setSenhaDestravada] = useState(false);

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
        if (
          filterStatus === "trial_expired" &&
          (!u.trial_ends_at || new Date(u.trial_ends_at).getTime() > Date.now())
        )
          return false;
        if (
          filterStatus === "pending_invite" &&
          (!!u.email_confirmed_at || !!u.last_sign_in_at)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_master !== b.is_master) return a.is_master ? 1 : -1;
        if (sortBy === "name") {
          return (a.full_name ?? a.email ?? "").localeCompare(
            b.full_name ?? b.email ?? "",
            "pt-BR",
          );
        }
        if (sortBy === "last_access") {
          return (b.last_sign_in_at ?? "").localeCompare(
            a.last_sign_in_at ?? "",
          );
        }
        if (sortBy === "trial") {
          return (a.trial_ends_at ?? "9999").localeCompare(
            b.trial_ends_at ?? "9999",
          );
        }
        return 0;
      });
  }, [users, search, sortBy, filterStatus]);

  async function handleInvite() {
    if (!iForm.email.trim()) {
      toast.error("Email é obrigatório");
      return;
    }
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
      setCForm({
        email: "",
        full_name: "",
        farm_name: "",
        password: "",
        invite: false,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEmailDestravado(false);
    setSenhaDestravada(false);
    setEForm({
      full_name: u.full_name ?? "",
      role: u.role ?? "owner",
      trial_ends_at: u.trial_ends_at ? u.trial_ends_at.slice(0, 10) : "",
      email: u.email ?? "",
      password: "",
      password2: "",
      phone: u.phone ?? "",
      cpf: u.cpf ?? "",
      city: u.city ?? "",
      state: u.state ?? "",
      activity_area: u.activity_area ?? "",
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setEditPending(true);
    try {
      const patch: Record<string, unknown> = {
        full_name: eForm.full_name.trim(),
        role: eForm.role,
        phone: eForm.phone.replace(/\D/g, ""),
        cpf: eForm.cpf.replace(/\D/g, ""),
        city: eForm.city,
        state: eForm.state.toUpperCase(),
        activity_area: eForm.activity_area,
      };
      if (eForm.trial_ends_at) {
        patch.trial_ends_at = new Date(eForm.trial_ends_at).toISOString();
      }
      // E-mail e senha NÃO entram aqui: têm ação própria, nos cards sensíveis.
      await updateUser(editing.id, patch);
      toast.success("Usuário atualizado");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setEditPending(false);
    }
  }

  /**
   * E-mail e senha são CREDENCIAL, não campo de perfil, e por isso têm ação
   * própria em vez de irem junto no "Salvar". Cada uma passa por duas
   * perguntas: uma para destravar os campos e outra para aplicar — a primeira
   * separa "abri para ver" de "vim mexer", a segunda mostra o valor final e o
   * nome de quem vai recebê-lo, que é onde o erro de verdade acontece (o
   * master edita muita gente em sequência).
   */
  function pedirDestravar(alvo: "email" | "senha") {
    if (!editing) return;
    const quem = editing.full_name || editing.email || "este usuário";
    setConfirmState({
      title: alvo === "email" ? "Alterar E-mail" : "Alterar Senha",
      description:
        alvo === "email"
          ? `Deseja realmente alterar o e-mail de ${quem}? É com ele que a pessoa entra no app.`
          : `Deseja realmente alterar a senha de ${quem}? A senha atual deixa de funcionar.`,
      confirmLabel: "Sim, alterar",
      loadingLabel: "Abrindo...",
      errorLabel: "Erro",
      run: async () => {
        if (alvo === "email") setEmailDestravado(true);
        else setSenhaDestravada(true);
      },
    });
  }

  function pedirTrocarEmail() {
    if (!editing) return;
    const novo = eForm.email.trim();
    // As checagens ficam ANTES do diálogo: perguntar "confirma?" para depois
    // recusar por e-mail inválido gastaria a confirmação à toa.
    if (!novo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (novo === (editing.email ?? "")) {
      toast.error("O e-mail é o mesmo de agora.");
      return;
    }
    const id = editing.id;
    setConfirmState({
      title: "Confirmar Novo E-mail",
      description: `O acesso de ${editing.full_name || editing.email} passa a ser ${novo}. Confirma?`,
      confirmLabel: "Confirmar",
      loadingLabel: "Alterando...",
      errorLabel: "Erro ao alterar o e-mail",
      run: async () => {
        await updateUser(id, { email: novo });
        // `editing` é um retrato tirado ao abrir a tela; sem isto o cabeçalho
        // do card continuaria mostrando o e-mail antigo.
        setEditing((u) => (u ? { ...u, email: novo } : u));
        setEmailDestravado(false);
        toast.success("E-mail alterado");
      },
    });
  }

  function pedirTrocarSenha() {
    if (!editing) return;
    if (!senhaAceita(eForm.password)) {
      toast.error(dicaDeSenha(eForm.password) || "Informe a nova senha.");
      return;
    }
    if (eForm.password !== eForm.password2) {
      toast.error("As senhas não conferem.");
      return;
    }
    const id = editing.id;
    const nova = eForm.password;
    setConfirmState({
      title: "Confirmar Nova Senha",
      description: `Definir uma nova senha para ${editing.full_name || editing.email}? A senha atual deixa de funcionar imediatamente.`,
      confirmLabel: "Confirmar",
      loadingLabel: "Alterando...",
      errorLabel: "Erro ao alterar a senha",
      run: async () => {
        await updateUser(id, { password: nova });
        // Limpa e volta a travar: senha na tela não fica à mostra, e um segundo
        // clique sem querer não reenvia.
        setEForm((f) => ({ ...f, password: "", password2: "" }));
        setSenhaDestravada(false);
        toast.success("Senha alterada");
      },
    });
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
        toast.success(`Nova senha: ${r.password} (copiada)`, {
          duration: 12000,
        });
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

  // Editar SUBSTITUI a lista, como no resto do app (docs/PADRAO-DE-PAGINA.md
  // §6). Era um dialog com formulário, grade de ações e zona destrutiva — muita
  // coisa para uma caixa que o teclado do celular espreme.
  /**
   * Diálogos disparados de DENTRO da tela de edição (alterar e-mail, alterar
   * senha, confirmações). Ficam numa variável porque a edição usa `return`
   * antecipado: deixados só no return principal, eles não seriam montados
   * enquanto a edição está aberta — o botão setava o estado e nada aparecia.
   */
  const dialogosDaEdicao = (
    <>
      {/* Alterar email */}
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
    </>
  );

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            disabled={editPending}
            onClick={() => setEditing(null)}
            className={cn(BOTAO_BARRA, "rounded-md")}
          >
            <ArrowLeft className="size-4 mr-2" />
            Voltar
          </Button>
          <Button
            onClick={handleSaveEdit}
            disabled={editPending}
            className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto")}
          >
            <Save className="size-4 mr-2" />
            {editPending ? "Salvando..." : "Salvar"}
          </Button>
          <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
            <Pencil className="size-[18px] shrink-0 text-fuchsia-500" />
            <span className="truncate">
              {editing.full_name || editing.email}
            </span>
          </span>
        </div>

        {dialogosDaEdicao}

        <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-6">
          <div className="space-y-4 py-2">
            {/* Só PERFIL nesta grade. E-mail e senha desceram para os cards
                de atenção, com trava e confirmação próprias. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Nome
                </label>
                <Input
                  value={eForm.full_name}
                  onChange={(e) =>
                    setEForm((s) => ({ ...s, full_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Trial termina em
                </label>
                <Input
                  type="date"
                  value={eForm.trial_ends_at}
                  onChange={(e) =>
                    setEForm((s) => ({ ...s, trial_ends_at: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Telefone
                </label>
                <Input
                  value={eForm.phone}
                  onChange={(e) =>
                    setEForm((s) => ({ ...s, phone: e.target.value }))
                  }
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  CPF
                </label>
                <Input
                  value={eForm.cpf}
                  onChange={(e) =>
                    setEForm((s) => ({ ...s, cpf: e.target.value }))
                  }
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Cidade
                </label>
                <Input
                  value={eForm.city}
                  onChange={(e) =>
                    setEForm((s) => ({ ...s, city: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Estado
                </label>
                <Input
                  value={eForm.state}
                  onChange={(e) =>
                    setEForm((s) => ({
                      ...s,
                      state: e.target.value
                        .replace(/[^a-zA-Z]/g, "")
                        .toUpperCase(),
                    }))
                  }
                  maxLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Área de Atuação
                </label>
                <Select
                  value={eForm.activity_area || "nenhuma"}
                  onValueChange={(v) =>
                    setEForm((s) => ({
                      ...s,
                      activity_area: v === "nenhuma" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Não informada</SelectItem>
                    {AREAS_DE_ATUACAO.map((a) => (
                      <SelectItem key={a.valor} value={a.valor}>
                        {a.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <CardSensivel
              titulo="Alterar E-mail"
              descricao={editing.email || "sem e-mail"}
              destravado={emailDestravado}
              aoDestravar={() => pedirDestravar("email")}
              rotuloDestravar="Alterar E-mail"
              avisoTravado="Campo bloqueado. Clique em Alterar E-mail para liberar."
              acao={
                <>
                  <Button
                    type="button"
                    onClick={pedirTrocarEmail}
                    className={cn(BOTAO_BARRA_PRIMARIO, "w-auto")}
                  >
                    Confirmar Novo E-mail
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEmailDestravado(false);
                      setEForm((f) => ({ ...f, email: editing.email ?? "" }));
                    }}
                    className={cn(BOTAO_BARRA, "rounded-md bg-white")}
                  >
                    Cancelar
                  </Button>
                </>
              }
            >
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Novo e-mail
                </label>
                <Input
                  type="email"
                  autoComplete="off"
                  value={eForm.email}
                  onChange={(e) =>
                    setEForm((s) => ({ ...s, email: e.target.value }))
                  }
                  disabled={!emailDestravado}
                  className="bg-white"
                />
              </div>
            </CardSensivel>

            <CardSensivel
              titulo="Alterar Senha"
              descricao="Substitui a senha de acesso desta pessoa"
              destravado={senhaDestravada}
              aoDestravar={() => pedirDestravar("senha")}
              rotuloDestravar="Alterar Senha"
              avisoTravado="Campos bloqueados. Clique em Alterar Senha para liberar."
              acao={
                <>
                  <Button
                    type="button"
                    onClick={pedirTrocarSenha}
                    className={cn(BOTAO_BARRA_PRIMARIO, "w-auto")}
                  >
                    Confirmar Nova Senha
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSenhaDestravada(false);
                      setEForm((f) => ({ ...f, password: "", password2: "" }));
                    }}
                    className={cn(BOTAO_BARRA, "rounded-md bg-white")}
                  >
                    Cancelar
                  </Button>
                </>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">
                    Nova senha
                  </label>
                  <Input
                    type="password"
                    /* `new-password` desliga o preenchimento automático do
                       navegador. Sem isso o gerenciador de senhas via um campo
                       de senha num formulário com e-mail, tentava preencher e o
                       campo piscava ao abrir a tela. */
                    autoComplete="new-password"
                    value={eForm.password}
                    onChange={(e) =>
                      setEForm((s) => ({ ...s, password: e.target.value }))
                    }
                    disabled={!senhaDestravada}
                    className="bg-white"
                  />
                  {/* Altura RESERVADA: a dica aparece e some conforme se
                      digita, e sem a reserva a grade pulava a cada tecla. */}
                  <p className="text-sm text-slate-600 min-h-5">
                    {eForm.password ? dicaDeSenha(eForm.password) : ""}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">
                    Confirmar senha
                  </label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={eForm.password2}
                    onChange={(e) =>
                      setEForm((s) => ({ ...s, password2: e.target.value }))
                    }
                    disabled={!senhaDestravada || !eForm.password}
                    className="bg-white"
                  />
                  <p className="text-sm text-red-600 min-h-5">
                    {eForm.password &&
                    eForm.password2 &&
                    eForm.password !== eForm.password2
                      ? "As senhas não conferem."
                      : ""}
                  </p>
                </div>
              </div>
            </CardSensivel>

            {!editing?.is_master && (
              <>
                {/* Uma linha só: com "Alterar Email" e "Alterar Senha" fora
                    daqui (viraram campos), sobraram poucas ações e a grade de
                    dois por linha deixava buracos. */}
                <div className="flex flex-wrap items-center gap-2">
                  {!editing?.email_confirmed_at &&
                    !editing?.last_sign_in_at && (
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(BOTAO_BARRA, "flex-1 rounded-md")}
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
                    variant="ghost"
                    className={cn(BOTAO_BARRA, "flex-1 rounded-md")}
                    disabled={editPending}
                    onClick={() => {
                      askImpersonate(editing!);
                      setEditing(null);
                    }}
                  >
                    <LoginIcon className="size-4 mr-1.5" />
                    Entrar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(BOTAO_BARRA, "flex-1 rounded-md")}
                    disabled={editPending}
                    onClick={() => {
                      askReset(editing!);
                      setEditing(null);
                    }}
                  >
                    <KeyIcon className="size-4 mr-1.5" />
                    Resetar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(BOTAO_BARRA, "flex-1 rounded-md")}
                    disabled={editPending}
                    onClick={() => {
                      handleSuspend(editing!);
                      setEditing(null);
                    }}
                  >
                    {isSuspended(editing!) ? (
                      <>
                        <CheckIcon className="size-4 mr-1.5" />
                        Reativar
                      </>
                    ) : (
                      <>
                        <BlockIcon className="size-4 mr-1.5" />
                        Suspender
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    /* Tingido, e não só contornado: é a única ação
                       irreversível da fileira, e contorno fino dava a ela o
                       mesmo peso das demais. */
                    className="flex-1 h-9 px-4 font-normal rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:text-red-800"
                    disabled={editPending}
                    onClick={() => {
                      askDelete(editing!);
                      setEditing(null);
                    }}
                  >
                    <Trash2 className="size-4 mr-1.5" />
                    Excluir
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {aoSair && (
        <div className="flex flex-wrap items-center gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={aoSair}
            className={cn(BOTAO_BARRA, "rounded-md")}
          >
            <ArrowLeft className="size-4 mr-2" />
            Voltar
          </Button>
          <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
            <UsersThree className="size-[18px] shrink-0 text-fuchsia-500" />
            <span className="truncate">Usuários</span>
          </span>
        </div>
      )}

      {/* A barra é a mesma do app inteiro; o layout e a regra do celular moram
          na BarraDeTela. Ver components/ui/BarraDeTela.tsx e §2 do padrão. */}
      <BarraDeTela
        buscaAtiva={Boolean(search)}
        busca={
          <div className="relative">
            <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou organização..."
              className="pl-8 h-9 border-slate-200 shadow-none text-slate-500"
            />
          </div>
        }
        filtrosAtivos={filterStatus ? 1 : 0}
        painel={
          <>
            <div className="space-y-1.5">
              <label className={ROTULO_PAINEL_ESCURO}>Situação</label>
              <Select
                value={filterStatus ?? "all"}
                onValueChange={(v) =>
                  setFilterStatus(v === "all" ? null : (v as FilterStatus))
                }
              >
                <SelectTrigger className="h-9 bg-white text-slate-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  <SelectItem value="suspended">Suspensos</SelectItem>
                  <SelectItem value="trial_expired">Trial Expirado</SelectItem>
                  <SelectItem value="pending_invite">
                    Aguardando Convite
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        }
        acoes={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Rótulo FIXO: mostrar a opção ativa fazia o botão mudar de
                largura a cada escolha. */}
              <button
                type="button"
                className={cn(
                  BOTAO_BARRA,
                  "inline-flex items-center rounded-md",
                )}
              >
                <ArrowsDownUp className={ICONE_BOTAO_BARRA} />
                Ordenar
                <ChevronDown className={SETA_BOTAO_BARRA} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={MENU_DA_BARRA}>
              {(
                [
                  ["name", "Nome"],
                  ["last_access", "Último Acesso"],
                  ["trial", "Trial"],
                ] as const
              ).map(([valor, rotulo]) => (
                <DropdownMenuItem
                  key={valor}
                  onClick={() => setSortBy(valor)}
                  className={
                    sortBy === valor ? "bg-white/10 font-medium" : undefined
                  }
                >
                  {rotulo}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        acaoPrincipal={
          /* UM botão escuro — criar. Convidar é o caminho alternativo para o
             mesmo fim e fica em cinza, logo abaixo. */
          <>
            <Button
              variant="default"
              onClick={() => setCreateOpen(true)}
              className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5")}
            >
              <Plus className="size-[18px] shrink-0" />
              Novo Usuário
            </Button>
            <Button
              variant="ghost"
              onClick={() => setInviteOpen(true)}
              className={cn(BOTAO_BARRA, "gap-1.5 rounded-md")}
            >
              <MailIcon className={ICONE_BOTAO_BARRA} />
              Convidar Usuário
            </Button>
          </>
        }
      />

      {/* Contador e "Limpar Filtros": à direita no desktop, centralizados no
          celular. Altura reservada porque o "Limpar" aparece e some. */}
      <div className="flex items-center justify-center sm:justify-end gap-1 px-1 min-h-[28px]">
        <p className="text-sm text-slate-500">
          {filtered.length === 0
            ? "Nenhum usuário encontrado"
            : `Mostrando ${filtered.length} ${
                filtered.length === 1 ? "Usuário" : "Usuários"
              }`}
        </p>
        {(filterStatus || search.trim()) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilterStatus(null);
            }}
            className="h-8 px-2 font-normal text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Limpar filtros"
          >
            <X className="size-4 mr-1.5" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-sm">
              {/* Larguras fixas nas colunas de medida conhecida (data, data,
                  dois botões) e o resto para "Usuário": sem isso a tabela
                  distribuía por conteúdo e sobrava espaço morto no meio,
                  enquanto nome e e-mail — o que se lê — ficavam apertados. */}
              <tr>
                <th className="text-left px-4 py-2 font-medium">Usuário</th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell w-[180px] whitespace-nowrap">
                  Trial
                </th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell w-[150px] whitespace-nowrap">
                  Último Acesso
                </th>
                {/* Ações aparecem em QUALQUER tamanho. Elas ficavam
                    escondidas no celular, e por isso a linha inteira era
                    clicável — um gesto que ninguém descobre sozinho. Mais
                    estreita no celular, onde só a coluna do usuário divide
                    espaço com ela. */}
                <th className="text-right px-4 py-2 font-medium w-[104px] sm:w-[130px] whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const suspended = isSuspended(u);
                const trialActive =
                  !!u.trial_ends_at &&
                  new Date(u.trial_ends_at).getTime() > Date.now();
                return (
                  /* A LINHA NÃO É BOTÃO. Ela abria a edição inteira, tendo o
                     lápis ali na ponta fazendo o mesmo — daí o
                     `stopPropagation` que existia só para o clique no botão não
                     abrir a tela duas vezes. E `sm:cursor-default` devolvia o
                     cursor normal no desktop, então o comportamento ficava
                     invisível: arrastar para copiar um e-mail abria a edição. */
                  <tr key={u.id} className="border-t border-slate-100">
                    {/* `max-w-0 w-full` é o que faz o `truncate` funcionar
                        dentro de uma célula: sem largura máxima a célula cresce
                        até caber o conteúdo, e o e-mail longo empurrava a coluna
                        de ações para fora da tela. O `overflow-hidden` da seção
                        escondia o estouro, então isso passava despercebido. */}
                    <td className="px-4 py-3 max-w-0 w-full">
                      <div className="font-medium text-slate-900 flex items-center gap-2 min-w-0">
                        <span className="truncate">
                          {u.full_name || "(sem nome)"}
                        </span>
                        {suspended && (
                          <Badge size="compact" colorScheme="rose">
                            suspenso
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 truncate">
                        {u.email}
                      </div>
                      <div className="text-sm text-slate-400 mt-0.5 sm:hidden">
                        {u.is_master ? (
                          <Badge size="compact" colorScheme="amber">
                            master
                          </Badge>
                        ) : u.trial_ends_at ? (
                          <span
                            className={
                              trialActive ? "text-slate-500" : "text-rose-500"
                            }
                          >
                            {trialActive ? "trial até " : "trial expirou "}
                            {fmtDate(u.trial_ends_at)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                      {u.is_master ? (
                        <Badge size="compact" colorScheme="amber">
                          master
                        </Badge>
                      ) : u.trial_ends_at ? (
                        <span
                          className={
                            trialActive ? "text-slate-600" : "text-rose-500"
                          }
                        >
                          {trialActive ? "até " : "expirou "}
                          {fmtDate(u.trial_ends_at)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden md:table-cell">
                      {fmtDate(u.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3">
                      {/* Botões de ícone no padrão do app (ActionIconButton):
                          eram um ícone cinza fino e um link de texto, que não
                          se liam como ação nem tinham área de toque. */}
                      <div className="flex items-center justify-end gap-1">
                        <ActionIconButton
                          icon={Download}
                          label="Baixar o que essa pessoa cadastrou (JSON)"
                          disabled={backingUp === u.id}
                          onClick={() => void handleBackup(u)}
                        />
                        <ActionIconButton
                          icon={Pencil}
                          label="Editar"
                          onClick={() => openEdit(u)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {/* Convidar usuário */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o);
          if (!o) setIForm({ email: "", full_name: "" });
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Email
                <Obrigatorio />
              </label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={iForm.email}
                onChange={(e) =>
                  setIForm((s) => ({ ...s, email: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome
              </label>
              <Input
                placeholder="Nome completo"
                value={iForm.full_name}
                onChange={(e) =>
                  setIForm((s) => ({ ...s, full_name: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setInviteOpen(false)}
              className={cn(BOTAO_BARRA, "rounded-md")}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !iForm.email.trim()}
            >
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
                Email
                <Obrigatorio />
              </label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={cForm.email}
                onChange={(e) =>
                  setCForm((s) => ({ ...s, email: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome
              </label>
              <Input
                placeholder="Nome completo"
                value={cForm.full_name}
                onChange={(e) =>
                  setCForm((s) => ({ ...s, full_name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome da organização
              </label>
              <Input
                placeholder="Minha Fazenda"
                value={cForm.farm_name}
                onChange={(e) =>
                  setCForm((s) => ({ ...s, farm_name: e.target.value }))
                }
              />
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={cForm.invite}
                onChange={(e) =>
                  setCForm((s) => ({ ...s, invite: e.target.checked }))
                }
                className="mt-0.5"
              />
              <span className="text-slate-700">
                Convidar por email (em vez de definir senha). O usuário recebe
                um link e define a própria senha.
              </span>
            </label>
            {!cForm.invite && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Senha
                  <Obrigatorio />
                </label>
                <Input
                  type="text"
                  placeholder="Mínimo 6 caracteres"
                  value={cForm.password}
                  onChange={(e) =>
                    setCForm((s) => ({ ...s, password: e.target.value }))
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              className={cn(BOTAO_BARRA, "rounded-md")}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating
                ? "Criando..."
                : cForm.invite
                  ? "Enviar Convite"
                  : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar usuário */}

      {/* Alterar senha */}
      {dialogosDaEdicao}
    </div>
  );
}
