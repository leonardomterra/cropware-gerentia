import { useState } from "react";
import Copy from "~icons/material-symbols-light/content-copy-outline";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import UserPlus from "~icons/material-symbols-light/person-add-outline";
import X from "~icons/material-symbols-light/close";
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
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "../hooks/useTeam";
import type { Member } from "../types";

interface InviteForm {
  name: string;
  role: "admin" | "member";
  ccIds: string[];
}

export default function TeamPage() {
  const { user } = useAuth();
  const { members, invites, loading, error, createInvite, revokeInvite, updateMember, removeMember } = useTeam();
  const orgCCs = user?.costCenters ?? [];

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({ name: "", role: "member", ccIds: [] });
  const [creating, setCreating] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);

  const [editing, setEditing] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState<{ role: "admin" | "member"; ccIds: string[] }>({ role: "member", ccIds: [] });

  function openInvite() {
    setInviteForm({ name: "", role: "member", ccIds: [] });
    setLastInviteCode(null);
    setInviteOpen(true);
  }

  async function handleCreateInvite() {
    setCreating(true);
    const invite = await createInvite({
      invited_name: inviteForm.name.trim() || undefined,
      role: inviteForm.role,
      cost_center_ids: inviteForm.role === "member" ? inviteForm.ccIds : [],
    });
    setCreating(false);
    if (invite) {
      setLastInviteCode(invite.code);
      toast.success("Convite criado");
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/entrar?codigo=${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  function openEdit(m: Member) {
    if (m.role === "owner") {
      toast.error("Owner nao pode ser editado por aqui.");
      return;
    }
    setEditing(m);
    setEditForm({
      role: m.role as "admin" | "member",
      ccIds: m.cost_center_ids === "all" ? [] : m.cost_center_ids,
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const ok = await updateMember(editing.user_id, {
      role: editForm.role,
      cost_center_ids: editForm.role === "member" ? editForm.ccIds : undefined,
    });
    if (ok) {
      toast.success("Membro atualizado");
      setEditing(null);
    }
  }

  async function handleRemove(m: Member) {
    if (m.role === "owner") return;
    if (!confirm(`Remover ${m.full_name || m.email} da organizacao?`)) return;
    const ok = await removeMember(m.user_id);
    if (ok) toast.success("Membro removido");
  }

  async function handleRevokeInvite(id: string) {
    if (!confirm("Revogar este convite?")) return;
    const ok = await revokeInvite(id);
    if (ok) toast.success("Convite revogado");
  }

  function toggleCC(ccId: string, list: string[]): string[] {
    return list.includes(ccId) ? list.filter((x) => x !== ccId) : [...list, ccId];
  }

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-medium text-slate-900">Equipe</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Convide membros e defina a que centros de custo cada um tem acesso.
          </p>
        </div>
        <Button onClick={openInvite}>
          <UserPlus className="size-4 mr-1" />
          Convidar Membro
        </Button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {/* Membros */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-medium text-slate-900">Membros ({members.length})</h2>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Carregando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Nome</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Centros</th>
                <th className="text-right px-4 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{m.full_name || "(sem nome)"}</div>
                    <div className="text-xs text-slate-500">{m.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge size="compact" colorScheme={m.role === "owner" ? "amber" : m.role === "admin" ? "blue" : "slate"}>
                      {m.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {m.cost_center_ids === "all" ? (
                      <span className="text-xs italic text-slate-500">todos</span>
                    ) : (
                      <span className="text-xs">
                        {m.cost_center_ids.length === 0
                          ? <span className="italic text-slate-500">nenhum</span>
                          : m.cost_center_ids
                              .map((id) => orgCCs.find((c) => c.id === id)?.name)
                              .filter(Boolean).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.role !== "owner" && (
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="text-xs text-slate-600 hover:text-slate-900"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(m)}
                          className="text-xs text-slate-600 hover:text-red-600 inline-flex items-center gap-1"
                        >
                          <Trash2 className="size-3" /> Remover
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-medium text-slate-900">Convites Pendentes ({invites.length})</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {invites.map((inv) => (
              <li key={inv.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-lg tracking-widest text-slate-900">{inv.code}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {inv.invited_name || "Sem nome"} - {inv.role} - expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode(inv.code)}
                  className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                  title="Copiar código"
                >
                  <Copy className="size-3" /> Código
                </button>
                <button
                  type="button"
                  onClick={() => copyLink(inv.code)}
                  className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                  title="Copiar link"
                >
                  <Copy className="size-3" /> Link
                </button>
                <button
                  type="button"
                  onClick={() => handleRevokeInvite(inv.id)}
                  className="text-xs text-slate-600 hover:text-red-600"
                  title="Revogar"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Convidar dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          {lastInviteCode ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-700">
                Convite criado! Compartilhe o código abaixo com a pessoa:
              </p>
              <div className="rounded border border-slate-200 bg-slate-50 px-4 py-4 text-center">
                <span className="font-mono text-3xl tracking-[0.3em] text-slate-900">
                  {lastInviteCode}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => copyCode(lastInviteCode)}>
                  <Copy className="size-4 mr-1" /> Código
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => copyLink(lastInviteCode)}>
                  <Copy className="size-4 mr-1" /> Link
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Válido por 7 dias. A pessoa precisa entrar em {window.location.origin}/entrar
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Nome (opcional)</label>
                <Input
                  placeholder="Joao da Silva"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((s) => ({ ...s, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Funcao</label>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      checked={inviteForm.role === "member"}
                      onChange={() => setInviteForm((s) => ({ ...s, role: "member" }))}
                    />
                    <span className="text-sm">Member (acesso limitado)</span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      checked={inviteForm.role === "admin"}
                      onChange={() => setInviteForm((s) => ({ ...s, role: "admin" }))}
                    />
                    <span className="text-sm">Admin (todos os centros)</span>
                  </label>
                </div>
              </div>
              {inviteForm.role === "member" && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">
                    Centros de acesso ({inviteForm.ccIds.length} selecionados)
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {orgCCs.map((cc) => (
                      <label
                        key={cc.id}
                        className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={inviteForm.ccIds.includes(cc.id)}
                          onChange={() => setInviteForm((s) => ({ ...s, ccIds: toggleCC(cc.id, s.ccIds) }))}
                        />
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: cc.color || "#71717a" }}
                        />
                        <span className="text-sm text-slate-700">{cc.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {lastInviteCode ? (
              <Button onClick={() => setInviteOpen(false)}>Fechar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateInvite} disabled={creating}>
                  {creating ? "Criando..." : "Gerar Código"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar membro */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editing?.full_name || editing?.email}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Funcao</label>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      checked={editForm.role === "member"}
                      onChange={() => setEditForm((s) => ({ ...s, role: "member" }))}
                    />
                    <span className="text-sm">Member</span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      checked={editForm.role === "admin"}
                      onChange={() => setEditForm((s) => ({ ...s, role: "admin" }))}
                    />
                    <span className="text-sm">Admin</span>
                  </label>
                </div>
              </div>
              {editForm.role === "member" && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">
                    Centros de acesso
                  </label>
                  <div className="space-y-1.5">
                    {orgCCs.map((cc) => (
                      <label
                        key={cc.id}
                        className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editForm.ccIds.includes(cc.id)}
                          onChange={() => setEditForm((s) => ({ ...s, ccIds: toggleCC(cc.id, s.ccIds) }))}
                        />
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: cc.color || "#71717a" }}
                        />
                        <span className="text-sm text-slate-700">{cc.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
