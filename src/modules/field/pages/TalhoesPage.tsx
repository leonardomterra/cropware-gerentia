import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { COR } from "@/lib/paleta";
import PencilSimple from "~icons/ph/pencil-simple";
import MapTrifold from "~icons/ph/map-trifold";
import Trash from "~icons/ph/trash";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { useCadastros, contarLancamentosLigados } from "../hooks/useCadastros";
import { usePermissoesDoCampo } from "../hooks/usePermissoesDoCampo";
import {
  CartaoDeCadastro,
  Campo,
  GradeDeCartoes,
} from "../components/Cadastro";
import { BotaoNovo, BuscaDaLista } from "../components/BuscaDaLista";
import { Miniatura } from "../components/mapa/Miniatura";
import { PreviaDoTalhao } from "../components/mapa/PreviaDoTalhao";
import { EditorDeTalhao } from "../components/mapa/EditorDeTalhao";
import {
  areaHa,
  deGeoJson,
  formatarArea,
  paraGeoJson,
  type LatLng,
} from "../geo/geometria";
import {
  acharRepetido,
  lerNumero,
  normalizarNome,
  numeroParaCampo,
} from "../utils/nomes";
import type { Irrigacao, Talhao } from "../types";

/** Cores da paleta do app (src/lib/paleta.ts): âmbar (seca) e céu (água). */
const IRRIGACAO: Record<Irrigacao, { rotulo: string; cor: string }> = {
  sequeiro: { rotulo: "Sequeiro", cor: COR.amber },
  irrigado: { rotulo: "Irrigado", cor: COR.sky },
};

interface Form {
  name: string;
  farm_id: string;
  irrigation: Irrigacao;
  pontos: LatLng[];
  /** Área digitada — só vale sem desenho ou com marcador. */
  areaManual: string;
  notes: string;
}

/** Área que vale: a do polígono desenhado, ou a digitada. */
function areaDoForm(f: Form): number | null {
  if (f.pontos.length >= 3) return Math.round(areaHa(f.pontos) * 100) / 100;
  return lerNumero(f.areaManual);
}

/**
 * Talhões — o coração do módulo Field. Cada talhão é de uma fazenda e tem a
 * área do desenho (polígono/pivô) ou digitada (marcador ou sem desenho).
 * Portado do Flag Field (PlotManagement), sem CSV, ações em lote e o cartão de
 * "dados vinculados" — que ficaram para quando houver plantios e atividades.
 */
