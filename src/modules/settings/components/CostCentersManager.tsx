import { useEffect, useState } from "react";
import Star from "~icons/ph/star";
import StarFilled from "~icons/ph/star-fill";
import Archive from "~icons/ph/archive";
import Pencil from "~icons/ph/pencil-simple";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import { Obrigatorio } from "@/components/ui/Obrigatorio";
import { useCostCenters } from "@/modules/cost-centers/hooks/useCostCenters";
import {
  CC_COLORS,
  MAX_COST_CENTERS,
  type CostCenter,
} from "@/modules/cost-centers/types";
import {
  CC_ICONS,
  CostCenterChip,
  ccTextColor,
} from "@/modules/cost-centers/ccIcons";

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
export function CostCentersManager({
  aoAbrirFormulario,
  aoRegistrarAcao,
}: {
  /** Ver CardsManager: evita dois "Voltar" empilhados no hub. */
  aoAbrirFormulario?: (aberto: boolean) => void;
  /**
   * Entrega ao hub a função de "Novo Centro de Custo", para o botão morar NA
   * BARRA, ao lado do Voltar. Uma linha inteira só para ele empurrava a lista
   * para baixo sem informar nada.
   *
   * Registra `null` quando o limite foi atingido: em vez de um botão desligado
   * que não diz por quê, o lugar dele recebe a explicação.
   */
  aoRegistrarAcao?: (acao: (() => void) | null) => void;
} = {}) {
  const { costCenters, loading, error, create, update, archive } =
    useCostCenters();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    color: CC_COLORS[0],
    icon: CC_ICONS[0].slug,
  });
  const [saving, setSaving] = useState(false);
  const [pendingDefault, setPendingDefault] = useState<CostCenter | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<CostCenter | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    aoAbrirFormulario?.(dialogOpen);
  }, [dialogOpen, aoAbrirFormulario]);

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

  useEffect(() => {
    aoRegistrarAcao?.(canCreate ? () => openNew : null);
    return () => aoRegistrarAcao?.(null);
  }, [aoRegistrarAcao, canCreate]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", color: CC_COLORS[0], icon: CC_ICONS[0].slug });
    setDialogOpen(true);
  }

  function openEdit(cc: CostCenter) {
    setEditing(cc);
    setForm({
      name: cc.name,
      color: cc.color || CC_COLORS[0],
      icon: cc.icon || CC_ICONS[0].slug,
    });
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
      ok = await update(editing.id, {
        name: form.name.trim(),
        color: form.color,
        icon: form.icon,
      });
    } else {
      const created = await create({
        name: form.name.trim(),
        color: form.color,
        icon: form.icon,
      });
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

  // Criar/editar SUBSTITUI a lista, dentro da aba — as abas de Configurações
  // continuam à vista, que é o contexto que o diálogo tapava. Ver
  // docs/PADRAO-DE-PAGINA.md §6.
  if (dialogOpen) {
    return (
      <PaginaDeFormulario
        formId="form-centro-de-custo"
        rotuloSalvar={editing ? "Salvar" : "Criar Centro"}
        descricao={
          editing ? `Editando ${editing.name}` : "Novo centro de custo"
        }
        aoVoltar={() => setDialogOpen(false)}
        salvando={saving}
      >
        <form
          id="form-centro-de-custo"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Nome
              <Obrigatorio />
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
                    style={
                      selected ? { backgroundColor: form.color } : undefined
                    }
                  >
                    <Icon
                      className="size-5"
                      style={{
                        color: selected ? ccTextColor(form.color) : "#737373",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </PaginaDeFormulario>
    );
  }

  return (
    <div className="space-y-4">
      {!canCreate && (
        <p className="text-sm text-slate-500">
          Você chegou ao limite de {MAX_COST_CENTERS} centros de custo. Arquive
          um que não usa mais para abrir espaço.
        </p>
      )}

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
