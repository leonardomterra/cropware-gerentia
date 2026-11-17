import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import Plant from "~icons/ph/plant-duotone";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
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
import { GddDoPlantio } from "../components/GddDoPlantio";
import { usePermissoesDoCampo } from "../hooks/usePermissoesDoCampo";
import {
  CartaoDeCadastro,
  Campo,
  GradeDeCartoes,
} from "../components/Cadastro";
import { BotaoNovo, BuscaDaLista } from "../components/BuscaDaLista";
import {
  CATEGORIAS_DE_SEMENTE,
  CICLOS,
  CULTURAS,
  FINALIDADES,
  identidadeDoPlantio,
  periodoDoPlantio,
  type CicloDeVida,
  type Finalidade,
} from "../dominio/plantios";
import { areaDoPlantio, dentroDaJanela } from "../dominio/custo";
import { formatarArea } from "../geo/geometria";
import { lerNumero, normalizarNome, numeroParaCampo } from "../utils/nomes";
import type { Plantio } from "../types";

interface Form {
  plot_id: string;
  season_id: string;
  crop: string;
  variety: string;
  purpose: Finalidade;
  lifecycle: CicloDeVida;
  planting_date: string;
  expected_harvest_date: string;
  population: string;
  population_unit: "plantas_ha" | "kg_ha";
  area_type: "total" | "partial";
  partial_area: string;
  seed_category_planted: string;
  seed_category_harvested: string;
  seed_homologation: string;
  notes: string;
}

const hojeIso = () => new Date().toISOString().slice(0, 10);

/**
 * Plantios — talhão × safra × cultura. Portado do Flag Field (PlantingForm +
 * PlantingManagement), sem os campos de ensaio (que vão para a fase de DM) e
 * sem o painel de gráficos (fase de relatórios).
 */