export default function TalhoesPage() {
  const c = useCadastros();
  const navigate = useNavigate();
  const { podeCriar, podeMexer, comProdutores } = usePermissoesDoCampo();
  const [busca, setBusca] = useState("");
  const [fFazenda, setFFazenda] = useState("todas");
  const [fProdutor, setFProdutor] = useState("todos");
  const [aberto, setAberto] = useState<"novo" | Talhao | null>(null);
  const [leitura, setLeitura] = useState(false);
  const [noMapa, setNoMapa] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<{
    t: Talhao;
    lancamentos: number;
  } | null>(null);
  const [apagando, setApagando] = useState(false);

  const fazendaPorId = useMemo(
    () => new Map(c.fazendas.map((f) => [f.id, f])),
    [c.fazendas],
  );
  const produtorPorId = useMemo(
    () => new Map(c.produtores.map((p) => [p.id, p.name])),
    [c.produtores],
  );
  const contornos = useMemo(
    () => new Map(c.talhoes.map((t) => [t.id, deGeoJson(t.geometry)])),
    [c.talhoes],
  );

  const rotuloDaFazenda = (id: string) => {
    const f = fazendaPorId.get(id);
    if (!f) return "—";
    const p =
      comProdutores && f.producer_id ? produtorPorId.get(f.producer_id) : null;
    return p ? `${f.name} · ${p}` : f.name;
  };

  const lista = useMemo(() => {
    const alvo = normalizarNome(busca);
    return c.talhoes.filter((t) => {
      const f = fazendaPorId.get(t.farm_id);
      return (
        (fFazenda === "todas" || t.farm_id === fFazenda) &&
        (fProdutor === "todos" || f?.producer_id === fProdutor) &&
        (!alvo || normalizarNome(t.name).includes(alvo))
      );
    });
  }, [c.talhoes, busca, fFazenda, fProdutor, fazendaPorId]);
  const somaHa = lista.reduce((s, t) => s + t.area_ha, 0);

  const editando = aberto !== null && aberto !== "novo" ? aberto : null;
  const vizinhosDoForm = useMemo(() => {
    if (!form?.farm_id) return [];
    return c.talhoes
      .filter((t) => t.farm_id === form.farm_id && t.id !== editando?.id)
      .map((t) => ({ nome: t.name, pontos: contornos.get(t.id) ?? [] }))
      .filter((v) => v.pontos.length >= 3);
  }, [c.talhoes, contornos, form?.farm_id, editando?.id]);
  const vizinhosSoPontos = useMemo(
    () => vizinhosDoForm.map((v) => v.pontos),
    [vizinhosDoForm],
  );

  function abrir(t: Talhao | "novo", somenteLer: boolean) {
    setAberto(t);
    setLeitura(somenteLer);
    setNoMapa(false);
    setForm(
      t === "novo"
        ? {
            name: "",
            farm_id:
              fFazenda !== "todas"
                ? fFazenda
                : c.fazendas.length === 1
                  ? c.fazendas[0].id
                  : "",
            irrigation: "sequeiro",
            pontos: [],
            areaManual: "",
            notes: "",
          }
        : {
            name: t.name,
            farm_id: t.farm_id,
            irrigation: t.irrigation,
            pontos: contornos.get(t.id) ?? [],
            areaManual: numeroParaCampo(t.area_ha),
            notes: t.notes ?? "",
          },
    );
  }

  async function salvar() {
    if (!form) return;
    const repetido = acharRepetido(
      c.talhoes.filter((t) => t.farm_id === form.farm_id),
      form.name,
      editando?.id,
    );
    if (!form.name.trim() || !form.farm_id || repetido) return;
    const area = areaDoForm(form);
    if (area == null || !(area > 0)) {
      toast.error(
        "Informe a área do talhão (em hectares) ou desenhe o contorno.",
      );
      return;
    }
    setSalvando(true);
    const res = await c.salvarTalhao(
      {
        name: form.name.trim(),
        farm_id: form.farm_id,
        irrigation: form.irrigation,
        area_ha: area,
        geometry: paraGeoJson(form.pontos),
        notes: form.notes.trim() || null,
      },
      editando?.id,
    );
    setSalvando(false);
    if (res.ok) {
      toast.success(editando ? "Talhão atualizado" : "Talhão cadastrado");
      setAberto(null);
    } else toast.error(res.erro);
  }

  async function pedirExclusao(t: Talhao) {
    setExcluindo({
      t,
      lancamentos: await contarLancamentosLigados({ plotIds: [t.id] }),
    });
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    const res = await c.excluirTalhao(excluindo.t.id);
    setApagando(false);
    if (res.ok) {
      toast.success("Talhão excluído");
      setExcluindo(null);
      setAberto(null);
    } else toast.error(res.erro);
  }

  const opcoesFazenda = c.fazendas.map((f) => ({
    value: f.id,
    label: rotuloDaFazenda(f.id),
  }));

  // ---- Editor do mapa (página inteira, por cima do formulário) ------------
  if (aberto && form && noMapa) {
    const sedeF = fazendaPorId.get(form.farm_id);
    return (
      <EditorDeTalhao
        inicial={form.pontos}
        vizinhos={vizinhosDoForm}
        sede={
          sedeF?.latitude != null && sedeF.longitude != null
            ? [sedeF.latitude, sedeF.longitude]
            : null
        }
        aoVoltar={() => setNoMapa(false)}
        aoAplicar={(pontos) => {
          setForm((s) => (s ? { ...s, pontos } : s));
          setNoMapa(false);
        }}
      />
    );
  }

  // ---- Formulário ----------------------------------------------------------
  if (aberto && form) {
    const repetido = acharRepetido(
      c.talhoes.filter((t) => t.farm_id === form.farm_id),
      form.name,
      editando?.id,
    );
    const temPoligono = form.pontos.length >= 3;
    return (
      <PaginaDeFormulario
        formId="form-talhao"
        rotuloSalvar={editando ? "Salvar" : "Cadastrar Talhão"}
        descricao={editando ? editando.name : "Novo talhão"}
        somenteLeitura={leitura}
        aoEditar={
          editando && podeMexer(editando) ? () => setLeitura(false) : undefined
        }
        aoVoltar={() => setAberto(null)}
        salvando={salvando}
      >
        <form
          id="form-talhao"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Campo
            rotulo="Nome"
            htmlFor="t-nome"
            obrigatorio
            erro={
              repetido
                ? "Já existe um talhão com esse nome nesta fazenda."
                : null
            }
          >
            <Input
              id="t-nome"
              value={form.name}
              onChange={(e) =>
                setForm((s) => s && { ...s, name: e.target.value })
              }
              maxLength={80}
              placeholder="Talhão 01, Pivô 3..."
              required
            />
          </Campo>
          <Campo rotulo="Fazenda" obrigatorio>
            <SearchableSelect
              options={opcoesFazenda}
              value={form.farm_id}
              onValueChange={(v) => setForm((s) => s && { ...s, farm_id: v })}
              placeholder={
                opcoesFazenda.length
                  ? "Escolha a fazenda"
                  : "Cadastre uma fazenda antes"
              }
              searchPlaceholder="Buscar fazenda..."
              emptyMessage="Nenhuma fazenda."
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Irrigação" obrigatorio>
            <Select
              value={form.irrigation}
              onValueChange={(v) =>
                setForm((s) => s && { ...s, irrigation: v as Irrigacao })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequeiro">Sequeiro</SelectItem>
                <SelectItem value="irrigado">Irrigado</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo
            rotulo="Área (ha)"
            htmlFor="t-area"
            obrigatorio={!temPoligono}
            ajuda="Com o contorno desenhado, a área é calculada do desenho. Sem desenho (ou só com marcador), digite a área."
          >
            {temPoligono ? (
              <div className="h-9 px-3 flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 tabular-nums">
                {formatarArea(areaDoForm(form) ?? 0)}
                <span className="ml-1.5 text-slate-400">(do desenho)</span>
              </div>
            ) : (
              <Input
                id="t-area"
                inputMode="decimal"
                value={form.areaManual}
                onChange={(e) =>
                  setForm((s) => s && { ...s, areaManual: e.target.value })
                }
                placeholder="0,00"
              />
            )}
          </Campo>

          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-slate-700">Contorno no mapa</span>
              {!leitura && (
                <div className="flex gap-2">
                  {form.pontos.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((s) => s && { ...s, pontos: [] })}
                    >
                      <Trash className="size-4 mr-1.5" />
                      Remover
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!form.farm_id}
                    title={form.farm_id ? undefined : "Escolha a fazenda antes"}
                    onClick={() => setNoMapa(true)}
                  >
                    {form.pontos.length ? (
                      <PencilSimple className="size-4 mr-1.5" />
                    ) : (
                      <MapTrifold className="size-4 mr-1.5" />
                    )}
                    {form.pontos.length ? "Editar desenho" : "Desenhar no mapa"}
                  </Button>
                </div>
              )}
            </div>
            {form.pontos.length > 0 ? (
              <PreviaDoTalhao
                pontos={form.pontos}
                vizinhos={vizinhosSoPontos}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Sem desenho. Desenhe o contorno, marque o pivô ou importe um
                KML/KMZ — ou só informe a área.
              </div>
            )}
          </div>

          <Campo rotulo="Observações" htmlFor="t-obs" className="sm:col-span-2">
            <Textarea
              id="t-obs"
              rows={3}
              value={form.notes}
              onChange={(e) =>
                setForm((s) => s && { ...s, notes: e.target.value })
              }
              placeholder="Solo, histórico, particularidades..."
            />
          </Campo>
        </form>
      </PaginaDeFormulario>
    );
  }

  // ---- Lista ---------------------------------------------------------------
  const opcoesFiltroFazenda = c.fazendas
    .filter((f) => fProdutor === "todos" || f.producer_id === fProdutor)
    .map((f) => ({ value: f.id, label: f.name }));
  const filtrosAtivos =
    Boolean(busca) || fFazenda !== "todas" || fProdutor !== "todos";

  return (
    <div className="space-y-3">
      <BarraDeTela
        buscaAtiva={Boolean(busca)}
        busca={
          <BuscaDaLista
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar talhão..."
          />
        }
        campos={[
          ...(comProdutores
            ? [
                {
                  rotulo: "Produtor",
                  ativo: fProdutor !== "todos",
                  campo: (
                    <SearchableSelect
                      options={[
                        { value: "todos", label: "Todos os produtores" },
                        ...c.produtores.map((p) => ({
                          value: p.id,
                          label: p.name,
                        })),
                      ]}
                      value={fProdutor}
                      onValueChange={(v) => {
                        setFProdutor(v || "todos");
                        setFFazenda("todas");
                      }}
                      searchPlaceholder="Buscar produtor..."
                    />
                  ),
                },
              ]
            : []),
          {
            rotulo: "Fazenda",
            ativo: fFazenda !== "todas",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todas", label: "Todas as fazendas" },
                  ...opcoesFiltroFazenda,
                ]}
                value={fFazenda}
                onValueChange={(v) => setFFazenda(v || "todas")}
                searchPlaceholder="Buscar fazenda..."
              />
            ),
          },
        ]}
        acaoPrincipal={
          podeCriar ? (
            <BotaoNovo
              rotulo="Novo Talhão"
              onClick={() => abrir("novo", false)}
            />
          ) : undefined
        }
      />

      {c.carregando ? (
        <LoadingState />
      ) : c.talhoes.length === 0 ? (
        <EmptyStateCard
          title="Nenhum talhão cadastrado"
          description={
            c.fazendas.length
              ? "Cadastre os talhões desenhando no mapa, importando um KML ou só com a área."
              : "Cadastre uma fazenda antes; os talhões ficam dentro dela."
          }
        />
      ) : (
        <>
          <ItemsCount
            count={lista.length}
            totalCount={c.talhoes.length}
            itemLabel="talhão"
            itemLabelPlural="talhões"
            headerSuffix={`· ${formatarArea(somaHa)}`}
            showClearFilters={filtrosAtivos}
            onClearFilters={() => {
              setBusca("");
              setFFazenda("todas");
              setFProdutor("todos");
            }}
          />
          <GradeDeCartoes>
            {lista.map((t) => {
              const mexe = podeMexer(t);
              const outros = c.talhoes
                .filter((o) => o.farm_id === t.farm_id && o.id !== t.id)
                .map((o) => contornos.get(o.id) ?? [])
                .filter((p) => p.length >= 3);
              const contorno = contornos.get(t.id) ?? [];
              return (
                <CartaoDeCadastro
                  key={t.id}
                  titulo={t.name}
                  faixa={IRRIGACAO[t.irrigation].cor}
                  miniatura={
                    <Miniatura
                      destaque={contorno.length ? [contorno] : []}
                      outros={outros}
                      className="size-16"
                    />
                  }
                  linhas={[
                    rotuloDaFazenda(t.farm_id),
                    `${formatarArea(t.area_ha)} · ${IRRIGACAO[t.irrigation].rotulo}`,
                  ]}
                  aoAbrir={() => abrir(t, true)}
                  aoEditar={mexe ? () => abrir(t, false) : undefined}
                  aoExcluir={mexe ? () => void pedirExclusao(t) : undefined}
                  acoesExtras={
                    t.geometry?.type === "Polygon"
                      ? [
                          {
                            rotulo: "Ver NDVI",
                            aoEscolher: () =>
                              navigate(`/campo/ndvi?talhao=${t.id}`),
                          },
                        ]
                      : []
                  }
                />
              );
            })}
          </GradeDeCartoes>
          {lista.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">
              Nenhum talhão encontrado com esses filtros.
            </p>
          )}
        </>
      )}

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Excluir Talhão"
        itemName={excluindo ? `"${excluindo.t.name}"` : undefined}
        loading={apagando}
        cascadeItems={
          excluindo
            ? [
                {
                  label: "Lançamentos que perdem o vínculo (não são apagados)",
                  count: excluindo.lancamentos,
                },
              ]
            : undefined
        }
      />
    </div>
  );
}
