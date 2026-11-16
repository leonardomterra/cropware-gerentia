import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import ClipboardText from "~icons/ph/clipboard-text-duotone";
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
import { useAtividades, useCadastros } from "../hooks/useCadastros";
import { usePermissoesDoCampo } from "../hooks/usePermissoesDoCampo";
import {
  CartaoDeCadastro,
  Campo,
  GradeDeCartoes,
} from "../components/Cadastro";
import { BotaoNovo, BuscaDaLista } from "../components/BuscaDaLista";
import {
  EditorDeObservacoes,
  EditorDeProdutos,
} from "../components/EditoresDaAtividade";
import {
  linhaVazia,
  linhasDe,
  produtosDe,
  type LinhaDeProduto,
} from "../components/linhasDeProduto";
import { FormularioDeProduto } from "../components/FormularioDeProduto";
import {
  CATEGORIAS_DE_ANOTACAO,
  ESTADIOS,
  EVENTOS_CLIMATICOS,
  METODOS_DE_APLICACAO,
  METODOS_DE_COLHEITA,
  ORDEM_DOS_TIPOS,
  SERVICOS_DE_COLHEITA,
  TIPOS,
  TIPOS_DE_ADUBACAO,
  TIPOS_DE_CALCARIO,
  TIPOS_DE_GESSO,
  TIPOS_DE_VISITA,
  UNIDADES_DE_DOSE,
  UNIDADES_DE_PRODUTIVIDADE,
  type DetalhesDaAtividade,
  type ObservacaoDaAtividade,
  type TipoDeAtividade,
} from "../dominio/atividades";
import { identidadeDoPlantio } from "../dominio/plantios";
import {
  areaDaAtividade,
  areaDoPlantio,
  custoDaAtividade,
  custoPorHa,
  safraDaAtividade,
} from "../dominio/custo";
import { lerNumero, normalizarNome, numeroParaCampo } from "../utils/nomes";
import type { Atividade } from "../types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeIso = () => new Date().toISOString().slice(0, 10);
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Campos de `details` de cada tipo — o resto não é gravado (não vaza de um tipo para outro). */
const CAMPOS_DO_TIPO: Record<TipoDeAtividade, (keyof DetalhesDaAtividade)[]> = {
  spraying: ["metodo", "estadio"],
  fertilization: ["tipo_adubacao", "estadio"],
  liming: [
    "corretivo_tipo",
    "corretivo_dose",
    "corretivo_unidade",
    "corretivo_preco",
  ],
  plastering: [
    "corretivo_tipo",
    "corretivo_dose",
    "corretivo_unidade",
    "corretivo_preco",
  ],
  irrigation: ["lamina_mm", "custo_mm_ha"],
  harvest: [
    "colheita_metodo",
    "colheita_servico",
    "produtividade",
    "produtividade_unidade",
    "custo_ha",
  ],
  planting: ["custo_ha"],
  observation: [],
  annotation: ["categoria"],
  sampling: [],
  rain: ["chuva_mm"],
  climate: ["evento", "chuva_mm"],
  visit: ["visita_empresa", "visita_objetivo", "visita_tipo"],
};
const NUMERICOS = new Set<keyof DetalhesDaAtividade>([
  "corretivo_dose",
  "corretivo_preco",
  "lamina_mm",
  "custo_mm_ha",
  "custo_ha",
  "produtividade",
  "chuva_mm",
]);

interface Form {
  type: TipoDeAtividade;
  farm_id: string;
  plot_id: string;
  planting_id: string;
  date: string;
  status: "planejada" | "realizada";
  responsible: string;
  description: string;
  area_type: "total" | "partial";
  treated: string;
  produtos: LinhaDeProduto[];
  observacoes: ObservacaoDaAtividade[];
  /** Campos do tipo, como texto (números com vírgula). */
  det: Partial<Record<keyof DetalhesDaAtividade, string>>;
  notes: string;
}

