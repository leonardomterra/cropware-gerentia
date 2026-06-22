import { useMemo, useState } from "react";
import Plus from "~icons/material-symbols-light/add";
import Pencil from "~icons/material-symbols-light/edit-outline";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import EyeOff from "~icons/material-symbols-light/visibility-off-outline";
import Eye from "~icons/material-symbols-light/visibility-outline";
import Search from "~icons/material-symbols-light/search";
import ChevronRight from "~icons/material-symbols-light/keyboard-arrow-right";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { ReceiptDirection } from "@/modules/receipts/types";
import {
  useManageCategories,
  type ManageCategory,
} from "../hooks/useManageCategories";

interface FormState {
  name: string;
  direction: ReceiptDirection;
  group_name: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  direction: "expense",
  group_name: "",
};

/**
 * Gerenciador de Categorias (Configuracoes). Lista presets agrupados +
 * "Minhas Categorias" (custom do user). Acoes:
 * - Presets: ocultar/reativar pela org (so admin). Oculto = esmaecido.
 * - Custom: editar nome/cor + excluir (so as proprias).
 */
export function CategoriesManager({
  direction,
}: {
  direction: ReceiptDirection;
}) {
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
  const [query, setQuery] = useState("");
  // Grupos colapsados por padrao (Set = grupos abertos). Busca abre todos.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const searching = query.trim() !== "";

  function toggleGroup(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Filtra (busca + tipo) e agrupa por group_name. "Minhas Categorias" por ultimo.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = categories.filter((c) => {
      if (c.direction !== direction) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
    const map = new Map<string, ManageCategory[]>();
    for (const c of filtered) {
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
    // Dentro de cada grupo: presets primeiro, personalizadas (custom) por
    // ultimo; cada bloco em ordem alfabetica.
    return entries.map(([name, items]) => ({
      name,
      items: [...items].sort(
        (a, b) =>
          Number(b.is_preset) - Number(a.is_preset) ||
          a.name.localeCompare(b.name, "pt-BR"),
      ),
    }));
  }, [categories, query, direction]);

  // Criar dentro de um grupo: o tipo (despesa/receita) e o group_name vem da
  // propria secao onde o usuario clicou o slot "+ Nova categoria".
  function openNew(groupName: string, direction: ReceiptDirection) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, group_name: groupName, direction });
    setDialogOpen(true);
  }

  function openEdit(cat: ManageCategory) {
    setEditing(cat);
    setForm({
      name: cat.name,
      direction: cat.direction,
      group_name: cat.group_name || "",
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
      ? await update(editing.id, { name: form.name.trim() })
      : await create({
          name: form.name.trim(),
          direction: form.direction,
          group_name: form.group_name,
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
      <header>
        <div className="relative">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoria..."
            className="pl-9"
          />
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <EmptyStateCard title="Nenhuma categoria encontrada" />
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const isOpen = searching || expanded.has(group.name);
            return (
            <section key={group.name}>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  className="group/sec flex items-center gap-2 flex-1 min-w-0 text-left py-1"
                >
                  <span className="size-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 group-hover/sec:bg-slate-100 group-hover/sec:text-slate-700 transition-colors shrink-0">
                    <ChevronRight
                      className={cn(
                        "size-5 transition-transform",
                        isOpen && "rotate-90",
                      )}
                    />
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    {group.name} ({group.items.length})
                  </span>
                </button>
              </div>
              {isOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr gap-2 pb-1">
                {group.items.map((cat) => {
                  const isCustom = !cat.is_preset;
                  const hasActions = isCustom || isAdmin;
                  return (
                    <div
                      key={cat.id}
                      className={cn(
                        "group flex items-center gap-2.5 h-full rounded-lg border px-3 py-2 transition-colors",
                        "bg-white border-slate-200 hover:bg-slate-50",
                        cat.hidden && "opacity-50",
                      )}
                    >
                      <span className="text-sm text-slate-700 truncate flex-1">
                        {cat.name}
                      </span>
                      {hasActions && (
                        <div
                          className={cn(
                            "flex items-center gap-1.5 shrink-0 transition-opacity",
                            // Custom: botoes sempre visiveis porem esmaecidos
                            // (mais claros) ate o hover. Presets: acoes so no
                            // hover (desktop).
                            isCustom
                              ? "opacity-40 group-hover:opacity-100"
                              : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                          )}
                        >
                          {isCustom ? (
                            <>
                              <ActionIconButton
                                icon={Pencil}
                                label="Editar"
                                onClick={() => openEdit(cat)}
                              />
                              <ActionIconButton
                                icon={Trash2}
                                label="Excluir"
                                tone="danger"
                                onClick={() => setPendingDelete(cat)}
                              />
                            </>
                          ) : (
                            <ActionIconButton
                              icon={cat.hidden ? Eye : EyeOff}
                              label={cat.hidden ? "Reativar" : "Ocultar"}
                              onClick={() => handleToggleHidden(cat)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => openNew(group.name, direction)}
                  className="flex items-center justify-start gap-1.5 h-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="size-4" />
                  Nova Categoria
                </button>
              </div>
              )}
            </section>
            );
          })}
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

            {/* Tipo e grupo vem da secao onde foi criada (nao editavel aqui). */}
            {!editing && form.group_name && (
              <p className="text-xs text-slate-500">
                {form.direction === "income" ? "Receita" : "Despesa"} em{" "}
                <span className="text-slate-700">{form.group_name}</span>
              </p>
            )}
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
