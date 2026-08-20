import { useState } from "react";
import Trash2 from "~icons/ph/trash";
import UserPlus from "~icons/ph/user-plus";
import Plus from "~icons/ph/plus";
import Download from "~icons/ph/download-simple";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ChevronDown from "~icons/ph/caret-down";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import { TOOLBAR_TRIGGER_CLASS } from "@/components/ui/toolbarTrigger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { LoadingState } from "@/components/ui/LoadingState";
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
    seats_limit_reached: "Os assentos desta organização acabaram. Aumente o limite antes.",
    seats_below_current_members: "O limite não pode ficar abaixo de quem já está dentro.",
    user_not_found: "Não existe conta com esse e-mail.",
    already_member: "Essa pessoa já está nesta organização.",
    transfer_ownership_first: "Transfira a titularidade antes de mexer neste usuário.",
    org_not_found: "Organização não encontrada.",
  };
  return (code && MESSAGES[code]) || fallback;
}

export default function AdminOrgsPage() {
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
  const [kindFilter, setKindFilter] = useState<"company" | "individual" | "all">(
    "company",
  );
  const visibleOrgs = orgs.filter(
    (o) => kindFilter === "all" || o.kind === kindFilter,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [cForm, setCForm] = useState({ name: "", cnpj: "", seats: "5" });
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState<AdminOrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [adding, setAdding] = useState(false);
  // Pendência do 409 "user_has_data": segura os dados até o master confirmar.
  const [pendingMove, setPendingMove] = useState<
    { email: string; role: string; receipts: number; from: string | null } | null
  >(null);

  const [pendingRemove, setPendingRemove] = useState<AdminOrgMember | null>(null);
  const [seatsDraft, setSeatsDraft] = useState("");
  const [backingUp, setBackingUp] = useState<string | null>(null);

  async function handleBackup(scope: "org" | "user", id: string, label: string) {
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
    setDetailLoading(true);
    try {
      const d = await loadDetail(org.id);
      setDetail(d);
      setSeatsDraft(String(d.organization.seats_limit));
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
      await updateOrg(detail.organization.id, { seats_limit: n, kind: "company" });
      toast.success("Acessos atualizados");
      await reloadDetail();
    } catch (e) {
      toast.error(apiMessage(e, "Erro ao salvar"));
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Organizações da plataforma. O assinante avulso é uma organização de 1
          acesso; a do cliente com equipe tem vários.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1" />
          Nova
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                TOOLBAR_TRIGGER_CLASS,
                "w-full sm:w-auto justify-between",
                kindFilter !== "all" && "bg-slate-800 text-white hover:bg-slate-700",
              )}
            >
              {kindFilter === "company" && "Com equipe"}
              {kindFilter === "individual" && "Avulsos"}
              {kindFilter === "all" && "Todas"}
              <ChevronDown className="size-4 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onClick={() => setKindFilter("company")}
              className={kindFilter === "company" ? "bg-white/10 font-medium" : ""}
            >
              Com equipe
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setKindFilter("individual")}
              className={kindFilter === "individual" ? "bg-white/10 font-medium" : ""}
            >
              Avulsos
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setKindFilter("all")}
              className={kindFilter === "all" ? "bg-white/10 font-medium" : ""}
            >
              Todas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="hidden sm:inline-flex items-center text-xs text-slate-500">
          {visibleOrgs.length} de {orgs.length}
        </span>
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
            <thead className="bg-slate-50 text-slate-600 text-xs">
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
                      <div className="text-xs text-slate-500">{o.cnpj}</div>
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
                  <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">
                    {o.plan_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">
                    {fmtDate(o.trial_ends_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleBackup("org", o.id, o.name)}
                        disabled={backingUp === o.id}
                        className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                        title="Baixar backup JSON da organização"
                      >
                        <Download className="size-4" />
                        {backingUp === o.id ? "Gerando…" : "Backup"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openDetail(o)}
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        Gerenciar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleOrgs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
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
              </label>
              <Input
                placeholder="Fazenda Santa Rita"
                value={cForm.name}
                onChange={(e) => setCForm((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                CNPJ (opcional)
              </label>
              <Input
                value={cForm.cnpj}
                onChange={(e) => setCForm((s) => ({ ...s, cnpj: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Acessos contratados
              </label>
              <Input
                type="number"
                min={1}
                value={cForm.seats}
                onChange={(e) => setCForm((s) => ({ ...s, seats: e.target.value }))}
              />
              <p className="text-xs text-slate-500 mt-1">
                Teto de pessoas na organização, contando o gestor. O gestor
                convida a equipe pelo código de 6 dígitos.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe / gestão */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.organization.name}</DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <LoadingState />
          ) : (
            <div className="space-y-5 py-2">
              {/* Acessos */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Acessos contratados
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={seatsDraft}
                    onChange={(e) => setSeatsDraft(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={handleSeats}>
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-slate-500 -mt-3">
                {detail.organization.seats_used} em uso. Salvar também marca a
                organização como <strong>Equipe</strong>.
              </p>

              {/* Membros */}
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Pessoas ({detail.members.length})
                </h3>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded">
                  {detail.members.map((m) => (
                    <li key={m.user_id} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {m.full_name || "(sem nome)"}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {m.email} — {m.receipts} lançamento(s)
                        </div>
                      </div>
                      <select
                        value={m.role}
                        onChange={(e) => void handleRole(m, e.target.value)}
                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                      >
                        <option value="owner">{ROLE_LABEL.owner}</option>
                        <option value="admin">{ROLE_LABEL.admin}</option>
                        <option value="member">{ROLE_LABEL.member}</option>
                        <option value="viewer">{ROLE_LABEL.viewer}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          void handleBackup("user", m.user_id, m.full_name || m.email || "usuario")
                        }
                        disabled={backingUp === m.user_id}
                        className="text-slate-400 hover:text-slate-900"
                        title="Baixar o que essa pessoa cadastrou (JSON)"
                      >
                        <Download className="size-4" />
                      </button>
                      {m.role !== "owner" && (
                        <button
                          type="button"
                          onClick={() => setPendingRemove(m)}
                          className="text-slate-400 hover:text-red-600"
                          title="Desvincular"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Vincular alguém */}
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Vincular conta existente
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@da.pessoa"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="text-sm border border-slate-200 rounded px-2 bg-white"
                  >
                    <option value="member">{ROLE_LABEL.member}</option>
                    <option value="admin">{ROLE_LABEL.admin}</option>
                    <option value="viewer">{ROLE_LABEL.viewer}</option>
                  </select>
                  <Button
                    variant="outline"
                    onClick={() => void handleAddMember("ask")}
                    disabled={adding}
                  >
                    <UserPlus className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  A conta precisa já existir (crie em Usuários). A primeira
                  pessoa vinculada vira a titular. Para o resto da equipe, o
                  gestor convida pela tela de Equipe.
                </p>
              </div>

              {/* Ex-membros */}
              {detail.former_members.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-2">
                    Já passaram por aqui
                  </h3>
                  <ul className="text-xs text-slate-500 space-y-1">
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conta com histórico: as duas saídas, explicadas */}
      <Dialog open={!!pendingMove} onOpenChange={(o) => !o && setPendingMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Essa conta já tem histórico</DialogTitle>
          </DialogHeader>
          {pendingMove && (
            <div className="space-y-3 py-2 text-sm text-slate-700">
              <p>
                <strong>{pendingMove.email}</strong> tem{" "}
                {pendingMove.receipts} lançamento(s) em{" "}
                {pendingMove.from ?? "outra organização"}.
              </p>
              <p className="text-slate-600">
                <strong>Trazer junto</strong> move os lançamentos para esta
                organização e o centro de custo vira o padrão daqui (a pessoa
                reclassifica depois). É o que ela espera — a conta antiga fica
                sem ninguém dentro, então o histórico ficaria inacessível.
              </p>
              <p className="text-slate-600">
                <strong>Deixar lá</strong> mantém o histórico na conta antiga e a
                pessoa entra aqui com a lista vazia.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleAddMember("keep")}
              disabled={adding}
            >
              Deixar lá
            </Button>
            <Button onClick={() => void handleAddMember("move")} disabled={adding}>
              Trazer junto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