function detalhesDe(f: Form): DetalhesDaAtividade {
  const d: Record<string, unknown> = {};
  for (const k of CAMPOS_DO_TIPO[f.type]) {
    const v = f.det[k];
    if (v == null || v === "") continue;
    d[k] = NUMERICOS.has(k) ? lerNumero(v) : v;
  }
  if (f.type === "observation") {
    d.observacoes = f.observacoes.filter((o) => o.categoria || o.alvo);
  }
  return d as DetalhesDaAtividade;
}

/** Atalho de select simples dentro do formulário. */
function Escolha({
  valor,
  aoMudar,
  opcoes,
  placeholder,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: string[];
  placeholder?: string;
}) {
  return (
    <Select value={valor} onValueChange={aoMudar}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "Escolha"} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Atividades de campo — aplicação, adubação, corretivos, colheita, observação,
 * chuva, visita... Um formulário só, com a seção de cada tipo, no lugar do
 * ActivityManagement de 3.600 linhas do Flag Field. O custo agronômico é
 * calculado aqui (dominio/custo.ts) e gravado em `cost_total`.
 *
 * Ficaram para depois (plano da fase 2): marcadores no mapa (observação,
 * anotação, amostragem), fotos/anexos e a agenda/calendário.
 */
export default function AtividadesPage() {
  const c = useCadastros();
  const a = useAtividades();
  const { podeCriar, podeMexer } = usePermissoesDoCampo();
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState("todos");
  const [fSafra, setFSafra] = useState("todas");
  const [fFazenda, setFFazenda] = useState("todas");
  const [fStatus, setFStatus] = useState("todos");
  const [aberto, setAberto] = useState<"novo" | Atividade | null>(null);
  const [leitura, setLeitura] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Atividade | null>(null);
  const [apagando, setApagando] = useState(false);
  /** Sub-página "cadastrar no catálogo" aberta a partir de uma linha de produto. */
  const [noCatalogo, setNoCatalogo] = useState<{
    chave: string;
    nome: string;
  } | null>(null);

  const fazendaPorId = useMemo(
    () => new Map(c.fazendas.map((f) => [f.id, f])),
    [c.fazendas],
  );
  const talhaoPorId = useMemo(
    () => new Map(c.talhoes.map((t) => [t.id, t])),
    [c.talhoes],
  );
  const plantioPorId = useMemo(
    () => new Map(c.plantios.map((p) => [p.id, p])),
    [c.plantios],
  );

  const safraDe = (x: Atividade) =>
    safraDaAtividade(
      x,
      (pid) => plantioPorId.get(pid)?.season_id ?? null,
      c.safras,
    );

  const lista = useMemo(() => {
    const alvo = normalizarNome(busca);
    return a.atividades.filter((x) => {
      if (fTipo !== "todos" && x.type !== fTipo) return false;
      if (fFazenda !== "todas" && x.farm_id !== fFazenda) return false;
      if (fStatus !== "todos" && x.status !== fStatus) return false;
      if (fSafra !== "todas" && safraDe(x) !== fSafra) return false;
      if (alvo) {
        const texto = `${TIPOS[x.type].rotulo} ${x.description ?? ""} ${x.products
          .map((p) => p.nome)
          .join(
            " ",
          )} ${x.plot_id ? (talhaoPorId.get(x.plot_id)?.name ?? "") : ""}`;
        if (!normalizarNome(texto).includes(alvo)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    a.atividades,
    busca,
    fTipo,
    fSafra,
    fFazenda,
    fStatus,
    talhaoPorId,
    plantioPorId,
    c.safras,
  ]);
  const somaCusto = lista.reduce(
    (s, x) => s + (x.status === "realizada" ? (x.cost_total ?? 0) : 0),
    0,
  );

  const editando = aberto !== null && aberto !== "novo" ? aberto : null;

  function abrir(x: Atividade | "novo", somenteLer: boolean) {
    setAberto(x);
    setLeitura(somenteLer);
    setNoCatalogo(null);
    if (x === "novo") {
      setForm({
        type: fTipo !== "todos" ? (fTipo as TipoDeAtividade) : "spraying",
        farm_id:
          fFazenda !== "todas"
            ? fFazenda
            : c.fazendas.length === 1
              ? c.fazendas[0].id
              : "",
        plot_id: "",
        planting_id: "",
        date: hojeIso(),
        status: "realizada",
        responsible: "",
        description: "",
        area_type: "total",
        treated: "",
        produtos: [linhaVazia()],
        observacoes: [{ categoria: "", alvo: "", severidade: "" }],
        det: {},
        notes: "",
      });
      return;
    }
    const det: Form["det"] = {};
    for (const [k, v] of Object.entries(x.details ?? {})) {
      if (k === "observacoes") continue;
      det[k as keyof DetalhesDaAtividade] =
        typeof v === "number" ? numeroParaCampo(v) : String(v ?? "");
    }
    setForm({
      type: x.type,
      farm_id: x.farm_id,
      plot_id: x.plot_id ?? "",
      planting_id: x.planting_id ?? "",
      date: x.date,
      status: x.status,
      responsible: x.responsible ?? "",
      description: x.description ?? "",
      area_type: x.area_type,
      treated: numeroParaCampo(x.treated_area_ha),
      produtos: x.products.length ? linhasDe(x.products) : [linhaVazia()],
      observacoes: x.details?.observacoes?.length
        ? x.details.observacoes
        : [{ categoria: "", alvo: "", severidade: "" }],
      det,
      notes: x.notes ?? "",
    });
  }

  /** Área do talhão/plantio escolhido — base da área "total". */
  function areaDoAlvo(f: Form): number | null {
    if (f.planting_id) {
      const p = plantioPorId.get(f.planting_id);
      const t = p ? talhaoPorId.get(p.plot_id) : null;
      if (p && t) return areaDoPlantio(p, t.area_ha);
    }
    if (f.plot_id) return talhaoPorId.get(f.plot_id)?.area_ha ?? null;
    return null;
  }

  async function salvar() {
    if (!form || !form.farm_id || !form.date) return;
    const info = TIPOS[form.type];
    if (!info.daFazenda && !form.plot_id) {
      toast.error("Escolha o talhão da atividade.");
      return;
    }
    const treated =
      form.area_type === "partial" ? lerNumero(form.treated) : null;
    if (form.area_type === "partial" && !(treated && treated > 0)) {
      toast.error("Informe a área tratada em hectares.");
      return;
    }
    const produtos = info.comProdutos ? produtosDe(form.produtos) : [];
    const details = detalhesDe(form);
    const area = areaDaAtividade({
      area_type: form.area_type,
      treated_area_ha: treated,
      areaDoAlvo: areaDoAlvo(form),
    });
    setSalvando(true);
    const res = await a.salvarAtividade(
      {
        type: form.type,
        farm_id: form.farm_id,
        plot_id: form.plot_id || null,
        planting_id: info.daFazenda ? null : form.planting_id || null,
        date: form.date,
        status: form.status,
        responsible: form.responsible.trim() || null,
        description: form.description.trim() || null,
        area_type: form.area_type,
        treated_area_ha: treated,
        products: produtos,
        cost_total: info.comCusto
          ? custoDaAtividade(form.type, produtos, details, area)
          : null,
        details,
        notes: form.notes.trim() || null,
      },
      editando?.id,
    );
    setSalvando(false);
    if (res.ok) {
      toast.success(editando ? "Atividade atualizada" : "Atividade registrada");
      setAberto(null);
    } else toast.error(res.erro);
  }

  async function marcarRealizada(x: Atividade) {
    const res = await a.salvarAtividade({ status: "realizada" }, x.id);
    if (res.ok) toast.success("Atividade marcada como realizada");
    else toast.error(res.erro);
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    const res = await a.excluirAtividade(excluindo.id);
    setApagando(false);
    if (res.ok) {
      toast.success("Atividade excluída");
      setExcluindo(null);
      setAberto(null);
    } else toast.error(res.erro);
  }

  // ---- Sub-página: cadastrar produto no catálogo sem perder a atividade ----
  if (aberto && form && noCatalogo) {
    return (
      <FormularioDeProduto
        produto={null}
        produtos={c.produtos}
        nomeInicial={noCatalogo.nome}
        categoriaInicial={
          form.type === "fertilization" ? "fertilizantes" : "defensivos"
        }
        salvar={c.salvarProduto}
        aoVoltar={() => setNoCatalogo(null)}
        aoSalvo={(id, nome) => {
          setForm((s) =>
            s
              ? {
                  ...s,
                  produtos: s.produtos.map((l) =>
                    l.chave === noCatalogo.chave
                      ? { ...l, nome, produto_id: id }
                      : l,
                  ),
                }
              : s,
          );
          setNoCatalogo(null);
        }}
      />
    );
  }

  // ---- Formulário ----------------------------------------------------------
  if (aberto && form) {
    const info = TIPOS[form.type];
    const set = <K extends keyof Form>(k: K, v: Form[K]) =>
      setForm((s) => (s ? { ...s, [k]: v } : s));
    const setDet = (k: keyof DetalhesDaAtividade, v: string) =>
      setForm((s) => (s ? { ...s, det: { ...s.det, [k]: v } } : s));
    const det = (k: keyof DetalhesDaAtividade) => form.det[k] ?? "";
    const talhoesDaFazenda = c.talhoes.filter(
      (t) => t.farm_id === form.farm_id,
    );
    const plantiosDoTalhao = c.plantios.filter(
      (p) =>
        p.plot_id === form.plot_id &&
        (p.lifecycle !== "completed" || p.id === form.planting_id),
    );
    const alvo = areaDoAlvo(form);
    const area = areaDaAtividade({
      area_type: form.area_type,
      treated_area_ha: lerNumero(form.treated),
      areaDoAlvo: alvo,
    });
    const produtosAtuais = produtosDe(form.produtos);
    const detalhes = detalhesDe(form);
    const porHa = custoPorHa(form.type, produtosAtuais, detalhes);
    const secao = (titulo: string, conteudo: ReactNode) => (
      <div className="sm:col-span-2 space-y-3 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-900">{titulo}</h3>
        {conteudo}
      </div>
    );

    return (
      <PaginaDeFormulario
        formId="form-atividade"
        rotuloSalvar={editando ? "Salvar" : "Registrar Atividade"}
        descricao={
          editando
            ? `${info.rotulo} · ${dataBr(editando.date)}`
            : "Nova atividade"
        }
        somenteLeitura={leitura}
        aoEditar={
          editando && podeMexer(editando) ? () => setLeitura(false) : undefined
        }
        aoVoltar={() => setAberto(null)}
        salvando={salvando}
      >
        <form
          id="form-atividade"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Campo rotulo="Tipo" obrigatorio>
            <Select
              value={form.type}
              onValueChange={(v) => {
                const t = v as TipoDeAtividade;
                setForm((s) =>
                  s
                    ? {
                        ...s,
                        type: t,
                        // Chuva, clima e visita são da fazenda: sem plantio.
                        planting_id: TIPOS[t].daFazenda ? "" : s.planting_id,
                      }
                    : s,
                );
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDEM_DOS_TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ backgroundColor: TIPOS[t].cor }}
                      />
                      {TIPOS[t].rotulo}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Data" htmlFor="at-data" obrigatorio>
            <Input
              id="at-data"
              type="date"
              value={form.date}
              onChange={(e) => {
                const d = e.target.value;
                // Data futura sugere "planejada" — a pessoa ainda pode trocar.
                setForm((s) =>
                  s
                    ? {
                        ...s,
                        date: d,
                        status: d > hojeIso() ? "planejada" : s.status,
                      }
                    : s,
                );
              }}
              required
            />
          </Campo>
          <Campo rotulo="Fazenda" obrigatorio>
            <SearchableSelect
              options={c.fazendas.map((f) => ({ value: f.id, label: f.name }))}
              value={form.farm_id}
              onValueChange={(v) =>
                setForm((s) =>
                  s ? { ...s, farm_id: v, plot_id: "", planting_id: "" } : s,
                )
              }
              placeholder={
                c.fazendas.length
                  ? "Escolha a fazenda"
                  : "Cadastre uma fazenda antes"
              }
              searchPlaceholder="Buscar fazenda..."
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Talhão" obrigatorio={!info.daFazenda}>
            <SearchableSelect
              options={[
                ...(info.daFazenda
                  ? [{ value: "", label: "Fazenda toda" }]
                  : []),
                ...talhoesDaFazenda.map((t) => ({
                  value: t.id,
                  label: t.name,
                })),
              ]}
              value={form.plot_id}
              onValueChange={(v) => {
                // Talhão com um plantio só em andamento: já sugere ele.
                const ativos = c.plantios.filter(
                  (p) => p.plot_id === v && p.lifecycle === "active",
                );
                setForm((s) =>
                  s
                    ? {
                        ...s,
                        plot_id: v,
                        planting_id:
                          !info.daFazenda && ativos.length === 1
                            ? ativos[0].id
                            : "",
                      }
                    : s,
                );
              }}
              placeholder={
                form.farm_id ? "Escolha o talhão" : "Escolha a fazenda antes"
              }
              searchPlaceholder="Buscar talhão..."
              disabled={leitura || !form.farm_id}
            />
          </Campo>
          {!info.daFazenda && (
            <Campo
              rotulo="Plantio"
              ajuda="Ligar ao plantio põe a atividade na safra dele. Sem plantio, ela entra na safra pela data."
            >
              <SearchableSelect
                options={[
                  { value: "", label: "Sem plantio" },
                  ...plantiosDoTalhao.map((p) => ({
                    value: p.id,
                    label: identidadeDoPlantio(p),
                  })),
                ]}
                value={form.planting_id}
                onValueChange={(v) => set("planting_id", v)}
                disabled={leitura || !form.plot_id}
              />
            </Campo>
          )}
          <Campo rotulo="Situação" obrigatorio>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as Form["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realizada">Realizada</SelectItem>
                <SelectItem value="planejada">Planejada</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          {!info.daFazenda && (
            <Campo rotulo="Área">
              <div className="flex gap-2">
                <Select
                  value={form.area_type}
                  onValueChange={(v) =>
                    set("area_type", v as Form["area_type"])
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">
                      Toda
                      {alvo != null
                        ? ` (${alvo.toLocaleString("pt-BR")} ha)`
                        : ""}
                    </SelectItem>
                    <SelectItem value="partial">Parte (ha)</SelectItem>
                  </SelectContent>
                </Select>
                {form.area_type === "partial" && (
                  <Input
                    inputMode="decimal"
                    value={form.treated}
                    onChange={(e) => set("treated", e.target.value)}
                    placeholder="ha"
                    className="flex-1"
                  />
                )}
              </div>
            </Campo>
          )}
          <Campo rotulo="Responsável" htmlFor="at-resp">
            <Input
              id="at-resp"
              value={form.responsible}
              onChange={(e) => set("responsible", e.target.value)}
            />
          </Campo>

          {/* ---- Seção do tipo ---- */}
          {form.type === "spraying" &&
            secao(
              "Aplicação",
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo rotulo="Método">
                    <Escolha
                      valor={det("metodo")}
                      aoMudar={(v) => setDet("metodo", v)}
                      opcoes={METODOS_DE_APLICACAO}
                    />
                  </Campo>
                  <Campo rotulo="Estádio">
                    <Escolha
                      valor={det("estadio")}
                      aoMudar={(v) => setDet("estadio", v)}
                      opcoes={ESTADIOS}
                    />
                  </Campo>
                </div>
                <EditorDeProdutos
                  linhas={form.produtos}
                  aoMudar={(l) => set("produtos", l)}
                  catalogo={c.produtos}
                  comTipo
                  area={area}
                  aoCadastrarNoCatalogo={(chave, nome) =>
                    setNoCatalogo({ chave, nome })
                  }
                />
              </div>,
            )}
          {form.type === "fertilization" &&
            secao(
              "Adubação",
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo rotulo="Tipo de adubação">
                    <Escolha
                      valor={det("tipo_adubacao")}
                      aoMudar={(v) => setDet("tipo_adubacao", v)}
                      opcoes={TIPOS_DE_ADUBACAO}
                    />
                  </Campo>
                  <Campo rotulo="Estádio">
                    <Escolha
                      valor={det("estadio")}
                      aoMudar={(v) => setDet("estadio", v)}
                      opcoes={ESTADIOS}
                    />
                  </Campo>
                </div>
                <EditorDeProdutos
                  linhas={form.produtos}
                  aoMudar={(l) => set("produtos", l)}
                  catalogo={c.produtos}
                  area={area}
                  aoCadastrarNoCatalogo={(chave, nome) =>
                    setNoCatalogo({ chave, nome })
                  }
                />
              </div>,
            )}
          {(form.type === "liming" || form.type === "plastering") &&
            secao(
              form.type === "liming" ? "Calagem" : "Gessagem",
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Campo
                  rotulo={
                    form.type === "liming"
                      ? "Tipo de calcário"
                      : "Tipo de gesso"
                  }
                >
                  <Escolha
                    valor={det("corretivo_tipo")}
                    aoMudar={(v) => setDet("corretivo_tipo", v)}
                    opcoes={
                      form.type === "liming"
                        ? TIPOS_DE_CALCARIO
                        : TIPOS_DE_GESSO
                    }
                  />
                </Campo>
                <Campo rotulo="Dose">
                  <div className="flex gap-1">
                    <Input
                      inputMode="decimal"
                      value={det("corretivo_dose")}
                      onChange={(e) => setDet("corretivo_dose", e.target.value)}
                    />
                    <Select
                      value={det("corretivo_unidade") || "t/ha"}
                      onValueChange={(v) => setDet("corretivo_unidade", v)}
                    >
                      <SelectTrigger className="w-24 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADES_DE_DOSE.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Campo>
                <Campo
                  rotulo="Preço (R$ por unidade da dose)"
                  ajuda="Ex.: dose em t/ha e preço em R$/t."
                >
                  <Input
                    inputMode="decimal"
                    value={det("corretivo_preco")}
                    onChange={(e) => setDet("corretivo_preco", e.target.value)}
                    placeholder="0,00"
                  />
                </Campo>
              </div>,
            )}
          {form.type === "irrigation" &&
            secao(
              "Irrigação",
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo rotulo="Lâmina (mm)">
                  <Input
                    inputMode="decimal"
                    value={det("lamina_mm")}
                    onChange={(e) => setDet("lamina_mm", e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Custo do mm por ha (R$)">
                  <Input
                    inputMode="decimal"
                    value={det("custo_mm_ha")}
                    onChange={(e) => setDet("custo_mm_ha", e.target.value)}
                    placeholder="0,00"
                  />
                </Campo>
              </div>,
            )}
          {form.type === "harvest" &&
            secao(
              "Colheita",
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo rotulo="Método">
                  <Escolha
                    valor={det("colheita_metodo")}
                    aoMudar={(v) => setDet("colheita_metodo", v)}
                    opcoes={METODOS_DE_COLHEITA}
                  />
                </Campo>
                <Campo rotulo="Serviço">
                  <Escolha
                    valor={det("colheita_servico")}
                    aoMudar={(v) => setDet("colheita_servico", v)}
                    opcoes={SERVICOS_DE_COLHEITA}
                  />
                </Campo>
                <Campo rotulo="Produtividade">
                  <div className="flex gap-1">
                    <Input
                      inputMode="decimal"
                      value={det("produtividade")}
                      onChange={(e) => setDet("produtividade", e.target.value)}
                    />
                    <Select
                      value={det("produtividade_unidade") || "sc/ha"}
                      onValueChange={(v) => setDet("produtividade_unidade", v)}
                    >
                      <SelectTrigger className="w-24 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADES_DE_PRODUTIVIDADE.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {lerNumero(det("produtividade")) != null && area > 0 && (
                    <p className="text-xs text-slate-500">
                      Produção estimada:{" "}
                      {(
                        (lerNumero(det("produtividade")) ?? 0) * area
                      ).toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      {(det("produtividade_unidade") || "sc/ha").replace(
                        "/ha",
                        "",
                      )}
                    </p>
                  )}
                </Campo>
                <Campo rotulo="Custo da colheita (R$/ha)">
                  <Input
                    inputMode="decimal"
                    value={det("custo_ha")}
                    onChange={(e) => setDet("custo_ha", e.target.value)}
                    placeholder="0,00"
                  />
                </Campo>
              </div>,
            )}
          {form.type === "planting" &&
            secao(
              "Plantio",
              <Campo
                rotulo="Custo da operação (R$/ha)"
                ajuda="Semente e adubo de plantio entram melhor como Adubação/Aplicação; aqui, a operação."
              >
                <Input
                  inputMode="decimal"
                  value={det("custo_ha")}
                  onChange={(e) => setDet("custo_ha", e.target.value)}
                  placeholder="0,00"
                />
              </Campo>,
            )}
          {form.type === "observation" &&
            secao(
              "O que foi observado",
              <EditorDeObservacoes
                itens={form.observacoes}
                aoMudar={(o) => set("observacoes", o)}
              />,
            )}
          {form.type === "annotation" &&
            secao(
              "Anotação",
              <Campo rotulo="Categoria">
                <Escolha
                  valor={det("categoria")}
                  aoMudar={(v) => setDet("categoria", v)}
                  opcoes={CATEGORIAS_DE_ANOTACAO}
                />
              </Campo>,
            )}
          {form.type === "rain" &&
            secao(
              "Chuva",
              <Campo rotulo="Quantidade (mm)">
                <Input
                  inputMode="decimal"
                  value={det("chuva_mm")}
                  onChange={(e) => setDet("chuva_mm", e.target.value)}
                />
              </Campo>,
            )}
          {form.type === "climate" &&
            secao(
              "Evento climático",
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo rotulo="Evento">
                  <Escolha
                    valor={det("evento")}
                    aoMudar={(v) => setDet("evento", v)}
                    opcoes={EVENTOS_CLIMATICOS}
                  />
                </Campo>
                {det("evento") === "Chuva" && (
                  <Campo rotulo="Precipitação (mm)">
                    <Input
                      inputMode="decimal"
                      value={det("chuva_mm")}
                      onChange={(e) => setDet("chuva_mm", e.target.value)}
                    />
                  </Campo>
                )}
              </div>,
            )}
          {form.type === "visit" &&
            secao(
              "Visita",
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Campo rotulo="Empresa / organização">
                  <Input
                    value={det("visita_empresa")}
                    onChange={(e) => setDet("visita_empresa", e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Objetivo">
                  <Input
                    value={det("visita_objetivo")}
                    onChange={(e) => setDet("visita_objetivo", e.target.value)}
                  />
                </Campo>
                <Campo rotulo="Tipo de visita">
                  <Escolha
                    valor={det("visita_tipo")}
                    aoMudar={(v) => setDet("visita_tipo", v)}
                    opcoes={TIPOS_DE_VISITA}
                  />
                </Campo>
              </div>,
            )}

          {info.comCusto && (
            <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700 tabular-nums">
              Custo agronômico:{" "}
              <strong className="font-medium">{brl(porHa)}/ha</strong> ×{" "}
              {area.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha ={" "}
              <strong className="font-medium">{brl(porHa * area)}</strong>
            </div>
          )}

          <Campo rotulo="Descrição" htmlFor="at-desc" className="sm:col-span-2">
            <Textarea
              id="at-desc"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Campo>
        </form>
      </PaginaDeFormulario>
    );
  }

  // ---- Lista ---------------------------------------------------------------
  const filtrosAtivos =
    Boolean(busca) ||
    fTipo !== "todos" ||
    fSafra !== "todas" ||
    fFazenda !== "todas" ||
    fStatus !== "todos";
  return (
    <div className="space-y-3">
      <BarraDeTela
        buscaAtiva={Boolean(busca)}
        busca={
          <BuscaDaLista
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar tipo, produto, talhão..."
          />
        }
        campos={[
          {
            rotulo: "Tipo",
            ativo: fTipo !== "todos",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todos", label: "Todos os tipos" },
                  ...ORDEM_DOS_TIPOS.map((t) => ({
                    value: t,
                    label: TIPOS[t].rotulo,
                  })),
                ]}
                value={fTipo}
                onValueChange={(v) => setFTipo(v || "todos")}
              />
            ),
          },
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
            ativo: fStatus !== "todos",
            campo: (
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="realizada">Realizadas</SelectItem>
                  <SelectItem value="planejada">Planejadas</SelectItem>
                </SelectContent>
              </Select>
            ),
          },
        ]}
        acaoPrincipal={
          podeCriar ? (
            <BotaoNovo
              rotulo="Nova Atividade"
              onClick={() => abrir("novo", false)}
            />
          ) : undefined
        }
      />

      {a.carregando || c.carregando ? (
        <LoadingState />
      ) : a.atividades.length === 0 ? (
        <EmptyStateCard
          icon={ClipboardText}
          title="Nenhuma atividade registrada"
          description="Registre aplicações, adubações, colheitas, observações e visitas — com o custo de cada uma."
        />
      ) : (
        <>
          <ItemsCount
            count={lista.length}
            totalCount={a.atividades.length}
            itemLabel="atividade"
            itemLabelPlural="atividades"
            headerSuffix={
              somaCusto > 0 ? `· ${brl(somaCusto)} realizados` : undefined
            }
            showClearFilters={filtrosAtivos}
            onClearFilters={() => {
              setBusca("");
              setFTipo("todos");
              setFSafra("todas");
              setFFazenda("todas");
              setFStatus("todos");
            }}
          />
          <GradeDeCartoes>
            {lista.map((x) => {
              const mexe = podeMexer(x);
              const t = x.plot_id ? talhaoPorId.get(x.plot_id) : null;
              const p = x.planting_id ? plantioPorId.get(x.planting_id) : null;
              return (
                <CartaoDeCadastro
                  key={x.id}
                  titulo={`${TIPOS[x.type].rotulo} · ${dataBr(x.date)}`}
                  faixa={TIPOS[x.type].cor}
                  linhas={[
                    [
                      t?.name ?? "Fazenda toda",
                      fazendaPorId.get(x.farm_id)?.name,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    p ? identidadeDoPlantio(p) : null,
                    x.products.length
                      ? x.products.map((pr) => pr.nome).join(", ")
                      : x.description,
                    x.cost_total ? brl(x.cost_total) : null,
                  ]}
                  selos={
                    x.status === "planejada" ? (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Planejada
                      </span>
                    ) : undefined
                  }
                  aoAbrir={() => abrir(x, true)}
                  aoEditar={mexe ? () => abrir(x, false) : undefined}
                  aoExcluir={mexe ? () => setExcluindo(x) : undefined}
                  acoesExtras={
                    mexe && x.status === "planejada"
                      ? [
                          {
                            rotulo: "Marcar como realizada",
                            aoEscolher: () => void marcarRealizada(x),
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
              Nenhuma atividade encontrada com esses filtros.
            </p>
          )}
        </>
      )}

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Excluir Atividade"
        itemName={
          excluindo
            ? `"${TIPOS[excluindo.type].rotulo} de ${dataBr(excluindo.date)}"`
            : undefined
        }
        loading={apagando}
      />
    </div>
  );
}
