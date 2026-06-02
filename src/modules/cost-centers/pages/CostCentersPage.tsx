import { useState } from "react";
import Plus from "~icons/material-symbols-light/add";
import Star from "~icons/material-symbols-light/star-outline";
import Archive from "~icons/material-symbols-light/archive-outline";
import Pencil from "~icons/material-symbols-light/edit-outline";
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
import { useCostCenters } from "../hooks/useCostCenters";
import { CC_COLORS, MAX_COST_CENTERS, type CostCenter } from "../types";

interface FormState {
  name: string;
  color: string;
}

export default function CostCentersPage() {
  const { costCenters, loading, error, create, update, archive } = useCostCenters();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", color: CC_COLORS[0] });
  const [saving, setSaving] = useState(false);

  const activeCount = costCenters.length;
  const canCreate = activeCount < MAX_COST_CENTERS;

  function openNew() {
    setEditing(null);
    setForm({ name: "", color: CC_COLORS[0] });
    setDialogOpen(true);
  }

  function openEdit(cc: CostCenter) {
    setEditing(cc);
    setForm({ name: cc.name, color: cc.color || CC_COLORS[0] });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Nome obrigatorio");
      return;
    }
    setSaving(true);
    let ok = false;
    if (editing) {
      ok = await update(editing.id, { name: form.name.trim(), color: form.color });
    } else {
      const created = await create({ name: form.name.trim(), color: form.color });
      ok = !!created;
    }
    setSaving(false);
    if (ok) {
      toast.success(editing ? "Centro atualizado" : "Centro criado");
      setDialogOpen(false);
    }
  }

  async function handleSetDefault(cc: CostCenter) {
    const ok = await update(cc.id, { is_default: true });
    if (ok) toast.success(`${cc.name} agora e o centro padrao`);
  }

  async function handleArchive(cc: CostCenter) {
    if (cc.is_default) {
      toast.error("Não dá pra arquivar o centro padrão. Marque outro como padrão primeiro.");
      return;
    }
    if (!confirm(`Arquivar "${cc.name}"? Lançamentos existentes continuam lá, mas você não poderá mais criar novos nele.`)) return;
    const ok = await archive(cc.id);
    if (ok) toast.success("Centro arquivado");
  }

  return (
    <div className="max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-medium text-slate-900">Centros de Custo</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Separe seus lancamentos por frente (Pessoal, Fazenda, Escritorio...).
            Limite atual: {activeCount}/{MAX_COST_CENTERS}.
          </p>
        </div>
        <Button onClick={openNew} disabled={!canCreate}>
          <Plus className="size-4 mr-1" />
          Novo centro
        </Button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : costCenters.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum centro de custo ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {costCenters.map((cc) => (
            <div
              key={cc.id}
              className="bg-white rounded-lg border border-slate-200 p-4 flex items-start gap-3"
            >
              <div
                className="w-2 self-stretch rounded-sm shrink-0"
                style={{ backgroundColor: cc.color || "#71717a" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900 truncate">{cc.name}</h3>
                  {cc.is_default && (
                    <Badge size="compact" colorScheme="amber">padrao</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">slug: {cc.slug}</p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => openEdit(cc)}
                    className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                  >
                    <Pencil className="size-3" /> Editar
                  </button>
                  {!cc.is_default && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSetDefault(cc)}
                        className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                      >
                        <Star className="size-3" /> Marcar como padrao
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(cc)}
                        className="text-xs text-slate-600 hover:text-red-600 inline-flex items-center gap-1 ml-auto"
                      >
                        <Archive className="size-3" /> Arquivar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar centro" : "Novo centro de custo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome
              </label>
              <Input
                placeholder="Pessoal, Fazenda, Escritorio..."
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
                {CC_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, color: c }))}
                    className={`size-8 rounded-full border-2 transition-all ${
                      form.color === c ? "border-slate-900 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar centro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
