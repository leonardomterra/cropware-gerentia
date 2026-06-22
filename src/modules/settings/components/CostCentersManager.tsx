import { useState } from "react";
import Plus from "~icons/material-symbols-light/add";
import Star from "~icons/material-symbols-light/star-outline";
import StarFilled from "~icons/material-symbols-light/star";
import Archive from "~icons/material-symbols-light/archive-outline";
import Pencil from "~icons/material-symbols-light/edit-outline";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCostCenters } from "@/modules/cost-centers/hooks/useCostCenters";
import {
  CC_COLORS,
  MAX_COST_CENTERS,
  type CostCenter,
} from "@/modules/cost-centers/types";
import { CC_ICONS, CostCenterChip, ccTextColor } from "@/modules/cost-centers/ccIcons";

interface FormState {
  name: string;
  color: string;
  icon: string;
}

/**
 * Gerenciador de Centros de Custo. Extraido da antiga CostCentersPage
 * pra virar uma sub-tab dentro de ConfiguracoesPage. Sem wrapper de
 * pagina (header/max-w) - quem renderiza decide o container.
 */
export function CostCentersManager() {
  const { costCenters, loading, error, create, update, archive } =
    useCostCenters();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", color: CC_COLORS[0], icon: CC_ICONS[0].slug });
  const [saving, setSaving] = useState(false);
  const [pendingDefault, setPendingDefault] = useState<CostCenter | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<CostCenter | null>(null);
  const [archiving, setArchiving] = useState(false);

  // CC padrão sempre primeiro na lista (resto preserva a ordem do hook).
  const ordered = [...costCenters].sort(
    (a, b) => Number(b.is_default) - Number(a.is_default),
  );

  // Componente do icone atualmente selecionado no form (pra mostrar dentro
  // da cor ativa no seletor de cor).
  const SelectedIcon =
    CC_ICONS.find((i) => i.slug === form.icon)?.Icon ?? CC_ICONS[0].Icon;

  const activeCount = costCenters.length;
  const canCreate = activeCount < MAX_COST_CENTERS;

  function openNew() {
    setEditing(null);
    setForm({ name: "", color: CC_COLORS[0], icon: CC_ICONS[0].slug });
    setDialogOpen(true);
  }

  function openEdit(cc: CostCenter) {
    setEditing(cc);
    setForm({ name: cc.name, color: cc.color || CC_COLORS[0], icon: cc.icon || CC_ICONS[0].slug });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    setSaving(true);
    let ok = false;
    if (editing) {
      ok = await update(editing.id, { name: form.name.trim(), color: form.color, icon: form.icon });
    } else {
      const created = await create({ name: form.name.trim(), color: form.color, icon: form.icon });
      ok = !!created;
    }
    setSaving(false);
    if (ok) {
      toast.success(editing ? "Centro atualizado" : "Centro criado");
      setDialogOpen(false);
    }
  }

  async function confirmSetDefault() {
    if (!pendingDefault) return;
    setSettingDefault(true);
    const ok = await update(pendingDefault.id, { is_default: true });
    setSettingDefault(false);
    if (ok) toast.success(`${pendingDefault.name} agora é o centro padrão`);
    setPendingDefault(null);
  }

  function handleArchive(cc: CostCenter) {
    if (cc.is_default) {
      toast.error(
        "Não dá pra arquivar o centro padrão. Marque outro como padrão primeiro.",
      );
      return;
    }
    setPendingArchive(cc);
  }

  async function confirmArchive() {
    if (!pendingArchive) return;
    setArchiving(true);
    try {
      const ok = await archive(pendingArchive.id);
      if (ok) toast.success("Centro arquivado");
      setPendingArchive(null);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={openNew}
          disabled={!canCreate}
          className="gap-1 shrink-0"
        >
          <Plus className="size-4" />
          <span className="sm:hidden">Novo Centro</span>
          <span className="hidden sm:inline">Novo Centro de Custo</span>
        </Button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : costCenters.length === 0 ? (
        <EmptyStateCard title="Nenhum centro de custo ainda" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ordered.map((cc) => (
            <div
              key={cc.id}
              className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <CostCenterChip
                  icon={cc.icon}
                  color={cc.color}
                  className="size-8"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 truncate">
                    {cc.name}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 border-t border-slate-100 -mx-4 px-4 pt-3">
                  {/* Estrela primeiro: indicador (padrao, inerte) ou acao (tornar padrao) */}
                  {cc.is_default ? (
                    <span
                      title="Centro padrão"
                      aria-label="Centro padrão"
                      className="size-9 inline-flex items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-500"
                    >
                      <StarFilled className="size-5" />
                    </span>
                  ) : (
                    <ActionIconButton
                      icon={Star}
                      label="Tornar padrão"
                      onClick={() => setPendingDefault(cc)}
                    />
                  )}
                  <ActionIconButton
                    icon={Pencil}
                    label="Editar"
                    onClick={() => openEdit(cc)}
                  />
                  {!cc.is_default && (
                    <ActionIconButton
                      icon={Archive}
                      label="Arquivar"
                      tone="danger"
                      onClick={() => handleArchive(cc)}
                    />
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Centro de Custo" : "Novo Centro de Custo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome
              </label>
              <Input
                placeholder="Pessoal, Fazenda, Escritório..."
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                maxLength={60}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Cor
              </label>
              <div className="flex gap-2 flex-wrap">
                {CC_COLORS.map((c) => {
                  const selected = form.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, color: c }))}
                      aria-label={`Cor ${c}`}
                      className={`size-9 rounded-md border flex items-center justify-center transition-colors ${
                        selected ? "border-transparent" : "border-slate-200"
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {selected && (
                        <SelectedIcon
                          className="size-5"
                          style={{ color: ccTextColor(c) }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Ícone
              </label>
              <div className="flex gap-2 flex-wrap">
                {CC_ICONS.map(({ slug, label, Icon }) => {
                  const selected = form.icon === slug;
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, icon: slug }))}
                      title={label}
                      aria-label={label}
                      className={`size-9 rounded-md border flex items-center justify-center transition-colors ${
                        selected
                          ? "border-transparent"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                      style={selected ? { backgroundColor: form.color } : undefined}
                    >
                      <Icon
                        className="size-5"
                        style={{ color: selected ? ccTextColor(form.color) : "#71717a" }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar Centro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={pendingDefault !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDefault(null);
        }}
        title="Tornar Padrão"
        description={
          pendingDefault
            ? `Tornar "${pendingDefault.name}" o centro de custo padrão? Ele passa a ser o pré-selecionado em novos lançamentos.`
            : ""
        }
        confirmLabel="Tornar Padrão"
        cancelLabel="Cancelar"
        loading={settingDefault}
        loadingLabel="Salvando..."
        onConfirm={confirmSetDefault}
      />

      <ConfirmActionDialog
        open={pendingArchive !== null}
        onOpenChange={(o) => {
          if (!o) setPendingArchive(null);
        }}
        title="Arquivar Centro de Custo"
        description={
          pendingArchive
            ? `Arquivar "${pendingArchive.name}"? Lançamentos existentes continuam lá, mas você não poderá mais criar novos nele.`
            : ""
        }
        confirmLabel="Arquivar"
        cancelLabel="Cancelar"
        loading={archiving}
        loadingLabel="Arquivando..."
        onConfirm={confirmArchive}
      />
    </div>
  );
}
