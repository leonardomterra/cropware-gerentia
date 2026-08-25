import { useState } from "react";
import Trash2 from "~icons/ph/trash";
import Search from "~icons/ph/magnifying-glass";
import FilterList from "~icons/ph/funnel";
import X from "~icons/ph/x";
import UserPlus from "~icons/ph/user-plus";
import Plus from "~icons/ph/plus";
import Download from "~icons/ph/download-simple";
import ArrowLeft from "~icons/ph/arrow-left";
import Pencil from "~icons/ph/pencil-simple";
import BuildingOffice from "~icons/ph/building-office-duotone";
import Gear from "~icons/ph/gear-six";
import { toast } from "sonner";
import { api } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ChevronDown from "~icons/ph/caret-down";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { cn } from "@/components/ui/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterCountBadge } from "@/components/ui/FilterCountBadge";
import { useIsMobile } from "@/components/ui/use-mobile";
import {
  BOTAO_BARRA,
  BOTAO_BARRA_PRIMARIO,
  ICONE_BOTAO_BARRA,
  PAINEL_ESCURO,
  ROTULO_PAINEL_ESCURO,
  SETA_BOTAO_BARRA,
} from "@/lib/ui-tokens";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { Obrigatorio } from "@/components/ui/Obrigatorio";
import { Ajuda } from "@/components/ui/Ajuda";
import { ApiError } from "@/utils/api";
import { downloadBackup, useAdminOrgs } from "../hooks/useAdminOrgs";
import type { AdminOrg, AdminOrgDetail, AdminOrgMember } from "../types";

