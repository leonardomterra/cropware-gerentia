import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import ArrowDownNarrowWide from "~icons/ph/arrow-down";
import ArrowUpNarrowWide from "~icons/ph/arrow-up";
import Camera from "~icons/ph/camera";
import ChevronDown from "~icons/ph/caret-down";
import X from "~icons/ph/x";
import ArrowsDownUp from "~icons/ph/arrows-down-up";
import ClockArrowDown from "~icons/ph/arrow-line-down";
import ClockArrowUp from "~icons/ph/arrow-line-up";
import Loader2 from "~icons/svg-spinners/ring-resize";
import Plus from "~icons/ph/plus";
import Trash2 from "~icons/ph/trash";
import Print from "~icons/ph/printer";
import { cn } from "@/components/ui/utils";
import { apiGetArrayBuffer } from "@/utils/api";
import {
  mergeAttachmentsToPdf,
  pdfViewerHtml,
} from "../utils/mergeAttachmentsPdf";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/components/ui/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useReceiptPermissions } from "../hooks/useReceiptPermissions";
import {
  BOTAO_BARRA,
  BOTAO_BARRA_PRIMARIO,
  BOTAO_LOTE_DESTRUTIVO,
  CAMPO_BARRA,
  ICONE_BOTAO_BARRA,
  MENU_DA_BARRA,
  SETA_BOTAO_BARRA,
} from "@/lib/ui-tokens";
import { BatchActionBar } from "@/components/ui/BatchActionBar";
import type { CampoDaBarra } from "@/components/ui/BarraDeTela";
import {
  AllCentersChip,
  CostCenterChip,
  ccTextColor,
} from "@/modules/cost-centers/ccIcons";
import { ReceiptFiltersBar } from "./ReceiptFiltersBar";
import { ReceiptsTable } from "./ReceiptsTable";
import { ReceiptsCards } from "./ReceiptsCards";
import { ReceiptFormDialog } from "./ReceiptFormDialog";
import { ReceiptCaptureDialog } from "./ReceiptCaptureDialog";
import { PaginaDeAnexo } from "./PaginaDeAnexo";
import {
  MonthSwitcher,
  currentYearMonth,
  monthRangeISO,
  type YearMonth,
} from "./MonthSwitcher";
import { deleteReceipt, useReceipts } from "../hooks/useReceipts";
import type { ScanResult } from "../hooks/useReceiptScanner";
import type {
  ItemRow,
  Receipt,
  ReceiptDirection,
  ReceiptDocType,
  ReceiptFilters,
  ReceiptPaymentMethod,
  ReceiptStatus,
} from "../types";
import { formatBRL, todayISO } from "../utils/receiptFormatters";
import { STATUSES_BY_DIRECTION } from "../constants";
import { exportFile } from "@/utils/nativeExport";
import { isNativeCapacitorApp } from "@/utils/platform";

interface PrefillFromScan {
  values: {
    direction?: ReceiptDirection;
    doc_type?: ReceiptDocType;
    status?: ReceiptStatus;
    total_value?: string;
    vendor?: string;
    category?: string;
    description?: string;
    payment_method?: ReceiptPaymentMethod | "";
    transaction_date?: string;
    invoice_number?: string;
    items?: ItemRow[];
  };
  attachment_key: string;
  attachment_mime: string;
  ai_confidence?: number | null;
  ai_raw?: unknown;
}

