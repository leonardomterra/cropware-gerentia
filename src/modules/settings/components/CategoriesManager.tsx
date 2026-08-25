import { useEffect, useMemo, useState } from "react";
import Plus from "~icons/ph/plus";
import Pencil from "~icons/ph/pencil-simple";
import Trash2 from "~icons/ph/trash";
import EyeOff from "~icons/ph/eye-slash";
import Eye from "~icons/ph/eye";
import Search from "~icons/ph/magnifying-glass";
import ChevronRight from "~icons/ph/caret-right";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import { cn } from "@/components/ui/utils";
import { Obrigatorio } from "@/components/ui/Obrigatorio";
import { Ajuda } from "@/components/ui/Ajuda";
import type { ReceiptDirection } from "@/modules/receipts/types";
import {
  FALLBACK_GROUP,
  type ResolvedGroup,
} from "@/modules/receipts/categoryGroups";
import {
  useManageCategories,
  type ManageCategory,
} from "../hooks/useManageCategories";

interface CategoryForm {
  name: string;
  code: string;
  direction: ReceiptDirection;
  /** chave (group_key) da secao onde a categoria foi criada. */
  groupKey: string;
  /** rotulo da secao, so pra exibir no dialog. */
  groupLabel: string;
}

interface GroupForm {
  name: string;
  code: string;
}

const EMPTY_CATEGORY: CategoryForm = {
  name: "",
  code: "",
  direction: "expense",
  groupKey: "",
  groupLabel: "",
};

const EMPTY_GROUP: GroupForm = { name: "", code: "" };

/** Nome + codigo contabil opcional, em coluna. Usado nos dois dialogs. */
function NameAndCodeFields({
  value,
  onChange,
  namePlaceholder,
  codePlaceholder,
  maxLength,
}: {
  value: { name: string; code: string };
  onChange: (patch: { name?: string; code?: string }) => void;
  namePlaceholder: string;
  codePlaceholder: string;
  maxLength: number;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">
          Nome
          <Obrigatorio />
        </label>
        <Input
          placeholder={namePlaceholder}
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={maxLength}
        />
      </div>
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1">
          Código
          <Ajuda>
            Do plano de contas, se você usa um. Aparece junto do nome da
            categoria.
          </Ajuda>
        </label>
        <Input
          placeholder={codePlaceholder}
          value={value.code}
          onChange={(e) => onChange({ code: e.target.value })}
          maxLength={20}
        />
      </div>
    </div>
  );
}

/**
 * Gerenciador de Categorias (Configuracoes). Lista as categorias agrupadas e
 * deixa a org montar a propria estrutura. Acoes (so owner/admin):
 * - GRUPO: renomear, desativar/reativar, e excluir quando foi a org que criou
 *   (grupo preset nao se exclui - o preset e' global, so se desativa).
 * - CATEGORIA da org: editar, excluir.
 * - CATEGORIA preset: desativar/reativar pela org.
 * Desativado = esmaecido aqui, e fora do seletor de lancamento.
 */
