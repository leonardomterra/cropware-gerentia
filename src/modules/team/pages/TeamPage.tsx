import { useState } from "react";
import Copy from "~icons/ph/copy";
import UserPlus from "~icons/ph/user-plus";
import X from "~icons/ph/x";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA, ICONE_BOTAO_BARRA } from "@/lib/ui-tokens";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "../hooks/useTeam";
import type { TeamRole } from "../types";

/**
 * Equipe da organização — visão do gestor.
 *
 * O gestor CONVIDA (decisão 2 de docs/ORGANIZACOES-E-PERFIS.md §3). Trocar o
 * perfil de alguém e desligar um acesso são poderes do Master, no painel de
 * Organizações: as duas ações mexem em quem enxerga o financeiro da empresa e
 * a segunda joga a pessoa numa conta nova.
 */

/**
 * Cada opção diz o que a pessoa PASSA A VER, não o nome técnico do papel — é
 * aqui que o gestor entende o que está concedendo. Ver §2 do documento.
 */
const ROLE_OPTIONS: { value: TeamRole; label: string; hint: string }[] = [
  {
    value: "member",
    label: "Usuário",
    hint: "Lança e edita apenas o que ele mesmo cadastra. Não vê o que os outros lançam.",
  },
  {
    value: "admin",
    label: "Gestor",
    hint: "Vê os lançamentos de toda a equipe e convida gente. Edita apenas os próprios.",
  },
  {
    value: "viewer",
    label: "Convidado",
    hint: "Só consulta: vê tudo da organização e não cadastra nem altera nada. Para diretoria, contador ou auditoria.",
  },
];

/** O que este perfil enxerga — coluna da tabela de pessoas. */
function seesLabel(role: string): string {
  return role === "member" ? "Só os próprios lançamentos" : "Toda a organização";
}

function roleLabel(role: string): string {
  if (role === "owner") return "Gestor (titular)";
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

function roleColor(role: string): "amber" | "blue" | "slate" | "purple" {
  if (role === "owner") return "amber";
  if (role === "admin") return "blue";
  if (role === "viewer") return "purple";
  return "slate";
}

function RolePicker({
  value,
  onChange,
}: {
  value: TeamRole;
  onChange: (r: TeamRole) => void;
}) {
  return (
    <div className="space-y-2">
      {ROLE_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`flex gap-3 px-3 py-2.5 rounded border cursor-pointer transition-colors ${
            value === opt.value
              ? "border-slate-900 bg-slate-50"
              : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <input
            type="radio"
            className="mt-1"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900">{opt.label}</span>
            <span className="block text-xs text-slate-500 mt-0.5">{opt.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const { members, invites, loading, error, createInvite, revokeInvite } =
    useTeam();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; role: TeamRole }>({
    name: "",
    role: "member",
  });
  const [creating, setCreating] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState<string | null>(null);

  // Assentos: quem já está dentro + convites em aberto (o convite reserva a
  // vaga; senão dá pra gerar 10 códigos com limite de 3 e estourar depois).
  const seatsLimit = user?.seatsLimit ?? 1;
  const seatsUsed = members.length + invites.length;
  const seatsFull = seatsUsed >= seatsLimit;

  function openInvite() {
    setInviteForm({ name: "", role: "member" });
    setLastInviteCode(null);
    setInviteOpen(true);
  }

  async function handleCreateInvite() {
    setCreating(true);
    const invite = await createInvite({
      invited_name: inviteForm.name.trim() || undefined,
      role: inviteForm.role,
      cost_center_ids: [],
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

  async function handleRevokeInvite(id: string) {
    if (!confirm("Revogar este convite?")) return;
    const ok = await revokeInvite(id);
    if (ok) toast.success("Convite revogado");
  }

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Cada pessoa lança e edita o que é dela. Gestor e convidado enxergam o
            consolidado da organização.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {seatsUsed} de {seatsLimit} {seatsLimit === 1 ? "acesso" : "acessos"} em
            uso — para trocar o perfil de alguém ou desligar um acesso, fale com o
            suporte
          </p>
        </div>
        <Button onClick={openInvite} disabled={seatsFull}>
          <UserPlus className="size-4 mr-1" />
          Convidar
        </Button>
      </header>

      {seatsFull && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3">
          Todos os acessos do seu plano estão em uso. Para incluir mais gente na
          organização, fale com a gente pelo suporte.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {/* Pessoas */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-medium text-slate-900">
            Pessoas ({members.length})
          </h2>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Carregando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Nome</th>
                <th className="text-left px-4 py-2 font-medium">Perfil</th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">
                  Enxerga
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {m.full_name || "(sem nome)"}
                    </div>
                    <div className="text-xs text-slate-500">{m.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge size="compact" colorScheme={roleColor(m.role)}>
                      {roleLabel(m.role)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">
                    {seesLabel(m.role)}
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
            <h2 className="text-sm font-medium text-slate-900">
              Convites Pendentes ({invites.length})
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {invites.map((inv) => (
              <li key={inv.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-lg tracking-widest text-slate-900">
                    {inv.code}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {inv.invited_name || "Sem nome"} — {roleLabel(inv.role)} — expira
                    em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
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

      {/* Convidar */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar para a organização</DialogTitle>
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
                <Button
                  className={cn(BOTAO_BARRA, "flex-1 rounded-md")}
                  onClick={() => copyCode(lastInviteCode)}
                >
                  <Copy className={ICONE_BOTAO_BARRA} /> Código
                </Button>
                <Button
                  className={cn(BOTAO_BARRA, "flex-1 rounded-md")}
                  onClick={() => copyLink(lastInviteCode)}
                >
                  <Copy className={ICONE_BOTAO_BARRA} /> Link
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Válido por 7 dias. A pessoa precisa entrar em{" "}
                {window.location.origin}/entrar
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Nome
                </label>
                <Input
                  placeholder="João da Silva"
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Perfil de acesso
                </label>
                <RolePicker
                  value={inviteForm.role}
                  onChange={(role) => setInviteForm((s) => ({ ...s, role }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {lastInviteCode ? (
              <Button onClick={() => setInviteOpen(false)}>Fechar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateInvite} disabled={creating}>
                  {creating ? "Criando..." : "Gerar Código"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