export interface ReceiptsListPageProps {
  /** Filtro client-side (ex.: só faturas, ou só itemizados). Default: tudo.
   *  IMPORTANTE: passar uma referência estável (constante de módulo). */
  docFilter?: (r: Receipt) => boolean;
  /** create/edit usa o editor de itens (páginas Notas e Recibos / Faturas). */
  itemized?: boolean;
  /** doc_type semeado ao criar (ex.: "fatura"). */
  defaultDocType?: ReceiptDocType;
  /** Mostra o botão "Capturar Recibo". Default true. */
  showCapture?: boolean;
  /** Mostra o botão de criar lançamento. Default true. */
  showCreate?: boolean;
  /** Só a ação "Ver detalhes" nas linhas (sem editar/excluir/descrição). */
  viewOnly?: boolean;
  /** Rótulo do botão de criar. Default "Novo Lançamento". */
  createLabel?: string;
  /** Rótulo curto do botão de criar (mobile). Default "Novo". */
  createLabelShort?: string;
  /** Texto quando não há registros. */
  emptyLabel?: string;
  /** Substantivo da contagem ("Mostrando N ___"). Default lançamento(s). */
  /** Substantivo da aba. `genero` só é preciso onde ele é feminino ("fatura"):
   *  sem ele a barra de seleção diria "1 fatura selecionado". */
  countNoun?: { one: string; many: string; genero?: "m" | "f" };
  /** Títulos do dialog de criar/editar (por aba). */
  titleNew?: string;
  titleEdit?: string;
  /**
   * Campo extra À VISTA na barra, ao lado do centro de custo. Usado pela aba
   * Cartões para o filtro por cartão. Quem controla o estado é o chamador — a
   * lista só posiciona, e o recorte vem pelo `docFilter`.
   */
  camposExtra?: CampoDaBarra;
  /**
   * Avisa o hub que um formulário (ver/editar/anexo) assumiu a tela. Esses
   * formulários desenham a PRÓPRIA barra; sem isto o hub mantém a dele e
   * aparecem dois "Voltar" empilhados.
   */
  aoAbrirFormulario?: (aberto: boolean) => void;
  /**
   * Tela própria de LEITURA, no lugar do formulário genérico. A aba Cartões
   * passa a da fatura: lá o vocabulário é outro (competência, fechamento,
   * cartão) e o formulário genérico falava de "Número da Nota Fiscal".
   *
   * Fica como injeção e não como `if (doc_type === "fatura")` para a lista não
   * precisar conhecer fatura — ela só sabe que alguém pode desenhar melhor.
   */
  renderLeitura?: (args: {
    receipt: Receipt;
    aoVoltar: () => void;
    aoEditar?: () => void;
  }) => ReactNode;
}

// Numero -> string p/ os inputs do form (vírgula decimal). "" se nulo/invalido.
function numToInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(n).replace(".", ",");
}

function scanToPrefill(scan: ScanResult): PrefillFromScan {
  const e = scan.extracted;
  const direction: ReceiptDirection = e?.direction ?? "expense";
  const defaultStatus = STATUSES_BY_DIRECTION[direction][0];

  // Itens da IA: só itemiza com 2+ itens válidos (1 item = header-only).
  const mappedItems: ItemRow[] = (e?.line_items ?? [])
    .filter((li) => li && Number.isFinite(li.total_value))
    .map((li) => ({
      key: crypto.randomUUID(),
      description: li.description ?? "",
      quantity: numToInput(li.quantity),
      unit_value: numToInput(li.unit_value),
      total_value: numToInput(li.total_value),
      category: li.category ?? "",
      cost_center_id: "",
    }));
  const items: ItemRow[] = mappedItems.length >= 2 ? mappedItems : [];

  return {
    attachment_key: scan.attachment_key,
    attachment_mime: scan.attachment_mime,
    ai_confidence: e?.confidence ?? null,
    ai_raw: e,
    values: {
      direction,
      doc_type: e?.doc_type ?? "cupom",
      status: defaultStatus,
      total_value:
        e?.total_value != null ? String(e.total_value).replace(".", ",") : "",
      vendor: e?.vendor ?? "",
      category: e?.category ?? "",
      description: e?.description ?? "",
      payment_method: e?.payment_method ?? "",
      transaction_date: e?.transaction_date ?? todayISO(),
      invoice_number: e?.invoice_number ?? "",
      items,
    },
  };
}

