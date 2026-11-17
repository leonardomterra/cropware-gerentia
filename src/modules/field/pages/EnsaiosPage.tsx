import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import Flask from "~icons/ph/test-tube-duotone";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ItemsCount } from "@/components/ui/ItemsCount";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCadastros } from "../hooks/useCadastros";
import { useEnsaios } from "../hooks/useEnsaios";
import { usePermissoesDoCampo } from "../hooks/usePermissoesDoCampo";
import { CartaoDeCadastro, GradeDeCartoes } from "../components/Cadastro";
import { BotaoNovo, BuscaDaLista } from "../components/BuscaDaLista";
import { EditorDeEnsaio } from "../components/ensaio/EditorDeEnsaio";
import { dadosDoEnsaio, gerarRelatorioDoEnsaio } from "../relatorios/doEnsaio";
import { TIPOS_DE_ENSAIO } from "../dominio/ensaios";
import { normalizarNome } from "../utils/nomes";
import type { Ensaio, Plantio } from "../types";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Ensaios — o coração do uso de desenvolvimento de mercado: produto principal ×
 * concorrente no mesmo campo, com avaliações, colheita e ROI. Portado do Flag
 * Field (TrialsManagement + TrialManager), agora com tabelas próprias.
 */
export default function EnsaiosPage() {
  const c = useCadastros();
  const d = useEnsaios();
  const { podeCriar, podeMexer } = usePermissoesDoCampo();
  const [busca, setBusca] = useState("");
  const [fFazenda, setFFazenda] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");
  const [fSituacao, setFSituacao] = useState<"ativos" | "concluidos" | "todos">(
    "ativos",
  );
  const [aberto, setAberto] = useState<{
    id: string | null;
    plantio?: Plantio | null;
  } | null>(null);
  const [excluindo, setExcluindo] = useState<Ensaio | null>(null);
  const [apagando, setApagando] = useState(false);

  const fazendaPorId = useMemo(
    () => new Map(c.fazendas.map((f) => [f.id, f])),
    [c.fazendas],
  );
  const talhaoPorId = useMemo(
    () => new Map(c.talhoes.map((t) => [t.id, t])),
    [c.talhoes],
  );

  // `?abrir=<id>` (calendário) e `?plantio=<id>` ("Criar ensaio neste plantio").
  const [params, setParams] = useSearchParams();
  const abrirId = params.get("abrir");
  const plantioId = params.get("plantio");
  useEffect(() => {
    if (d.carregando || c.carregando) return;
    if (abrirId) setAberto({ id: abrirId });
    else if (plantioId) {
      setAberto({
        id: null,
        plantio: c.plantios.find((p) => p.id === plantioId) ?? null,
      });
    } else return;
    setParams((p) => {
      p.delete("abrir");
      p.delete("plantio");
      return p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId, plantioId, d.carregando, c.carregando]);

  const lista = useMemo(() => {
    const alvo = normalizarNome(busca);
    return d.ensaios.filter(
      (e) =>
        // Fazenda direto no ensaio: o do Flag Field resolvia pelo talhão e
        // escondia ensaio sem talhão quando o filtro estava ligado.
        (fFazenda === "todas" || e.farm_id === fFazenda) &&
        (fTipo === "todos" || e.trial_type === fTipo) &&
        (fSituacao === "todos" ||
          (fSituacao === "ativos"
            ? e.lifecycle === "active"
            : e.lifecycle === "completed")) &&
        (!alvo || normalizarNome(`${e.name} ${e.crop}`).includes(alvo)),
    );
  }, [d.ensaios, busca, fFazenda, fTipo, fSituacao]);

  async function mudarSituacao(e: Ensaio, lifecycle: "active" | "completed") {
    const res = await d.salvar(
      "farm_trials",
      {
        lifecycle,
        completed_at:
          lifecycle === "completed" ? new Date().toISOString() : null,
      },
      e.id,
    );
    if (res.ok)
      toast.success(
        lifecycle === "completed" ? "Ensaio concluído" : "Ensaio reativado",
      );
    else toast.error(res.erro);
  }

  if (aberto) {
    return (
      <EditorDeEnsaio
        ensaioId={aberto.id}
        plantioInicial={aberto.plantio}
        dados={d}
        cadastros={{
          fazendas: c.fazendas,
          talhoes: c.talhoes,
          plantios: c.plantios,
          safras: c.safras,
          produtos: c.produtos,
          salvarProduto: c.salvarProduto,
        }}
        podeMexer={podeMexer}
        aoVoltar={() => setAberto(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <BarraDeTela
        buscaAtiva={Boolean(busca)}
        busca={
          <BuscaDaLista
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar ensaio ou cultura..."
          />
        }
        campos={[
          {
            rotulo: "Fazenda",
            ativo: fFazenda !== "todas",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todas", label: "Todas as fazendas" },
                  ...c.fazendas.map((f) => ({ value: f.id, label: f.name })),
                ]}
                value={fFazenda}
                onValueChange={(v) => setFFazenda(v || "todas")}
              />
            ),
          },
          {
            rotulo: "Tipo",
            ativo: fTipo !== "todos",
            campo: (
              <Select value={fTipo} onValueChange={setFTipo}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {Object.entries(TIPOS_DE_ENSAIO).map(([v, x]) => (
                    <SelectItem key={v} value={v}>
                      {x.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ),
          },
          {
            rotulo: "Situação",
            ativo: fSituacao !== "ativos",
            campo: (
              <Select
                value={fSituacao}
                onValueChange={(v) => setFSituacao(v as typeof fSituacao)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Em condução</SelectItem>
                  <SelectItem value="concluidos">Concluídos</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            ),
          },
        ]}
        acaoPrincipal={
          podeCriar ? (
            <BotaoNovo
              rotulo="Novo Ensaio"
              onClick={() => setAberto({ id: null })}
            />
          ) : undefined
        }
      />

      {d.carregando || c.carregando ? (
        <LoadingState />
      ) : d.ensaios.length === 0 ? (
        <EmptyStateCard
          icon={Flask}
          title="Nenhum ensaio ainda"
          description="Compare o seu produto (principal) com o do concorrente no mesmo campo: avaliações, colheita e ROI num lugar só."
        />
      ) : (
        <>
          <ItemsCount
            count={lista.length}
            totalCount={d.ensaios.length}
            itemLabel="ensaio"
            itemLabelPlural="ensaios"
            showClearFilters={
              Boolean(busca) ||
              fFazenda !== "todas" ||
              fTipo !== "todos" ||
              fSituacao !== "ativos"
            }
            onClearFilters={() => {
              setBusca("");
              setFFazenda("todas");
              setFTipo("todos");
              setFSituacao("ativos");
            }}
          />
          <GradeDeCartoes>
            {lista.map((e) => {
              const mexe = podeMexer(e);
              const prods = d.produtos.filter((p) => p.trial_id === e.id);
              const principais = prods.filter((p) => p.role === "principal");
              const concorrentes = prods.filter(
                (p) => p.role === "concorrente",
              );
              const colhido = d.colheitas.some((h) => h.trial_id === e.id);
              const nAval = d.avaliacoes.filter(
                (a) => a.trial_id === e.id,
              ).length;
              const resumo = (xs: typeof prods) =>
                xs.length
                  ? `${xs[0].name}${xs.length > 1 ? ` +${xs.length - 1}` : ""}`
                  : "—";
              return (
                <CartaoDeCadastro
                  key={e.id}
                  titulo={`${e.crop} · ${e.name}`}
                  faixa={TIPOS_DE_ENSAIO[e.trial_type].cor}
                  linhas={[
                    [
                      e.plot_id ? talhaoPorId.get(e.plot_id)?.name : null,
                      fazendaPorId.get(e.farm_id)?.name,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    `Principal: ${resumo(principais)} · Concorrente: ${resumo(concorrentes)}`,
                    [
                      TIPOS_DE_ENSAIO[e.trial_type].rotulo,
                      e.implantation_date ? dataBr(e.implantation_date) : null,
                      `${nAval} ${nAval === 1 ? "avaliação" : "avaliações"}`,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  ]}
                  selos={
                    <span
                      className={
                        colhido
                          ? "text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                      }
                    >
                      {e.lifecycle === "completed"
                        ? "Concluído"
                        : colhido
                          ? "Colhido"
                          : "Conduzindo"}
                    </span>
                  }
                  aoAbrir={() => setAberto({ id: e.id })}
                  aoEditar={mexe ? () => setAberto({ id: e.id }) : undefined}
                  aoExcluir={mexe ? () => setExcluindo(e) : undefined}
                  acoesExtras={[
                    {
                      rotulo: "Relatório",
                      aoEscolher: () =>
                        void gerarRelatorioDoEnsaio(dadosDoEnsaio(e, d, c)),
                    },
                    ...(mexe
                      ? e.lifecycle === "active"
                        ? [
                            {
                              rotulo: "Concluir",
                              aoEscolher: () =>
                                void mudarSituacao(e, "completed"),
                            },
                          ]
                        : [
                            {
                              rotulo: "Reativar",
                              aoEscolher: () => void mudarSituacao(e, "active"),
                            },
                          ]
                      : []),
                  ]}
                />
              );
            })}
          </GradeDeCartoes>
          {lista.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">
              Nenhum ensaio com esses filtros.
            </p>
          )}
        </>
      )}

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={async () => {
          if (!excluindo) return;
          setApagando(true);
          const res = await d.excluir("farm_trials", excluindo.id);
          setApagando(false);
          if (res.ok) {
            toast.success("Ensaio excluído");
            setExcluindo(null);
          } else toast.error(res.erro);
        }}
        title="Excluir Ensaio"
        itemName={excluindo ? `"${excluindo.name}"` : undefined}
        loading={apagando}
        cascadeItems={
          excluindo
            ? [
                {
                  label: "Produtos",
                  count: d.produtos.filter((p) => p.trial_id === excluindo.id)
                    .length,
                },
                {
                  label: "Avaliações",
                  count: d.avaliacoes.filter((a) => a.trial_id === excluindo.id)
                    .length,
                },
                {
                  label: "Colheitas",
                  count: d.colheitas.filter((h) => h.trial_id === excluindo.id)
                    .length,
                },
              ]
            : undefined
        }
      />
    </div>
  );
}