export function CategoriesManager({
  direction,
  aoAbrirFormulario,
}: {
  direction: ReceiptDirection;
  /** Ver CardsManager: evita dois "Voltar" empilhados no hub. */
  aoAbrirFormulario?: (aberto: boolean) => void;
}) {
  const {
    categories,
    groups,
    loading,
    error,
    canManage,
    create,
    update,
    remove,
    setHidden,
    createGroup,
    saveGroup,
    setGroupHidden,
    removeGroup,
    compareGroups,
  } = useManageCategories();

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ManageCategory | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(EMPTY_CATEGORY);
  const [pendingDeleteCat, setPendingDeleteCat] =
    useState<ManageCategory | null>(null);

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  // Avisa o hub que um formulário assumiu a tela — senão aparecem dois
  // "Voltar" empilhados, o do hub e o do PaginaDeFormulario.
  useEffect(() => {
    aoAbrirFormulario?.(catDialogOpen || groupDialogOpen);
  }, [catDialogOpen, groupDialogOpen, aoAbrirFormulario]);
  const [editingGroup, setEditingGroup] = useState<ResolvedGroup | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(EMPTY_GROUP);
  const [pendingDeleteGroup, setPendingDeleteGroup] =
    useState<ResolvedGroup | null>(null);

  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  // Grupos colapsados por padrao (Set = grupos abertos). Busca abre todos.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const searching = query.trim() !== "";

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /**
   * Secoes desta aba. Um grupo entra se tem categoria da direction atual ou
   * se esta VAZIO e foi criado nesta aba (senao um grupo novo sumiria ate
   * ganhar a primeira categoria). Busca filtra os itens e some com a secao
   * que ficou sem nenhum.
   */
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byKey = new Map<string, ManageCategory[]>();
    for (const c of categories) {
      if (c.direction !== direction) continue;
      const key = c.group_name || FALLBACK_GROUP;
      const arr = byKey.get(key) ?? [];
      arr.push(c);
      byKey.set(key, arr);
    }

    const out: {
      group: ResolvedGroup;
      items: ManageCategory[];
      total: number;
    }[] = [];
    for (const group of groups.values()) {
      const all = byKey.get(group.key) ?? [];
      if (all.length === 0 && group.direction !== direction) continue;
      const items = q
        ? all.filter((c) => c.name.toLowerCase().includes(q))
        : all;
      if (q && items.length === 0) continue;
      out.push({
        group,
        total: all.length,
        // Presets primeiro, depois as da org; cada bloco em ordem alfabetica.
        items: [...items].sort(
          (a, b) =>
            Number(b.is_preset) - Number(a.is_preset) ||
            a.name.localeCompare(b.name, "pt-BR"),
        ),
      });
    }
    out.sort((a, b) => compareGroups(a.group, b.group));
    return out;
  }, [categories, groups, query, direction, compareGroups]);

  // ------------------------------------------------------------- categorias

  function openNewCategory(group: ResolvedGroup) {
    setEditingCat(null);
    setCatForm({
      ...EMPTY_CATEGORY,
      direction,
      groupKey: group.key,
      groupLabel: group.name,
    });
    setCatDialogOpen(true);
  }

  function openEditCategory(cat: ManageCategory) {
    setEditingCat(cat);
    setCatForm({
      name: cat.name,
      code: cat.code ?? "",
      direction: cat.direction,
      groupKey: cat.group_name || FALLBACK_GROUP,
      groupLabel: groups.get(cat.group_name || FALLBACK_GROUP)?.name ?? "",
    });
    setCatDialogOpen(true);
  }

  async function submitCategory() {
    if (!catForm.name.trim()) {
      toast.error("Dê um nome para a categoria.");
      return;
    }
    setSaving(true);
    const ok = editingCat
      ? await update(editingCat.id, {
          name: catForm.name.trim(),
          code: catForm.code,
        })
      : await create({
          name: catForm.name.trim(),
          code: catForm.code,
          direction: catForm.direction,
          group_name: catForm.groupKey,
        });
    setSaving(false);
    if (ok) {
      toast.success(editingCat ? "Categoria atualizada" : "Categoria criada");
      setCatDialogOpen(false);
    }
  }

  async function toggleCategoryHidden(cat: ManageCategory) {
    const ok = await setHidden(cat.id, !cat.hidden);
    if (ok)
      toast.success(
        cat.hidden ? "Categoria reativada" : "Categoria desativada",
      );
  }

  async function confirmDeleteCategory() {
    if (!pendingDeleteCat) return;
    const ok = await remove(pendingDeleteCat.id);
    setPendingDeleteCat(null);
    if (ok) toast.success("Categoria excluída");
  }

  // ----------------------------------------------------------------- grupos

  function openNewGroup() {
    setEditingGroup(null);
    setGroupForm(EMPTY_GROUP);
    setGroupDialogOpen(true);
  }

  function openEditGroup(group: ResolvedGroup) {
    setEditingGroup(group);
    setGroupForm({ name: group.name, code: group.code ?? "" });
    setGroupDialogOpen(true);
  }

  async function submitGroup() {
    if (!groupForm.name.trim()) {
      toast.error("Dê um nome para o grupo.");
      return;
    }
    setSaving(true);
    const ok = editingGroup
      ? await saveGroup(editingGroup, {
          name: groupForm.name.trim(),
          code: groupForm.code,
        })
      : await createGroup(groupForm.name.trim(), direction, groupForm.code);
    setSaving(false);
    if (ok) {
      toast.success(editingGroup ? "Grupo atualizado" : "Grupo criado");
      setGroupDialogOpen(false);
    } else {
      // saveGroup/createGroup ja escreveram o motivo (nome repetido, RLS...).
      toast.error(error ?? "Não foi possível salvar o grupo.");
    }
  }

  async function toggleGroupHidden(group: ResolvedGroup) {
    const ok = await setGroupHidden(group, !group.hidden);
    if (ok)
      toast.success(
        group.hidden
          ? `Grupo ${group.name} reativado`
          : `Grupo ${group.name} desativado`,
      );
  }

  async function confirmDeleteGroup() {
    if (!pendingDeleteGroup) return;
    setSaving(true);
    const ok = await removeGroup(pendingDeleteGroup);
    setSaving(false);
    setPendingDeleteGroup(null);
    if (ok) toast.success("Grupo excluído");
  }

  /** Quantas categorias somem junto com o grupo (as duas direcoes). */
  const deleteGroupCount = pendingDeleteGroup
    ? categories.filter(
        (c) => (c.group_name || FALLBACK_GROUP) === pendingDeleteGroup.key,
      ).length
    : 0;

  // Criar/editar SUBSTITUI a lista, dentro da aba — as abas de Configurações
  // continuam à vista. Ver docs/PADRAO-DE-PAGINA.md §6.
  if (catDialogOpen) {
    return (
      <PaginaDeFormulario
        formId="form-categoria"
        rotuloSalvar={editingCat ? "Salvar" : "Criar Categoria"}
        descricao={
          editingCat ? `Editando ${editingCat.name}` : "Nova categoria"
        }
        aoVoltar={() => setCatDialogOpen(false)}
        salvando={saving}
      >
        <form
          id="form-categoria"
          onSubmit={(e) => {
            e.preventDefault();
            void submitCategory();
          }}
          className="space-y-4"
        >
          <NameAndCodeFields
            value={catForm}
            onChange={(patch) => setCatForm((s) => ({ ...s, ...patch }))}
            namePlaceholder="Ex: Manutenção do Trator"
            codePlaceholder="Ex: 1002"
            maxLength={60}
          />
          {/* Tipo e grupo vêm da seção onde foi criada (não editável aqui). */}
          {!editingCat && catForm.groupLabel && (
            <p className="text-sm text-slate-500">
              {catForm.direction === "income" ? "Receita" : "Despesa"} em{" "}
              <span className="text-slate-700">{catForm.groupLabel}</span>
            </p>
          )}
        </form>
      </PaginaDeFormulario>
    );
  }

  if (groupDialogOpen) {
    return (
      <PaginaDeFormulario
        formId="form-grupo"
        rotuloSalvar={editingGroup ? "Salvar" : "Criar Grupo"}
        descricao={
          editingGroup ? `Editando ${editingGroup.name}` : "Novo grupo"
        }
        aoVoltar={() => setGroupDialogOpen(false)}
        salvando={saving}
      >
        <form
          id="form-grupo"
          onSubmit={(e) => {
            e.preventDefault();
            void submitGroup();
          }}
          className="space-y-4"
        >
          <NameAndCodeFields
            value={groupForm}
            onChange={(patch) => setGroupForm((s) => ({ ...s, ...patch }))}
            namePlaceholder="Ex: Escritório Fazenda"
            codePlaceholder="Ex: 3.11.01.03"
            maxLength={40}
          />
          {editingGroup && !editingGroup.isCustom && (
            <p className="text-sm text-slate-500">
              Grupo padrão do gerentia. O novo nome vale só para esta conta.
            </p>
          )}
          {!editingGroup && (
            <p className="text-sm text-slate-500">
              Grupo de{" "}
              <span className="text-slate-700">
                {direction === "income" ? "receita" : "despesa"}
              </span>
              . Depois é só criar as categorias dentro dele.
            </p>
          )}
        </form>
      </PaginaDeFormulario>
    );
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
      ) : sections.length === 0 ? (
        <EmptyStateCard
          title={
            searching
              ? "Nenhuma categoria encontrada"
              : "Nenhum grupo por aqui ainda"
          }
        />
      ) : (
        <div className="space-y-2">
          {sections.map(({ group, items, total }) => {
            const isOpen = searching || expanded.has(group.key);
            return (
              <section key={group.key}>
                <div className="group/hdr flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      "group/sec flex items-center gap-2 flex-1 min-w-0 text-left py-1",
                      group.hidden && "opacity-50",
                    )}
                  >
                    <span className="size-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 group-hover/sec:bg-slate-100 group-hover/sec:text-slate-700 transition-colors shrink-0">
                      <ChevronRight
                        className={cn(
                          "size-5 transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                    </span>
                    {group.code && (
                      <span className="text-xs text-slate-400 tabular-nums shrink-0">
                        {group.code}
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-500 truncate">
                      {group.name} ({total})
                    </span>
                  </button>
                  {canManage && (
                    <div
                      className={cn(
                        "flex items-center gap-1.5 shrink-0 transition-opacity",
                        // Mesmo padrao dos cards: no desktop as acoes so
                        // aparecem no hover; no mobile (sem hover) ficam fixas.
                        "opacity-100 md:opacity-0 md:group-hover/hdr:opacity-100",
                      )}
                    >
                      <ActionIconButton
                        icon={Pencil}
                        label="Renomear grupo"
                        onClick={() => openEditGroup(group)}
                      />
                      <ActionIconButton
                        icon={group.hidden ? Eye : EyeOff}
                        label={
                          group.hidden ? "Reativar grupo" : "Desativar grupo"
                        }
                        onClick={() => void toggleGroupHidden(group)}
                      />
                      {group.isCustom && (
                        <ActionIconButton
                          icon={Trash2}
                          label="Excluir grupo"
                          tone="danger"
                          onClick={() => setPendingDeleteGroup(group)}
                        />
                      )}
                    </div>
                  )}
                </div>
                {isOpen && (
                  <div
                    className={cn(
                      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr gap-2 pb-1",
                      group.hidden && "opacity-50",
                    )}
                  >
                    {items.map((cat) => (
                      <div
                        key={cat.id}
                        className={cn(
                          "group flex items-center gap-2.5 h-full rounded-lg border px-3 py-2 transition-colors",
                          "bg-white border-slate-200 hover:bg-slate-50",
                          cat.hidden && "opacity-50",
                        )}
                      >
                        {cat.code && (
                          <span className="text-xs text-slate-400 tabular-nums shrink-0">
                            {cat.code}
                          </span>
                        )}
                        <span className="text-sm text-slate-700 truncate flex-1">
                          {cat.name}
                        </span>
                        {canManage && (
                          <div
                            className={cn(
                              "flex items-center gap-1.5 shrink-0 transition-opacity",
                              // Categoria da org: botoes sempre visiveis porem
                              // esmaecidos ate o hover. Preset: acoes so no
                              // hover (desktop).
                              !cat.is_preset
                                ? "opacity-40 group-hover:opacity-100"
                                : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                            )}
                          >
                            {!cat.is_preset ? (
                              <>
                                <ActionIconButton
                                  icon={Pencil}
                                  label="Editar"
                                  onClick={() => openEditCategory(cat)}
                                />
                                <ActionIconButton
                                  icon={Trash2}
                                  label="Excluir"
                                  tone="danger"
                                  onClick={() => setPendingDeleteCat(cat)}
                                />
                              </>
                            ) : (
                              <ActionIconButton
                                icon={cat.hidden ? Eye : EyeOff}
                                label={cat.hidden ? "Reativar" : "Desativar"}
                                onClick={() => void toggleCategoryHidden(cat)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => openNewCategory(group)}
                        className="flex items-center justify-start gap-1.5 h-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Plus className="size-4" />
                        Nova Categoria
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Novo grupo: mesma anatomia do cabecalho de grupo (caixa size-9 +
          rotulo), pra cair alinhado com a lista acima. */}
      {canManage && !loading && !searching && (
        <button
          type="button"
          onClick={openNewGroup}
          className="group/new flex items-center gap-2 w-full text-left py-1"
        >
          <span className="size-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-400 group-hover/new:border-slate-300 group-hover/new:bg-slate-50 group-hover/new:text-slate-600 transition-colors shrink-0">
            <Plus className="size-5" />
          </span>
          <span className="text-sm font-medium text-slate-400 group-hover/new:text-slate-600 transition-colors">
            Novo Grupo
          </span>
        </button>
      )}

      {/* Confirmacao de exclusao de categoria */}
      <ConfirmActionDialog
        open={pendingDeleteCat !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteCat(null);
        }}
        onConfirm={() => void confirmDeleteCategory()}
        title="Excluir categoria?"
        description={`A categoria ${pendingDeleteCat?.name ?? ""} será removida. Lançamentos antigos que a usavam continuam intactos.`}
        confirmLabel="Excluir"
      />

      {/* Confirmacao de exclusao de grupo */}
      <ConfirmActionDialog
        open={pendingDeleteGroup !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteGroup(null);
        }}
        onConfirm={() => void confirmDeleteGroup()}
        title="Excluir grupo?"
        description={
          deleteGroupCount > 0
            ? `O grupo ${pendingDeleteGroup?.name ?? ""} e as ${deleteGroupCount} categorias dentro dele serão removidos. Lançamentos antigos continuam intactos.`
            : `O grupo ${pendingDeleteGroup?.name ?? ""} será removido.`
        }
        loading={saving}
        confirmLabel="Excluir"
        loadingLabel="Excluindo..."
      />
    </div>
  );
}
