import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, EyeOff, Eye } from "lucide-react";
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
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/AuthContext";
import { CC_COLORS } from "@/modules/cost-centers/types";
import type { ReceiptDirection } from "@/modules/receipts/types";
import {
  useManageCategories,
  type ManageCategory,
} from "../hooks/useManageCategories";

interface FormState {
  name: string;
  color: string;
  direction: ReceiptDirection;
}

const EMPTY_FORM: FormState = {
  name: "",
  color: CC_COLORS[0],
  direction: "expense",
};

/**
 * Gerenciador de Categorias (Configuracoes). Lista presets agrupados +
 * "Minhas Categorias" (custom do user). Acoes:
 * - Presets: ocultar/reativar pela org (so admin). Oculto = esmaecido.
 * - Custom: editar nome/cor + excluir (so as proprias).
 */
export function CategoriesManager() {
  const { isAdmin } = useAuth();
  const { categories, loading, error, create, update, remove, setHidden } =
    useManageCategories();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManageCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ManageCategory | null>(
    null,
  );

  // Agrupa por group_name. "Minhas Categorias" sempre por ultimo.
  const groups = useMemo(() => {
    const map = new Map<string, ManageCategory[]>();
    for (const c of categories) {
      const g = c.group_name || "Outras";
      const arr = map.get(g) ?? [];
      arr.push(c);
      map.set(g, arr);
    }
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      if (a === "Minhas Categorias") return 1;
      if (b === "Minhas Categorias") return -1;
      return a.localeCompare(b, "pt-BR");
    });
    return entries.map(([name, items]) => ({ name, items }));
  }, [categories]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(cat: ManageCategory) {
    setEditing(cat);
    setForm({
      name: cat.name,
      color: cat.color || CC_COLORS[0],
      direction: cat.direction,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Dê um nome para a categoria.");
      return;
    }
    setSaving(true);
    const ok = editing
      ? await update(editing.id, { name: form.name.trim(), color: form.color })
      : await create({
          name: form.name.trim(),
          color: form.color,
          direction: form.direction,
        });
    setSaving(false);
    if (ok) {
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      setDialogOpen(false);
    }
  }

  async function handleToggleHidden(cat: ManageCategory) {
    const ok = await setHidden(cat.id, !cat.hidden);
    if (ok)
      toast.success(cat.hidden ? "Categoria reativada" : "Categoria ocultada");
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const ok = await remove(pendingDelete.id);
    setPendingDelete(null);
    if (ok) toast.success("Categoria excluída");
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500 max-w-xl">
          Categorias usadas pra classificar lançamentos. Os presets cobrem os
          casos comuns; você pode criar as suas
          {isAdmin ? " e ocultar os presets que a equipe não usa" : ""}.
        </p>
        <Button variant="outline" onClick={openNew} className="gap-1 shrink-0">
          <Plus className="size-4" />
          Nova Categoria
        </Button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.name}>
              <h3 className="text-xs font-medium text-slate-500 mb-2">
                {group.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {group.items.map((cat) => {
                  const isCustom = !cat.is_preset;
                  return (
                    <div
                      key={cat.id}
                      className={cn(
                        "bg-white rounded-lg border border-slate-200 px-3 py-2.5",
                        cat.hidden && "opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || "#64748b" }}
                        />
                        <span className="text-sm text-slate-700 truncate flex-1">
                          {cat.name}
                        </span>
                        <Badge
                          size="compact"
                          colorScheme={
                            cat.direction === "income" ? "emerald" : "slate"
                          }
                        >
                          {cat.direction === "income" ? "receita" : "despesa"}
                        </Badge>
                      </div>

                      {/* Acoes: custom -> editar/excluir; preset -> ocultar (admin) */}
                      <div className="flex items-center gap-3 mt-2 pl-5">
                        {isCustom ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(cat)}
                              className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                            >
                              <Pencil className="size-3" /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(cat)}
                              className="text-xs text-slate-600 hover:text-red-600 inline-flex items-center gap-1"
                            >
                              <Trash2 className="size-3" /> Excluir
                            </button>
                          </>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleToggleHidden(cat)}
                            className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                          >
                            {cat.hidden ? (
                              <>
                                <Eye className="size-3" /> Reativar
                              </>
                            ) : (
                              <>
                                <EyeOff className="size-3" /> Ocultar
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">preset</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Dialog criar/editar custom */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Nome
              </label>
              <Input
                placeholder="Ex: Manutenção do Trator"
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
                maxLength={40}
              />
            </div>

            {/* Tipo: so na criacao (mudar depois bagunçaria lancamentos) */}
            {!editing && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Tipo
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((s) => ({ ...s, direction: "expense" }))
                    }
                    className={cn(
                      "flex-1 h-9 rounded border text-sm transition-colors",
                      form.direction === "expense"
                        ? "border-slate-700 bg-slate-50 text-slate-900 font-medium"
                        : "border-slate-200 text-slate-500 hover:border-slate-300",
                    )}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((s) => ({ ...s, direction: "income" }))
                    }
                    className={cn(
                      "flex-1 h-9 rounded border text-sm transition-colors",
                      form.direction === "income"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                        : "border-slate-200 text-slate-500 hover:border-slate-300",
                    )}
                  >
                    Receita
                  </button>
                </div>
              </div>
            )}

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
                    className={cn(
                      "size-8 rounded-full border-2 transition-all",
                      form.color === c
                        ? "border-slate-900 scale-110"
                        : "border-transparent",
                    )}
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
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmacao de exclusao */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Categoria?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            A categoria <strong>{pendingDelete?.name}</strong> será removida.
            Lançamentos antigos que a usavam continuam intactos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