export function ReceiptsListPage({
  docFilter,
  camposExtra,
  aoAbrirFormulario,
  renderLeitura,
  itemized = false,
  defaultDocType,
  showCapture = true,
  showCreate = true,
  viewOnly = false,
  createLabel = "Novo Lançamento",
  createLabelShort = "Novo",
  emptyLabel = "Sem lançamentos",
  countNoun = { one: "lançamento", many: "lançamentos", genero: "m" },
  titleNew,
  titleEdit,
}: ReceiptsListPageProps) {
  const { user, isViewer, canReadAll, isTeamOrg } = useAuth();
  const { canEdit } = useReceiptPermissions();
  // Convidado nao cria nem edita: as acoes somem em vez de aparecerem e darem
  // erro. A RLS ja barra no banco — isto e so a interface contando a verdade.
  const readOnly = viewOnly || isViewer;
  const userCCs = user?.costCenters ?? [];
  const showTabs = userCCs.length > 1;

  const [filters, setFilters] = useState<ReceiptFilters>({});
  // Gestor/convidado abrem no consolidado da equipe (e' o motivo do perfil
  // existir) e podem estreitar pro proprio.
  const [onlyMine, setOnlyMine] = useState(false);
  const [month, setMonth] = useState<YearMonth>(currentYearMonth);
  const [activeCCId, setActiveCCId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "recent" | "old" | "value_desc" | "value_asc"
  >("recent");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // `lendo` é o MODO do formulário, não um segundo diálogo: ver e editar são a
  // mesma tela, e o botão do rodapé alterna entre os dois.
  const [lendo, setLendo] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Receipt | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editing, setEditing] = useState<Receipt | null>(null);
  const [prefill, setPrefill] = useState<PrefillFromScan | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Mês é o escopo primário de data: define from/to (transaction_date).
  const monthRange = useMemo(() => monthRangeISO(month), [month]);
  const effectiveFilters: ReceiptFilters = {
    ...filters,
    ...(activeCCId !== "all" ? { cost_center_id: activeCCId } : {}),
    ...(onlyMine ? { scope: "mine" as const } : {}),
    from: monthRange.from,
    to: monthRange.to,
  };

  const {
    receipts: allReceipts,
    loading,
    error,
    refetch,
  } = useReceipts(effectiveFilters);
  const isMobile = useIsMobile();

  // Filtro client-side por doc_type/itens (páginas dedicadas).
  const receipts = useMemo(
    () => (docFilter ? allReceipts.filter(docFilter) : allReceipts),
    [allReceipts, docFilter],
  );

  // Refetch = ja tinha dados em tela e esta recarregando (troca de mes/filtro).
  const isRefetching = loading && receipts.length > 0;

  // Sort client-side. Default 'recent' usa paid_date || transaction_date.
  const sortedReceipts = useMemo(() => {
    const arr = [...receipts];
    const dateOf = (r: Receipt) => r.paid_date || r.transaction_date || "";
    switch (sortBy) {
      case "recent":
        return arr.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
      case "old":
        return arr.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
      case "value_desc":
        return arr.sort(
          (a, b) => Number(b.total_value) - Number(a.total_value),
        );
      case "value_asc":
        return arr.sort(
          (a, b) => Number(a.total_value) - Number(b.total_value),
        );
      default:
        return arr;
    }
  }, [receipts, sortBy]);

  // Lançamento itemizado criado a partir de scan multi-item precisa do editor
  // de itens mesmo em Lançamentos (allowItems=false por padrão).
  const formAllowItems =
    itemized || (!editing && (prefill?.values.items?.length ?? 0) >= 2);

  const openCreate = () => {
    setEditing(null);
    setPrefill(null);
    setFormOpen(true);
  };

  const openEdit = (r: Receipt) => {
    setEditing(r);
    setPrefill(null);
    setLendo(false);
    setFormOpen(true);
  };

  // Ver é a MESMA tela de editar, travada (Etapa D de
  // docs/ADOCAO-DESIGN-FLAGFIELD.md). Em viewOnly (aba Anexos) o "olho" abre
  // direto o arquivo, que é o assunto daquela aba.
  const openView = (r: Receipt) => {
    if (viewOnly) {
      setViewingAttachment(r);
      return;
    }
    setEditing(r);
    setPrefill(null);
    setLendo(true);
    setFormOpen(true);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allSelected = receipts.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        receipts.forEach((r) => next.delete(r.id));
      } else {
        receipts.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const [printing, setPrinting] = useState(false);
  // Junta os anexos selecionados (PDFs + imagens) num PDF único e abre numa nova
  // aba pra visualizar/imprimir/salvar. A janela é aberta no clique (gesto do
  // usuário) pra escapar do bloqueador de pop-up; o conteúdo entra após o merge.
  const handlePrintSelected = async () => {
    const chosen = sortedReceipts.filter(
      (r) => selectedIds.has(r.id) && r.attachment_key,
    );
    if (chosen.length === 0) {
      toast.error("Nenhum anexo selecionado.");
      return;
    }
    const native = isNativeCapacitorApp();
    // Web: abre a aba já no gesto do clique (escapa do bloqueador de pop-up); o
    // conteúdo entra após o merge. No nativo não há aba — compartilha o PDF.
    const win = native ? null : window.open("", "_blank");
    if (win) {
      win.document.write(
        "<p style='font-family:sans-serif;color:#525252;padding:24px'>Gerando PDF…</p>",
      );
    }
    setPrinting(true);
    const toastId = toast.loading(
      `Gerando PDF de ${chosen.length} anexo${chosen.length === 1 ? "" : "s"}…`,
    );
    try {
      const items = await Promise.all(
        chosen.map(async (r) => {
          const bytes = await apiGetArrayBuffer(`/receipts/${r.id}/attachment`);
          return { receipt: r, bytes };
        }),
      );
      const { blob, failed } = await mergeAttachmentsToPdf(items);
      const filename = `anexos_${month.year}-${String(month.month).padStart(2, "0")}.pdf`;
      if (native) {
        // iOS/Android: grava e abre a folha de compartilhamento.
        await exportFile(filename, blob, "application/pdf");
      } else {
        const url = URL.createObjectURL(blob);
        if (win) {
          win.document.open();
          win.document.write(pdfViewerHtml(url, filename));
          win.document.close();
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
        }
        // Libera o blob depois (a aba/iframe já carregou) — evita vazamento.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      if (failed > 0) {
        toast.warning(`${failed} arquivo(s) não puderam ser incluídos.`, {
          id: toastId,
        });
      } else {
        toast.success("PDF gerado.", { id: toastId });
      }
    } catch {
      win?.close();
      toast.error("Erro ao gerar o PDF.", { id: toastId });
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, activeCCId]);

  // Deep-link "?open=<id>" (vindo do "Gerenciar itens" em Lançamentos): abre
  // direto o dialog de edição do lançamento quando ele estiver carregado.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    const found = receipts.find((r) => r.id === openId);
    if (!found) return;
    setEditing(found);
    setPrefill(null);
    setFormOpen(true);
    searchParams.delete("open");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, receipts]);

  const handleScanComplete = (scan: ScanResult) => {
    setEditing(null);
    setPrefill(scanToPrefill(scan));
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteReceipt(pendingDelete.id);
      setPendingDelete(null);
      await refetch();
      toast.success("Lançamento excluído");
    } catch (err) {
      console.error("[ReceiptsListPage] delete failed:", err);
      toast.error("Erro ao excluir. Tente de novo.");
    } finally {
      setDeleting(false);
    }
  };

  // Uma frase só, num nó de texto só: num flex-wrap, partir isto em pedaços
  // faria a última palavra cair sozinha na linha de baixo.
  /** "lançamentos" -> "Lançamentos". Só a primeira letra: `capitalize` do CSS
   *  quebraria um substantivo de duas palavras ("Notas E Recibos"). */
  const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

  /**
   * UMA função de limpar, e ela zera TUDO que filtra — inclusive o que não está
   * no painel (a busca, o centro de custo, o escopo da equipe). Duplicar a
   * rotina dentro do painel foi o que o Flag Field desaconselha: as duas
   * divergem, e a que ninguém testa é a que fica quebrada.
   *
   * O MÊS fica de fora de propósito: ele é o período em que se olha, não um
   * filtro — não existe estado "sem mês".
   */
  const temFiltroAtivo =
    !!filters.search ||
    !!filters.direction ||
    (filters.status?.length ?? 0) > 0 ||
    (filters.category?.length ?? 0) > 0 ||
    activeCCId !== "all" ||
    onlyMine;

  const limparFiltros = () => {
    setFilters({});
    setActiveCCId("all");
    setOnlyMine(false);
  };

  const podeCriar = showCreate || showCapture;
  const duasFormasDeCriar = showCreate && showCapture;

  const rotuloDaSelecao = (() => {
    const n = selectedIds.size;
    const substantivo = n === 1 ? countNoun.one : countNoun.many;
    const adjetivo =
      countNoun.genero === "f"
        ? n === 1
          ? "selecionada"
          : "selecionadas"
        : n === 1
          ? "selecionado"
          : "selecionados";
    return `${n} ${substantivo} ${adjetivo}`;
  })();

  const confirmBulkDelete = async () => {
    // Só apaga o que é do próprio usuário. Sem este filtro, o gestor que
    // selecionasse a lista da equipe tomaria um "3 de 8 não foram excluídos",
    // que soa como falha quando na verdade é a regra funcionando.
    const selected = receipts.filter((r) => selectedIds.has(r.id));
    const ids = selected.filter(canEdit).map((r) => r.id);
    const skipped = selected.length - ids.length;
    if (ids.length === 0) {
      setBulkOpen(false);
      clearSelection();
      toast.info("Nada a excluir: esses lançamentos são de outras pessoas.");
      return;
    }
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => deleteReceipt(id)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      setBulkOpen(false);
      clearSelection();
      await refetch();
      if (failed === 0) {
        toast.success(
          `${ids.length} ${ids.length === 1 ? "lançamento excluído" : "lançamentos excluídos"}` +
            (skipped > 0
              ? ` — ${skipped} de outras pessoas foram mantidos`
              : ""),
        );
      } else {
        toast.error(
          `${failed} de ${ids.length} não foram excluídos. Tente de novo.`,
        );
      }
    } catch (err) {
      console.error("[ReceiptsListPage] bulk delete failed:", err);
      toast.error("Erro ao excluir. Tente de novo.");
    } finally {
      setBulkDeleting(false);
    }
  };

  /**
   * PÁGINA, não diálogo: com o formulário aberto a lista dá lugar a ele no
   * mesmo espaço.
   *
   * O diálogo custava caro justamente aqui — este formulário é longo, e no
   * celular o teclado do iOS espremia o conteúdo enquanto a rolagem do modal
   * brigava com a da tela atrás. Em página ele tem a largura toda e uma rolagem
   * só.
   *
   * É troca de conteúdo, não rota nova: dar URL própria a cada lançamento exige
   * um `GET /receipts/:id` que a API ainda não tem — sem ele, a página não
   * sobreviveria a um F5. Fica anotado como próximo passo.
   */
  // Ver anexo também substitui a lista, pelo mesmo motivo do formulário: no
  // celular o diálogo espremia justamente o que se quer olhar grande.
  // Qualquer uma das telas cheias (anexo ou formulário) substitui o conteúdo e
  // traz a própria barra.
  useEffect(() => {
    aoAbrirFormulario?.(formOpen || viewingAttachment !== null);
  }, [formOpen, viewingAttachment, aoAbrirFormulario]);

  if (viewingAttachment) {
    return (
      <PaginaDeAnexo
        receipt={viewingAttachment}
        aoVoltar={() => setViewingAttachment(null)}
      />
    );
  }

  // Leitura com desenho próprio (ex.: fatura). Editar continua no formulário
  // genérico — o que muda é como se OLHA, não como se preenche.
  if (formOpen && lendo && editing && renderLeitura) {
    const fechar = () => {
      setFormOpen(false);
      setEditing(null);
      setLendo(false);
    };
    return (
      <>
        {renderLeitura({
          receipt: editing,
          aoVoltar: fechar,
          aoEditar: canEdit(editing) ? () => setLendo(false) : undefined,
        })}
      </>
    );
  }

  if (formOpen) {
    return (
      <ReceiptFormDialog
        modo="pagina"
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setPrefill(null);
            setEditing(null);
            setLendo(false);
          }
        }}
        receipt={editing}
        somenteLeitura={lendo}
        aoEditar={
          editing && canEdit(editing) ? () => setLendo(false) : undefined
        }
        prefill={prefill}
        allowItems={formAllowItems}
        defaultDocType={defaultDocType}
        titleNew={titleNew}
        titleEdit={titleEdit}
        onSaved={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div>
      {/* Linha única — a BarraDeTela decide o layout por tamanho de tela: no
          celular os campos descem para o painel e a ação principal ganha a
          linha. Ver components/ui/BarraDeTela.tsx e §2 do padrão de página. */}
      <div className="mb-3">
        <ReceiptFiltersBar
          value={filters}
          onChange={setFilters}
          campos={[
            ...(showTabs
              ? [
                  {
                    rotulo: "Centro de Custo",
                    ativo: activeCCId !== "all",
                    campo: (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className={CAMPO_BARRA}>
                            {activeCCId !== "all" ? (
                              <CostCenterChip
                                icon={
                                  userCCs.find((c) => c.id === activeCCId)?.icon
                                }
                                color={
                                  userCCs.find((c) => c.id === activeCCId)
                                    ?.color
                                }
                                className="size-[18px]"
                              />
                            ) : (
                              <AllCentersChip className="size-[18px]" />
                            )}
                            <span
                              className="flex-1 text-left truncate"
                              style={
                                activeCCId !== "all"
                                  ? {
                                      color: ccTextColor(
                                        userCCs.find((c) => c.id === activeCCId)
                                          ?.color,
                                      ),
                                    }
                                  : undefined
                              }
                            >
                              {activeCCId === "all" ? (
                                <>
                                  <span className="sm:hidden">Centros</span>
                                  <span className="hidden sm:inline">
                                    Todos os Centros
                                  </span>
                                </>
                              ) : (
                                userCCs.find((c) => c.id === activeCCId)
                                  ?.name || "Centro"
                              )}
                            </span>
                            <ChevronDown className="size-4 text-slate-500 shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className={MENU_DA_BARRA}
                        >
                          <DropdownMenuItem
                            onClick={() => setActiveCCId("all")}
                            className={
                              activeCCId === "all"
                                ? "bg-white/10 font-medium gap-2"
                                : "gap-2"
                            }
                          >
                            <AllCentersChip className="size-6" />
                            <span className="min-w-0 flex-1 truncate">
                              Todos
                            </span>
                          </DropdownMenuItem>
                          {userCCs.map((cc) => (
                            <DropdownMenuItem
                              key={cc.id}
                              onClick={() => setActiveCCId(cc.id)}
                              className={
                                activeCCId === cc.id
                                  ? "bg-white/10 font-medium gap-2"
                                  : "gap-2"
                              }
                            >
                              <CostCenterChip
                                icon={cc.icon}
                                color={cc.color}
                                className="size-6"
                              />
                              <span
                                className="min-w-0 flex-1 truncate"
                                style={{ color: cc.color ?? undefined }}
                              >
                                {cc.name}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ),
                  },
                ]
              : []),
            ...(camposExtra ? [camposExtra] : []),
            ...(isTeamOrg && canReadAll
              ? [
                  {
                    rotulo: "Quem lançou",
                    ativo: onlyMine,
                    campo: (
                      <>
                        // `col-span-*` era da grade da antiga "linha 2", que
                        deixou // de existir. No celular ele cai embaixo do
                        botão de criar; no // desktop, ao lado.
                        <div className="flex rounded-md border border-slate-200 overflow-hidden w-full lg:w-auto lg:min-w-[190px] mt-2 lg:mt-0">
                          <button
                            type="button"
                            onClick={() => setOnlyMine(false)}
                            className={cn(
                              "flex-1 px-3 py-2 text-sm transition-colors",
                              !onlyMine
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            Toda a equipe
                          </button>
                          <button
                            type="button"
                            onClick={() => setOnlyMine(true)}
                            className={cn(
                              "flex-1 px-3 py-2 text-sm border-l border-slate-200 transition-colors",
                              onlyMine
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            Só os meus
                          </button>
                        </div>
                      </>
                    ),
                  },
                ]
              : []),
          ]}
          acoes={
            <>
              {/* O seletor de mês só no DESKTOP: o navegador `‹ Agosto 2026 ›`
                  logo abaixo diz o mesmo, e no celular repetir os dois gasta
                  uma das duas linhas com informação que já está na tela. */}
              {!isMobile && (
                <MonthSwitcher
                  value={month}
                  onChange={setMonth}
                  variant="picker"
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* Rótulo FIXO: mostrar a opção ativa ("Maior valor" x "Recentes")
                  fazia o botão mudar de largura a cada escolha, e ele é o vizinho
                  da barra inteira. A opção ativa se lê abrindo o menu, onde ela
                  aparece destacada. */}
                  <button
                    type="button"
                    className={cn(
                      BOTAO_BARRA,
                      "inline-flex items-center rounded-md",
                    )}
                  >
                    <ArrowsDownUp className={ICONE_BOTAO_BARRA} />
                    Ordenar
                    <ChevronDown className={SETA_BOTAO_BARRA} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={MENU_DA_BARRA}>
                  <DropdownMenuItem
                    onClick={() => setSortBy("recent")}
                    className={
                      sortBy === "recent"
                        ? "bg-white/10 font-medium gap-2"
                        : "gap-2"
                    }
                  >
                    <ClockArrowDown className="size-4" />
                    Mais recentes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("old")}
                    className={
                      sortBy === "old"
                        ? "bg-white/10 font-medium gap-2"
                        : "gap-2"
                    }
                  >
                    <ClockArrowUp className="size-4" />
                    Mais antigos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("value_desc")}
                    className={
                      sortBy === "value_desc"
                        ? "bg-white/10 font-medium gap-2"
                        : "gap-2"
                    }
                  >
                    <ArrowDownNarrowWide className="size-4" />
                    Maior valor
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("value_asc")}
                    className={
                      sortBy === "value_asc"
                        ? "bg-white/10 font-medium gap-2"
                        : "gap-2"
                    }
                  >
                    <ArrowUpNarrowWide className="size-4" />
                    Menor valor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
          acaoPrincipal={
            <>
              {/* Criar é UMA porta, não duas.
            "Novo Lançamento" e "Capturar Recibo" terminam no mesmo lugar — um
            lançamento — e a diferença é só COMO se preenche: na mão ou pela
            foto. Dois botões de mesmo peso lado a lado faziam a escolha parecer
            maior do que é, e comiam a linha de ações no celular.

            Com as DUAS formas disponíveis vira um botão com menu. Com uma só
            (Notas e Faturas não capturam), volta a ser botão direto: menu de um
            item é um clique a troco de nada. */}
              {podeCriar &&
                !isViewer &&
                (duasFormasDeCriar ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {/* A ÚNICA ação de fundo escuro da barra. É o que separa
                    "criar" das demais, todas em cinza — sem isso, tudo tem o
                    mesmo peso e nada é a ação principal. Sem `flex-1`: ele
                    mede pelo próprio rótulo, e não pela linha. */}
                      <Button
                        variant="default"
                        className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5")}
                      >
                        <Plus className="size-[18px] shrink-0" />
                        <span className="sm:hidden">{createLabelShort}</span>
                        <span className="hidden sm:inline">{createLabel}</span>
                        <ChevronDown className={SETA_BOTAO_BARRA} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className={MENU_DA_BARRA}
                    >
                      <DropdownMenuItem onClick={openCreate} className="gap-2">
                        <Plus className="size-4" />
                        Lançamento Manual
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setCaptureOpen(true)}
                        className="gap-2"
                      >
                        <Camera className="size-4" />
                        Capturar Recibo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="default"
                    onClick={
                      showCreate ? openCreate : () => setCaptureOpen(true)
                    }
                    className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5")}
                  >
                    {showCreate ? (
                      <Plus className="size-[18px] shrink-0" />
                    ) : (
                      <Camera className="size-[18px] shrink-0" />
                    )}
                    <span className="sm:hidden">
                      {showCreate ? createLabelShort : "Capturar"}
                    </span>
                    <span className="hidden sm:inline">
                      {showCreate ? createLabel : "Capturar Recibo"}
                    </span>
                  </Button>
                ))}
            </>
          }
        />
      </div>

      {/* Contador e "Limpar Filtros" na própria linha, encostados à direita.
          Chegaram a subir pra linha das ações; na tela ficou apertado — a linha
          já carrega o botão de criar e o alternador da equipe. */}
      {!error && (
        <div className="flex items-center justify-end gap-1 mb-2 px-1 min-h-[28px]">
          <p className="text-sm text-slate-500 inline-flex items-center gap-2">
            {loading && receipts.length === 0
              ? "Carregando…"
              : receipts.length === 0
                ? emptyLabel
                : `Mostrando ${receipts.length} ${maiuscula(receipts.length === 1 ? countNoun.one : countNoun.many)}`}
            {isRefetching ? (
              <Loader2 className="size-3 text-slate-400" />
            ) : null}
          </p>
          {temFiltroAtivo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="h-8 px-2 font-normal text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Limpar filtros"
            >
              <X className="size-4 mr-1.5" />
              Limpar Filtros
            </Button>
          )}
        </div>
      )}

      <MonthSwitcher
        value={month}
        onChange={setMonth}
        variant="chips"
        className="mb-3"
      />

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div
          className={cn(
            "transition-opacity duration-200",
            loading && "opacity-50 pointer-events-none",
          )}
        >
          {isMobile ? (
            <ReceiptsCards
              receipts={sortedReceipts}
              onView={openView}
              onEdit={openEdit}
              onDelete={(r) => setPendingDelete(r)}
              viewOnly={readOnly}
              emptyLabel={emptyLabel}
            />
          ) : (
            <ReceiptsTable
              receipts={sortedReceipts}
              onView={openView}
              onEdit={openEdit}
              onDelete={(r) => setPendingDelete(r)}
              selectedIds={selectedIds}
              onToggleOne={toggleOne}
              onToggleAll={toggleAll}
              viewOnly={readOnly}
              emptyLabel={emptyLabel}
            />
          )}
        </div>
      )}

      {showCapture && (
        <ReceiptCaptureDialog
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          onScanComplete={handleScanComplete}
        />
      )}

      {/* Ações em lote: barra flutuante, não uma fileira de botões no
          cabeçalho. Ela pousa sobre a lista onde o usuário acabou de marcar —
          por isso o vidro, e não um fundo opaco. */}
      {selectedIds.size > 0 && (
        <BatchActionBar label={rotuloDaSelecao} onCancel={clearSelection}>
          {readOnly ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrintSelected}
              disabled={printing}
              className="h-8 px-4 shrink-0 font-normal text-sm text-white hover:bg-white/10"
            >
              <Print className="size-4 mr-1.5" />
              {printing ? "Gerando…" : "Imprimir"}
            </Button>
          ) : (
            /* Preenchimento sólido não funciona sobre o vidro: o vermelho cheio
               compete com a lista atrás da barra. O que resolve é inverter a
               proporção — a cor vira lavagem e vive no texto e na borda. */
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBulkOpen(true)}
              className={cn(BOTAO_LOTE_DESTRUTIVO, "shrink-0")}
            >
              <Trash2 className="size-4 mr-1.5" />
              Excluir
            </Button>
          )}
        </BatchActionBar>
      )}

      {/* Confirmação passa pelo componente comum: os dois diálogos aqui eram
          AlertDialog montados à mão e por isso não acompanhavam o padrão
          (empilhavam no mobile, tinham divisória e sombra nos botões). */}
      <ConfirmActionDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        title="Excluir Lançamento"
        description="Essa ação não pode ser desfeita."
        infoItems={
          pendingDelete
            ? [
                {
                  label:
                    pendingDelete.vendor ||
                    pendingDelete.description ||
                    "Lançamento",
                  value: formatBRL(pendingDelete.total_value),
                },
              ]
            : undefined
        }
        confirmLabel="Excluir"
        loading={deleting}
        loadingLabel="Excluindo..."
        onConfirm={confirmDelete}
      />

      <ConfirmActionDialog
        open={bulkOpen}
        onOpenChange={(o) => {
          if (!bulkDeleting) setBulkOpen(o);
        }}
        title={`Excluir ${selectedIds.size} ${
          selectedIds.size === 1 ? "Lançamento" : "Lançamentos"
        }`}
        description="Os lançamentos selecionados serão removidos permanentemente. Essa ação não pode ser desfeita."
        confirmLabel={`Excluir ${selectedIds.size}`}
        loading={bulkDeleting}
        loadingLabel="Excluindo..."
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