export default function PlantiosPage() {
  const c = useCadastros();
  const navigate = useNavigate();
  const { podeCriar, podeMexer } = usePermissoesDoCampo();
  const [busca, setBusca] = useState("");
  const [fSafra, setFSafra] = useState("todas");
  const [fFazenda, setFFazenda] = useState("todas");
  const [fCiclo, setFCiclo] = useState<"todos" | CicloDeVida>("todos");
  const [aberto, setAberto] = useState<"novo" | Plantio | null>(null);
  const [leitura, setLeitura] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Plantio | null>(null);
  const [apagando, setApagando] = useState(false);

  const talhaoPorId = useMemo(
    () => new Map(c.talhoes.map((t) => [t.id, t])),
    [c.talhoes],
  );
  const fazendaPorId = useMemo(
    () => new Map(c.fazendas.map((f) => [f.id, f])),
    [c.fazendas],
  );
  const safraPorId = useMemo(
    () => new Map(c.safras.map((s) => [s.id, s])),
    [c.safras],
  );
  const safraAtual =
    c.safras.find((s) => dentroDaJanela(hojeIso(), s))?.id ?? "";

  const ondeFica = (plotId: string) => {
    const t = talhaoPorId.get(plotId);
    const f = t ? fazendaPorId.get(t.farm_id) : null;
    return t ? `${t.name} · ${f?.name ?? "—"}` : "—";
  };

  /** Hectares livres do talhão: tira os outros plantios EM ANDAMENTO. */
  const livreNoTalhao = (plotId: string, ignorar?: string) => {
    const t = talhaoPorId.get(plotId);
    if (!t) return 0;
    const ocupado = c.plantios
      .filter(
        (p) =>
          p.plot_id === plotId && p.id !== ignorar && p.lifecycle === "active",
      )
      .reduce((s, p) => s + areaDoPlantio(p, t.area_ha), 0);
    return Math.max(0, t.area_ha - ocupado);
  };

  const lista = useMemo(() => {
    const alvo = normalizarNome(busca);
    return c.plantios.filter((p) => {
      const t = talhaoPorId.get(p.plot_id);
      return (
        (fSafra === "todas" || p.season_id === fSafra) &&
        (fFazenda === "todas" || t?.farm_id === fFazenda) &&
        (fCiclo === "todos" || p.lifecycle === fCiclo) &&
        (!alvo ||
          normalizarNome(
            `${p.crop} ${p.variety ?? ""} ${t?.name ?? ""}`,
          ).includes(alvo))
      );
    });
  }, [c.plantios, busca, fSafra, fFazenda, fCiclo, talhaoPorId]);

  const variedadesSugeridas = useMemo(() => {
    if (!form?.crop) return [];
    return [
      ...new Set(
        c.plantios
          .filter((p) => p.crop === form.crop && p.variety)
          .map((p) => p.variety!),
      ),
    ];
  }, [c.plantios, form?.crop]);

  const editando = aberto !== null && aberto !== "novo" ? aberto : null;

  function abrir(p: Plantio | "novo", somenteLer: boolean) {
    setAberto(p);
    setLeitura(somenteLer);
    setForm(
      p === "novo"
        ? {
            plot_id: "",
            season_id: fSafra !== "todas" ? fSafra : safraAtual,
            crop: "",
            variety: "",
            purpose: "grain_production",
            lifecycle: "active",
            planting_date: "",
            expected_harvest_date: "",
            population: "",
            population_unit: "plantas_ha",
            area_type: "total",
            partial_area: "",
            seed_category_planted: "",
            seed_category_harvested: "",
            seed_homologation: "",
            notes: "",
          }
        : {
            plot_id: p.plot_id,
            season_id: p.season_id ?? "",
            crop: p.crop,
            variety: p.variety ?? "",
            purpose: p.purpose,
            lifecycle: p.lifecycle,
            planting_date: p.planting_date ?? "",
            expected_harvest_date: p.expected_harvest_date ?? "",
            population: numeroParaCampo(p.population),
            population_unit: p.population_unit ?? "plantas_ha",
            area_type: p.area_type,
            partial_area: numeroParaCampo(p.partial_area_ha),
            seed_category_planted: p.seed_category_planted ?? "",
            seed_category_harvested: p.seed_category_harvested ?? "",
            seed_homologation: p.seed_homologation ?? "",
            notes: p.notes ?? "",
          },
    );
  }

  // `?abrir=<id>` — o Calendário manda para cá com o item a abrir (em leitura).
  const [params, setParams] = useSearchParams();
  const abrirId = params.get("abrir");
  useEffect(() => {
    if (!abrirId || c.carregando) return;
    const alvo = c.plantios.find((x) => x.id === abrirId);
    if (alvo) abrir(alvo, true);
    setParams((p) => {
      p.delete("abrir");
      return p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId, c.carregando]);

  async function salvar() {
    if (!form || !form.plot_id || !form.crop) return;
    const parcial =
      form.area_type === "partial" ? lerNumero(form.partial_area) : null;
    if (form.area_type === "partial" && !(parcial && parcial > 0)) {
      toast.error("Informe a área do plantio em hectares.");
      return;
    }
    const semente = form.purpose === "seed_field";
    const t = (v: string) => v.trim() || null;
    setSalvando(true);
    const res = await c.salvarPlantio(
      {
        plot_id: form.plot_id,
        season_id: form.season_id || null,
        crop: form.crop,
        variety: t(form.variety),
        purpose: form.purpose,
        lifecycle: form.lifecycle,
        completed_at:
          form.lifecycle === "completed"
            ? (editando?.completed_at ?? new Date().toISOString())
            : null,
        planting_date: form.planting_date || null,
        expected_harvest_date: form.expected_harvest_date || null,
        population: lerNumero(form.population),
        population_unit: form.population ? form.population_unit : null,
        area_type: form.area_type,
        partial_area_ha: parcial,
        seed_category_planted: semente ? t(form.seed_category_planted) : null,
        seed_category_harvested: semente
          ? t(form.seed_category_harvested)
          : null,
        seed_homologation: semente ? t(form.seed_homologation) : null,
        notes: t(form.notes),
      },
      editando?.id,
    );
    setSalvando(false);
    if (res.ok) {
      toast.success(editando ? "Plantio atualizado" : "Plantio cadastrado");
      setAberto(null);
    } else toast.error(res.erro);
  }

  async function mudarCiclo(p: Plantio, lifecycle: CicloDeVida) {
    const res = await c.salvarPlantio(
      {
        lifecycle,
        completed_at:
          lifecycle === "completed" ? new Date().toISOString() : null,
      },
      p.id,
    );
    if (res.ok)
      toast.success(
        lifecycle === "completed" ? "Plantio concluído" : "Plantio reativado",
      );
    else toast.error(res.erro);
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    const res = await c.excluirPlantio(excluindo.id);
    setApagando(false);
    if (res.ok) {
      toast.success("Plantio excluído");
      setExcluindo(null);
      setAberto(null);
    } else toast.error(res.erro);
  }

  // ---- Formulário ----------------------------------------------------------
  if (aberto && form) {
    const t = talhaoPorId.get(form.plot_id);
    const livre = form.plot_id ? livreNoTalhao(form.plot_id, editando?.id) : 0;
    const set = <K extends keyof Form>(k: K, v: Form[K]) =>
      setForm((s) => (s ? { ...s, [k]: v } : s));
    return (
      <PaginaDeFormulario
        formId="form-plantio"
        rotuloSalvar={editando ? "Salvar" : "Cadastrar Plantio"}
        descricao={editando ? identidadeDoPlantio(editando) : "Novo plantio"}
        somenteLeitura={leitura}
        aoEditar={
          editando && podeMexer(editando) ? () => setLeitura(false) : undefined
        }
        aoVoltar={() => setAberto(null)}
        salvando={salvando}
      >
        <form
          id="form-plantio"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Campo rotulo="Talhão" obrigatorio>
            <SearchableSelect
              options={c.talhoes.map((x) => ({
                value: x.id,
                label: ondeFica(x.id),
              }))}
              value={form.plot_id}
              onValueChange={(v) => set("plot_id", v)}
              placeholder={
                c.talhoes.length
                  ? "Escolha o talhão"
                  : "Cadastre um talhão antes"
              }
              searchPlaceholder="Buscar talhão..."
              emptyMessage="Nenhum talhão."
              disabled={leitura}
            />
            {t && (
              <p className="text-xs text-slate-500">
                {formatarArea(livre)} livres de {formatarArea(t.area_ha)}
              </p>
            )}
          </Campo>
          <Campo
            rotulo="Safra"
            ajuda="Cadastre as safras em Field → Safras. O custo por talhão é visto por safra."
          >
            <SearchableSelect
              options={[
                { value: "", label: "Sem safra" },
                ...c.safras.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={form.season_id}
              onValueChange={(v) => set("season_id", v)}
              searchPlaceholder="Buscar safra..."
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Cultura" obrigatorio>
            <Select value={form.crop} onValueChange={(v) => set("crop", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Cultura" />
              </SelectTrigger>
              <SelectContent>
                {CULTURAS.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Variedade / híbrido" htmlFor="pl-var">
            <Input
              id="pl-var"
              list="pl-var-sugestoes"
              value={form.variety}
              onChange={(e) => set("variety", e.target.value)}
            />
            <datalist id="pl-var-sugestoes">
              {variedadesSugeridas.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Data de plantio" htmlFor="pl-ini">
            <Input
              id="pl-ini"
              type="date"
              value={form.planting_date}
              onChange={(e) => set("planting_date", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Previsão de colheita" htmlFor="pl-fim">
            <Input
              id="pl-fim"
              type="date"
              value={form.expected_harvest_date}
              onChange={(e) => set("expected_harvest_date", e.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Finalidade"
            obrigatorio
            ajuda="Produção de grãos para a lavoura comercial; campo demonstrativo e GD para trabalho de desenvolvimento de mercado."
          >
            <Select
              value={form.purpose}
              onValueChange={(v) => set("purpose", v as Finalidade)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FINALIDADES).map(([v, x]) => (
                  <SelectItem key={v} value={v}>
                    {x.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Situação" obrigatorio>
            <Select
              value={form.lifecycle}
              onValueChange={(v) => set("lifecycle", v as CicloDeVida)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CICLOS).map(([v, r]) => (
                  <SelectItem key={v} value={v}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="População" htmlFor="pl-pop">
            <div className="flex gap-2">
              <Input
                id="pl-pop"
                inputMode="decimal"
                value={form.population}
                onChange={(e) => set("population", e.target.value)}
                className="flex-1"
              />
              <Select
                value={form.population_unit}
                onValueChange={(v) =>
                  set("population_unit", v as Form["population_unit"])
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plantas_ha">plantas/ha</SelectItem>
                  <SelectItem value="kg_ha">kg/ha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Campo>
          <Campo rotulo="Área do plantio">
            <div className="flex gap-2">
              <Select
                value={form.area_type}
                onValueChange={(v) => set("area_type", v as Form["area_type"])}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Talhão inteiro</SelectItem>
                  <SelectItem value="partial">Parte (ha)</SelectItem>
                </SelectContent>
              </Select>
              {form.area_type === "partial" && (
                <Input
                  inputMode="decimal"
                  value={form.partial_area}
                  onChange={(e) => set("partial_area", e.target.value)}
                  placeholder="ha"
                  className="flex-1"
                />
              )}
            </div>
          </Campo>
          {form.purpose === "seed_field" && (
            <>
              <Campo rotulo="Categoria plantada">
                <Select
                  value={form.seed_category_planted}
                  onValueChange={(v) => set("seed_category_planted", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DE_SEMENTE.map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo rotulo="Categoria colhida">
                <Select
                  value={form.seed_category_harvested}
                  onValueChange={(v) => set("seed_category_harvested", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DE_SEMENTE.map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo
                rotulo="Homologação / protocolo"
                htmlFor="pl-hom"
                className="sm:col-span-2"
              >
                <Input
                  id="pl-hom"
                  value={form.seed_homologation}
                  onChange={(e) => set("seed_homologation", e.target.value)}
                />
              </Campo>
            </>
          )}
          {/* GDD só ao ver um plantio já salvo (fase 5). */}
          {leitura && editando && (
            <div className="sm:col-span-2">
              <GddDoPlantio
                plantio={editando}
                fazenda={t ? (fazendaPorId.get(t.farm_id) ?? null) : null}
                talhoes={c.talhoes}
              />
            </div>
          )}
          <Campo
            rotulo="Observações"
            htmlFor="pl-obs"
            className="sm:col-span-2"
          >
            <Textarea
              id="pl-obs"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Campo>
        </form>
      </PaginaDeFormulario>
    );
  }

  // ---- Lista ---------------------------------------------------------------
  const filtrosAtivos =
    Boolean(busca) ||
    fSafra !== "todas" ||
    fFazenda !== "todas" ||
    fCiclo !== "todos";
  return (
    <div className="space-y-3">
      <BarraDeTela
        buscaAtiva={Boolean(busca)}
        busca={
          <BuscaDaLista
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar cultura, variedade ou talhão..."
          />
        }
        campos={[
          {
            rotulo: "Safra",
            ativo: fSafra !== "todas",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todas", label: "Todas as safras" },
                  ...c.safras.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={fSafra}
                onValueChange={(v) => setFSafra(v || "todas")}
              />
            ),
          },
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
            rotulo: "Situação",
            ativo: fCiclo !== "todos",
            campo: (
              <Select
                value={fCiclo}
                onValueChange={(v) => setFCiclo(v as typeof fCiclo)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as situações</SelectItem>
                  {Object.entries(CICLOS).map(([v, r]) => (
                    <SelectItem key={v} value={v}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ),
          },
        ]}
        acaoPrincipal={
          podeCriar ? (
            <BotaoNovo
              rotulo="Novo Plantio"
              onClick={() => abrir("novo", false)}
            />
          ) : undefined
        }
      />

      {c.carregando ? (
        <LoadingState />
      ) : c.plantios.length === 0 ? (
        <EmptyStateCard
          icon={Plant}
          title="Nenhum plantio cadastrado"
          description={
            c.talhoes.length
              ? "Cadastre o plantio de cada talhão na safra para acompanhar atividades e custos."
              : "Cadastre fazenda e talhões antes; o plantio fica dentro do talhão."
          }
        />
      ) : (
        <>
          <ItemsCount
            count={lista.length}
            totalCount={c.plantios.length}
            itemLabel="plantio"
            itemLabelPlural="plantios"
            showClearFilters={filtrosAtivos}
            onClearFilters={() => {
              setBusca("");
              setFSafra("todas");
              setFFazenda("todas");
              setFCiclo("todos");
            }}
          />
          <GradeDeCartoes>
            {lista.map((p) => {
              const mexe = podeMexer(p);
              const t = talhaoPorId.get(p.plot_id);
              return (
                <CartaoDeCadastro
                  key={p.id}
                  titulo={identidadeDoPlantio(p)}
                  faixa={FINALIDADES[p.purpose].cor}
                  linhas={[
                    ondeFica(p.plot_id),
                    [
                      p.season_id
                        ? safraPorId.get(p.season_id)?.name
                        : "Sem safra",
                      periodoDoPlantio(p),
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    [
                      t ? formatarArea(areaDoPlantio(p, t.area_ha)) : null,
                      FINALIDADES[p.purpose].rotulo,
                      CICLOS[p.lifecycle],
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  ]}
                  aoAbrir={() => abrir(p, true)}
                  aoEditar={mexe ? () => abrir(p, false) : undefined}
                  aoExcluir={mexe ? () => setExcluindo(p) : undefined}
                  acoesExtras={[
                    ...(mexe
                      ? p.lifecycle === "completed"
                        ? [
                            {
                              rotulo: "Reativar",
                              aoEscolher: () => void mudarCiclo(p, "active"),
                            },
                          ]
                        : [
                            {
                              rotulo: "Concluir",
                              aoEscolher: () => void mudarCiclo(p, "completed"),
                            },
                          ]
                      : []),
                    // Campo demonstrativo / GD: o ensaio nasce ligado a este plantio.
                    ...(podeCriar &&
                    (p.purpose === "demo_field" ||
                      p.purpose === "gd_commercial")
                      ? [
                          {
                            rotulo: "Criar ensaio neste plantio",
                            aoEscolher: () =>
                              navigate(`/campo/ensaios?plantio=${p.id}`),
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
              Nenhum plantio encontrado com esses filtros.
            </p>
          )}
        </>
      )}

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Excluir Plantio"
        itemName={excluindo ? `"${identidadeDoPlantio(excluindo)}"` : undefined}
        loading={apagando}
      />
    </div>
  );
}