const ROLE_LABEL: Record<string, string> = {
  owner: "Gestor (titular)",
  admin: "Gestor",
  member: "Usuário",
  viewer: "Convidado",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

/** Lê o JSON de erro da API (ApiError guarda o corpo cru). */
function errorBody(e: unknown): Record<string, unknown> | null {
  if (!(e instanceof ApiError)) return null;
  try {
    return JSON.parse(e.body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function apiMessage(e: unknown, fallback: string): string {
  const body = errorBody(e);
  const code = typeof body?.error === "string" ? body.error : null;
  const MESSAGES: Record<string, string> = {
    seats_limit_reached:
      "Os assentos desta organização acabaram. Aumente o limite antes.",
    seats_below_current_members:
      "O limite não pode ficar abaixo de quem já está dentro.",
    user_not_found: "Não existe conta com esse e-mail.",
    already_member: "Essa pessoa já está nesta organização.",
    transfer_ownership_first:
      "Transfira a titularidade antes de mexer neste usuário.",
    org_not_found: "Organização não encontrada.",
  };
  return (code && MESSAGES[code]) || fallback;
}

/**
 * `aoSair` existe porque esta tela vive dentro do hub de Configurações e tem um
 * nível a mais: lista → uma organização. O Voltar da LISTA precisa devolver ao
 * hub; o do detalhe, à lista. Sem isso o hub desenhava um Voltar e a tela
 * desenhava outro, empilhados e fazendo coisas diferentes.
 *
 * Opcional: pela rota /admin/organizacoes a tela abre sozinha e não há para
 * onde sair.
 */
export default function AdminOrgsPage({
  aoSair,
  aoEditarUsuario,
}: {
  aoSair?: () => void;
  /** Leva à tela de Usuários já buscando por este e-mail. */
  aoEditarUsuario?: (email: string) => void;
}) {
  const {
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
  } = useAdminOrgs();

  // A lista é dominada por assinante avulso (1 org por conta), então o que o
  // master quer ver primeiro é o punhado de organizações com equipe.
  const [kindFilter, setKindFilter] = useState<
    "company" | "individual" | "all"
  >("company");
  const [busca, setBusca] = useState("");
  const isMobile = useIsMobile();
  const visibleOrgs = orgs.filter((o) => {
    if (kindFilter !== "all" && o.kind !== kindFilter) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return [o.name, o.cnpj].some((c) => (c ?? "").toLowerCase().includes(q));
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [cForm, setCForm] = useState({ name: "", cnpj: "", seats: "5" });
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState<AdminOrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Separado de `detail` porque a tela abre ANTES de os dados chegarem: com um
  // estado só, o clique não mostrava nada até a resposta e parecia travado.
  const [detailOpen, setDetailOpen] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoPapel, setNovoPapel] = useState("member");
  const [criando, setCriando] = useState(false);
  const [confirmarCriacao, setConfirmarCriacao] = useState(false);

  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [adding, setAdding] = useState(false);
  // Pendência do 409 "user_has_data": segura os dados até o master confirmar.
  const [pendingMove, setPendingMove] = useState<{
    email: string;
    role: string;
    receipts: number;
    from: string | null;
  } | null>(null);

  const [pendingRemove, setPendingRemove] = useState<AdminOrgMember | null>(
    null,
  );
  const [seatsDraft, setSeatsDraft] = useState("");
  const [backingUp, setBackingUp] = useState<string | null>(null);

  async function handleBackup(
    scope: "org" | "user",
    id: string,
    label: string,
  ) {
    setBackingUp(id);
    try {
      await downloadBackup(scope, id, label);
      toast.success("Backup gerado");
    } catch {
      toast.error("Erro ao gerar o backup");
    } finally {
      setBackingUp(null);
    }
  }

  async function openDetail(org: AdminOrg) {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const d = await loadDetail(org.id);
      setDetail(d);
      setSeatsDraft(String(d.organization.seats_limit).padStart(2, "0"));
      setAddEmail("");
      setAddRole("member");
    } catch {
      toast.error("Erro ao carregar a organização");
    } finally {
      setDetailLoading(false);
    }
  }

  async function reloadDetail() {
    if (!detail) return;
    const d = await loadDetail(detail.organization.id);
    setDetail(d);
    await refresh();
  }

  async function handleCreate() {
    const name = cForm.name.trim();
    if (!name) {
      toast.error("Informe o nome da organização");
      return;
    }
    setCreating(true);
    try {
      await createOrg({
        name,
        cnpj: cForm.cnpj.trim() || undefined,
        seats_limit: Number(cForm.seats) || 5,
      });
      toast.success("Organização criada");
      setCreateOpen(false);
      setCForm({ name: "", cnpj: "", seats: "5" });
    } catch (e) {
      toast.error(apiMessage(e, "Erro ao criar organização"));
    } finally {
      setCreating(false);
    }
  }

  async function handleCriarEVincular() {
    if (!detail) return;
    const email = novoEmail.trim();
    if (!email) return;
    setCriando(true);
    try {
      // Endpoint direto em vez do hook `useAdminUsers`: ele carrega a lista
      // inteira de usuários da plataforma, e aqui só precisamos criar um.
      await api("/admin/users", {
        method: "POST",
        body: {
          email,
          full_name: novoNome.trim() || undefined,
          invite: true,
        },
      });
      // "keep": conta recém-criada não tem histórico para trazer, e perguntar
      // seria uma pergunta sem resposta possível.
      await addMember(detail.organization.id, email, novoPapel, "keep");
      toast.success("Conta criada e vinculada. O convite foi enviado.");
      setNovoEmail("");
      setNovoNome("");
      await reloadDetail();
    } catch (e) {
      const body = errorBody(e);
      toast.error(
        body?.error === "user_exists"
          ? "Já existe conta com esse e-mail — use Vincular conta existente."
          : "Não consegui criar. A conta pode ter sido criada sem o vínculo; confira em Usuários.",
      );
    } finally {
      setCriando(false);
    }
  }

  async function handleAddMember(data: "ask" | "move" | "keep" = "ask") {
    if (!detail) return;
    const email = (pendingMove?.email ?? addEmail).trim();
    const role = pendingMove?.role ?? addRole;
    if (!email) return;
    setAdding(true);
    try {
      const r = await addMember(detail.organization.id, email, role, data);
      const movedCount = r.moved_data?.receipts ?? 0;
      toast.success(
        movedCount > 0
          ? `Vinculado. ${movedCount} lançamento(s) vieram junto.`
          : r.receipts_left_behind > 0
            ? `Vinculado. ${r.receipts_left_behind} lançamento(s) ficaram na conta anterior.`
            : "Pessoa vinculada à organização",
      );
      setAddEmail("");
      setPendingMove(null);
      await reloadDetail();
    } catch (e) {
      const body = errorBody(e);
      if (body?.error === "user_has_data") {
        setPendingMove({
          email,
          role,
          receipts: Number(body.receipts ?? 0),
          from: (body.current_organization as string) ?? null,
        });
      } else {
        toast.error(apiMessage(e, "Erro ao vincular"));
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRole(m: AdminOrgMember, role: string) {
    if (!detail) return;
    try {
      await setMemberRole(detail.organization.id, m.user_id, role);
      toast.success("Perfil atualizado");
      await reloadDetail();
    } catch (e) {
      toast.error(apiMessage(e, "Erro ao trocar o perfil"));
    }
  }

  async function handleRemove() {
    if (!detail || !pendingRemove) return;
    try {
      await removeMember(detail.organization.id, pendingRemove.user_id);
      toast.success("Desvinculado. Os lançamentos ficaram na organização.");
      setPendingRemove(null);
      await reloadDetail();
    } catch (e) {
      toast.error(apiMessage(e, "Erro ao desvincular"));
    }
  }

  async function handleSeats() {
    if (!detail) return;
    const n = Number(seatsDraft);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Número de acessos inválido");
      return;
    }
    try {
      await updateOrg(detail.organization.id, {
        seats_limit: n,
        kind: "company",
      });
      toast.success("Acessos atualizados");
      await reloadDetail();
    } catch (e) {
      toast.error(apiMessage(e, "Erro ao salvar"));
    }
  }

  // Gerenciar SUBSTITUI a lista. Era um dialog com assentos, lista de membros
  // com seletor de papel por linha e vínculo de conta — conteúdo de tela, não
  // de caixa: no celular a rolagem interna brigava com a da página.
  /**
   * Diálogos disparados de DENTRO da tela de gerenciar (mover conta com
   * histórico, desvincular membro). Ficam numa variável porque a tela usa
   * `return` antecipado: deixados só no return principal, não seriam montados
   * enquanto o gerenciamento está aberto — o botão setava o estado e nada
   * aparecia.
   */
  const dialogosDoGerenciar = (
    <>
      <Dialog
        open={!!pendingMove}
        onOpenChange={(o) => !o && setPendingMove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Essa conta já tem histórico</DialogTitle>
          </DialogHeader>
          {pendingMove && (
            <div className="space-y-3 py-2 text-sm text-slate-700">
              <p>
                <strong>{pendingMove.email}</strong> tem {pendingMove.receipts}{" "}
                lançamento(s) em {pendingMove.from ?? "outra organização"}.
              </p>
              <p className="text-slate-600">
                <strong>Trazer junto</strong> move os lançamentos para esta
                organização e o centro de custo vira o padrão daqui (a pessoa
                reclassifica depois). É o que ela espera — a conta antiga fica
                sem ninguém dentro, então o histórico ficaria inacessível.
              </p>
              <p className="text-slate-600">
                <strong>Deixar lá</strong> mantém o histórico na conta antiga e
                a pessoa entra aqui com a lista vazia.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingMove(null)}
              className={cn(BOTAO_BARRA, "rounded-md")}
            >
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={() => void handleAddMember("keep")}
              disabled={adding}
              className={cn(BOTAO_BARRA, "rounded-md")}
            >
              Deixar lá
            </Button>
            <Button
              onClick={() => void handleAddMember("move")}
              disabled={adding}
            >
              Trazer junto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirma criar-e-vincular.
          VINCULAR conta existente não pede confirmação: é reversível pelo
          próprio "desvincular" ao lado. CRIAR, não — a conta passa a existir e
          um e-mail sai para a pessoa. E-mail enviado não volta. */}
      <ConfirmActionDialog
        open={confirmarCriacao}
        onOpenChange={setConfirmarCriacao}
        title="Criar conta e vincular"
        description="A conta é criada e um convite é enviado por e-mail para a pessoa definir a senha. O e-mail sai na hora e não dá para cancelar."
        infoItems={[
          { label: "E-mail", value: novoEmail.trim() },
          { label: "Nome", value: novoNome.trim() || "(sem nome)" },
          {
            label: "Perfil",
            value:
              ROLE_LABEL[novoPapel as keyof typeof ROLE_LABEL] ?? novoPapel,
          },
          {
            label: "Organização",
            value: detail?.organization.name ?? "",
          },
        ]}
        confirmLabel="Criar e Enviar Convite"
        loading={criando}
        loadingLabel="Criando..."
        onConfirm={() => {
          setConfirmarCriacao(false);
          void handleCriarEVincular();
        }}
      />

      {/* Confirma desvincular */}
      <ConfirmActionDialog
        open={!!pendingRemove}
        onOpenChange={(o) => !o && setPendingRemove(null)}
        title="Desvincular da organização?"
        description={
          pendingRemove
            ? `${pendingRemove.full_name || pendingRemove.email} sai da organização e recebe uma conta avulsa vazia. Os ${pendingRemove.receipts} lançamento(s) que cadastrou FICAM aqui, com o nome preservado no histórico.`
            : ""
        }
        confirmLabel="Desvincular"
        onConfirm={handleRemove}
      />
    </>
  );

  if (detailOpen) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDetail(null);
              setDetailOpen(false);
            }}
            className={cn(BOTAO_BARRA, "rounded-md")}
          >
            <ArrowLeft className="size-4 mr-2" />
            Voltar
          </Button>
          <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
            <Gear className="size-[18px] shrink-0 text-amber-600" />
            <span className="truncate">
              {detail?.organization.name ?? "Organização"}
            </span>
          </span>
        </div>

        {dialogosDoGerenciar}

        <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-6">
          {detailLoading || !detail ? (
            <LoadingState />
          ) : (
            <div className="space-y-5 py-2">
              {/* Acessos */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  {/* O mesmo (?) do formulário de criar. Aqui a explicação
                      nunca existiu, e o campo é exatamente o mesmo — quem
                      aprendeu numa tela não deveria reaprender na outra. */}
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                    Acessos contratados
                    <Ajuda>
                      Teto de pessoas na organização, contando o gestor. O
                      gestor convida a equipe pelo código de 6 dígitos.
                    </Ajuda>
                  </label>
                  {/* Dois dígitos e sem as setinhas do `type="number"`: o
                      valor é um punhado de acessos, não uma quantia. Com
                      `type="text"` + `inputMode` o teclado do celular ainda
                      abre numérico, e o filtro impede letra.

                      A formatação para "05" acontece ao SAIR do campo, não a
                      cada tecla: no `onChange` o zero à esquerda apareceria
                      enquanto a pessoa ainda digita o segundo dígito. */}
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={seatsDraft}
                    onChange={(e) =>
                      setSeatsDraft(
                        e.target.value.replace(/\D/g, "").slice(0, 2),
                      )
                    }
                    onBlur={() => {
                      const n = Number(seatsDraft);
                      if (Number.isFinite(n) && n > 0) {
                        setSeatsDraft(String(n).padStart(2, "0"));
                      }
                    }}
                    className="tabular-nums"
                  />
                </div>
                <Button
                  onClick={handleSeats}
                  className={cn(BOTAO_BARRA_PRIMARIO, "w-auto")}
                >
                  Salvar
                </Button>
              </div>

              {/* Membros */}
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Pessoas ({detail.members.length})
                </h3>
                {/* Card por pessoa, no molde do Flag Field (o mesmo de
                    Recorrências): colunas de duas linhas, um tamanho só, tom
                    por posição — 900 em cima, 700 embaixo —, peso apenas na
                    primeira linha da primeira coluna. A lista era uma <ul> com
                    divisórias, e o papel de cada um se perdia no meio. */}
                <div className="space-y-2">
                  {detail.members.map((m) => (
                    <div
                      key={m.user_id}
                      className="bg-white rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center gap-4">
                        {/* 1 — quem */}
                        <div className="min-w-0 flex-[1.4] self-center flex flex-col gap-0.5">
                          <p className="h-5 text-sm font-medium text-slate-900 truncate">
                            {m.full_name || "(sem nome)"}
                          </p>
                          <p className="text-sm leading-5 text-slate-700 truncate">
                            {m.email}
                          </p>
                        </div>

                        {/* 2 — quanto lançou. UMA linha e centrado: quebrar
                            "1 lançamento" em número e palavra lia como erro de
                            quebra, não como duas informações. */}
                        <div className="min-w-0 flex-1 self-center hidden sm:block">
                          <p className="text-sm text-slate-700 truncate tabular-nums">
                            {m.receipts}{" "}
                            {m.receipts === 1 ? "lançamento" : "lançamentos"}
                          </p>
                        </div>

                        {/* 3 — papel na organização. 176px porque "Gestor
                            (titular)" é o rótulo mais longo e truncava. */}
                        <div className="shrink-0 self-center w-[176px]">
                          <Select
                            value={m.role}
                            onValueChange={(v) => void handleRole(m, v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">
                                {ROLE_LABEL.owner}
                              </SelectItem>
                              <SelectItem value="admin">
                                {ROLE_LABEL.admin}
                              </SelectItem>
                              <SelectItem value="member">
                                {ROLE_LABEL.member}
                              </SelectItem>
                              <SelectItem value="viewer">
                                {ROLE_LABEL.viewer}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Largura FIXA: o titular não tem "desvincular", e
                            sem a reserva a fileira de botões dele encolhia e
                            desalinhava o seletor de papel da linha inteira. */}
                        <div className="shrink-0 self-center w-[124px] flex items-center justify-end gap-1">
                          {/* Editar leva à tela de Usuários já filtrada nesta
                              pessoa: gerir a conta (nome, trial, senha) é lá, e
                              duplicar aquele formulário aqui criaria duas telas
                              que divergem. */}
                          <ActionIconButton
                            icon={Pencil}
                            label="Editar esta pessoa em Usuários"
                            onClick={() => aoEditarUsuario?.(m.email ?? "")}
                            disabled={!aoEditarUsuario || !m.email}
                          />
                          <ActionIconButton
                            icon={Download}
                            label="Baixar o que essa pessoa cadastrou (JSON)"
                            disabled={backingUp === m.user_id}
                            onClick={() =>
                              void handleBackup(
                                "user",
                                m.user_id,
                                m.full_name || m.email || "usuario",
                              )
                            }
                          />
                          {m.role !== "owner" && (
                            <ActionIconButton
                              icon={Trash2}
                              label="Desvincular"
                              tone="danger"
                              onClick={() => setPendingRemove(m)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Os dois blocos de adicionar gente são CARDS TINGIDOS, e não
                  brancos como os das pessoas: card branco aqui leria como mais
                  um membro da lista, e não como um formulário. A cor separa
                  "quem já está" de "como pôr alguém".

                  Azul = ligar o que existe; verde = criar algo novo. */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Vincular conta existente
                </h3>
                {/* Uma linha: campo esticando, seletor de 176px e a ação
                    encostada nele.

                    O seletor é o Select do app, e não um <select> nativo: o
                    nativo desenha a PRÓPRIA seta, com tamanho e alinhamento
                    diferentes de todos os outros seletores da tela. */}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="email@da.pessoa"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="flex-1 min-w-[200px]"
                  />
                  <div className="shrink-0 w-[176px]">
                    <Select value={addRole} onValueChange={setAddRole}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">
                          {ROLE_LABEL.member}
                        </SelectItem>
                        <SelectItem value="admin">
                          {ROLE_LABEL.admin}
                        </SelectItem>
                        <SelectItem value="viewer">
                          {ROLE_LABEL.viewer}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <ActionIconButton
                    icon={UserPlus}
                    label="Vincular à organização"
                    disabled={adding || !addEmail.trim()}
                    onClick={() => void handleAddMember("ask")}
                    className="bg-white shrink-0"
                  />
                </div>
                {/* slate-600, e não o 500 dos cards brancos: sobre o fundo
                    tingido o 500 cai abaixo de 4,5:1. */}
                <p className="text-sm text-slate-600 mt-1">
                  A primeira pessoa vinculada vira a titular. Para o resto da
                  equipe, o gestor convida pela tela de Equipe.
                </p>
              </div>

              {/* Criar já vinculando.
                  Antes só dava para vincular conta EXISTENTE: para pôr alguém
                  novo numa organização era preciso sair daqui, criar em
                  Usuários, voltar e vincular. Três telas para uma intenção só.

                  Cria e vincula em sequência, reaproveitando os dois endpoints
                  que já existem — sem rota nova no backend. Se o vínculo
                  falhar, a conta fica criada e a mensagem diz isso: some com o
                  passo, não com a informação. */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Criar conta nova e vincular
                </h3>
                {/* Tudo numa linha só. Quebra para duas no celular pelo
                    `flex-wrap`, com `min-w` garantindo que nenhum campo fique
                    ilegível antes disso. */}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="email@da.pessoa"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    className="flex-1 min-w-[200px]"
                  />
                  <Input
                    placeholder="Nome completo (opcional)"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    className="flex-1 min-w-[180px]"
                  />
                  <div className="shrink-0 w-[176px]">
                    <Select value={novoPapel} onValueChange={setNovoPapel}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">
                          {ROLE_LABEL.member}
                        </SelectItem>
                        <SelectItem value="admin">
                          {ROLE_LABEL.admin}
                        </SelectItem>
                        <SelectItem value="viewer">
                          {ROLE_LABEL.viewer}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <ActionIconButton
                    icon={UserPlus}
                    label="Criar a conta e vincular"
                    disabled={criando || !novoEmail.trim()}
                    onClick={() => setConfirmarCriacao(true)}
                    className="bg-white shrink-0"
                  />
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  A pessoa recebe um convite por e-mail para definir a senha.
                </p>
              </div>

              {/* Ex-membros */}
              {detail.former_members.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-2">
                    Já passaram por aqui
                  </h3>
                  <ul className="text-sm text-slate-500 space-y-1">
                    {detail.former_members.map((f) => (
                      <li key={f.user_id}>
                        {f.full_name || "(sem nome)"} — saiu em{" "}
                        {fmtDate(f.removed_at)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <BuildingOffice className="size-[18px] shrink-0 text-amber-600" />
            <span className="truncate">Organizações</span>
          </span>
        </div>
      )}

      {/* Barra no padrão do app: busca esticando, Filtros à direita. A tela
          não tinha busca — só um seletor de tipo —, e achar uma organização
          numa lista crescente dependia de rolar. */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CNPJ..."
            className="pl-8 h-9 border-slate-200 shadow-none text-slate-500"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(BOTAO_BARRA, "inline-flex items-center rounded-md")}
            >
              <FilterList className={ICONE_BOTAO_BARRA} />
              Filtros
              <FilterCountBadge count={kindFilter === "all" ? 0 : 1} />
              <ChevronDown className={SETA_BOTAO_BARRA} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className={PAINEL_ESCURO}
            style={
              isMobile
                ? { width: "var(--radix-popover-trigger-width)" }
                : undefined
            }
          >
            <div className="space-y-1.5">
              <label className={ROTULO_PAINEL_ESCURO}>Tipo de conta</label>
              <Select
                value={kindFilter}
                onValueChange={(v) => setKindFilter(v as typeof kindFilter)}
              >
                <SelectTrigger className="h-9 bg-white text-slate-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="company">Com equipe</SelectItem>
                  <SelectItem value="individual">Avulsos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
        <Button
          variant="default"
          onClick={() => setCreateOpen(true)}
          className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5")}
        >
          <Plus className="size-[18px] shrink-0" />
          Nova Organização
        </Button>
      </div>

      <div className="flex items-center justify-end gap-1 px-1 min-h-[28px]">
        <p className="text-sm text-slate-500">
          {visibleOrgs.length === 0
            ? "Nenhuma organização encontrada"
            : `Mostrando ${visibleOrgs.length} ${
                visibleOrgs.length === 1 ? "Organização" : "Organizações"
              }`}
        </p>
        {(kindFilter !== "all" || busca.trim()) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBusca("");
              setKindFilter("all");
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

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        {loading ? (
          <LoadingState />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-sm">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Organização</th>
                <th className="text-left px-4 py-2 font-medium">Tipo</th>
                <th className="text-left px-4 py-2 font-medium">Acessos</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">
                  Plano
                </th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">
                  Trial
                </th>
                <th className="text-right px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visibleOrgs.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{o.name}</div>
                    {o.cnpj && (
                      <div className="text-sm text-slate-500">{o.cnpj}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      size="compact"
                      colorScheme={o.kind === "company" ? "blue" : "slate"}
                    >
                      {o.kind === "company" ? "Equipe" : "Avulso"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {o.seats_used}/{o.seats_limit}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                    {o.plan_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                    {fmtDate(o.trial_ends_at)}
                  </td>
                  <td className="px-4 py-3">
                    {/* Botões de ícone no padrão do app, como na tabela de
                        Usuários: eram dois links de texto, que numa tabela leem
                        como conteúdo da linha, não como ação. */}
                    <div className="flex items-center justify-end gap-1">
                      <ActionIconButton
                        icon={Download}
                        label={
                          backingUp === o.id
                            ? "Gerando backup…"
                            : "Baixar backup JSON da organização"
                        }
                        disabled={backingUp === o.id}
                        onClick={() => void handleBackup("org", o.id, o.name)}
                      />
                      <ActionIconButton
                        icon={Gear}
                        label="Gerenciar"
                        onClick={() => void openDetail(o)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {visibleOrgs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    {kindFilter === "company"
                      ? "Nenhuma organização com equipe ainda."
                      : "Nenhuma organização neste filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Criar organização */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova organização</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome
                <Obrigatorio />
              </label>
              <Input
                placeholder="Fazenda Santa Rita"
                value={cForm.name}
                onChange={(e) =>
                  setCForm((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                CNPJ
              </label>
              <Input
                value={cForm.cnpj}
                onChange={(e) =>
                  setCForm((s) => ({ ...s, cnpj: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
                Acessos contratados
                <Ajuda>
                  Teto de pessoas na organização, contando o gestor. O gestor
                  convida a equipe pelo código de 6 dígitos.
                </Ajuda>
              </label>
              <Input
                type="number"
                min={1}
                value={cForm.seats}
                onChange={(e) =>
                  setCForm((s) => ({ ...s, seats: e.target.value }))
                }
              />
            </div>
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
              {creating ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe / gestão */}

      {/* Conta com histórico: as duas saídas, explicadas */}
      {dialogosDoGerenciar}
    </div>
  );
}
