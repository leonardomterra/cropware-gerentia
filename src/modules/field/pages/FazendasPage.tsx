import { useMemo, useState } from "react";
import { toast } from "sonner";
import Barn from "~icons/ph/barn-duotone";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ItemsCount } from "@/components/ui/ItemsCount";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCadastros, contarLancamentosLigados } from "../hooks/useCadastros";
import { usePermissoesDoCampo } from "../hooks/usePermissoesDoCampo";
import {
  CartaoDeCadastro,
  Campo,
  GradeDeCartoes,
} from "../components/Cadastro";
import { BotaoNovo, BuscaDaLista } from "../components/BuscaDaLista";
import { SeletorDeSede } from "../components/mapa/SeletorDeSede";
import { Miniatura } from "../components/mapa/Miniatura";
import { deGeoJson, formatarArea } from "../geo/geometria";
import {
  acharRepetido,
  lerNumero,
  normalizarNome,
  numeroParaCampo,
} from "../utils/nomes";
import { brazilianStates as ESTADOS } from "../data/estados";
import { citiesByState as MUNICIPIOS } from "../data/municipios";
import type { Fazenda } from "../types";

interface Form {
  name: string;
  producer_id: string;
  state: string;
  city: string;
  area: string;
  state_registration: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
}
const VAZIO: Form = {
  name: "",
  producer_id: "",
  state: "",
  city: "",
  area: "",
  state_registration: "",
  latitude: null,
  longitude: null,
  notes: "",
};

const OPCOES_UF = ESTADOS.map((e) => ({
  value: e.code,
  label: `${e.name} (${e.code})`,
}));

/**
 * Fazendas. A tabela `farms` já existia no gerentia (o cadastro de cada conta
 * cria uma) mas não tinha tela; agora é o cadastro do Field. O produtor só
 * aparece no modo "consultor" (utils/modoDeUso.ts). Portado do Flag Field
 * (FarmManagement, aba Fazendas), sem CSV e sem ações em lote por enquanto.
 */
export default function FazendasPage() {
  const c = useCadastros();
  const { podeCriar, podeMexer, comProdutores } = usePermissoesDoCampo();
  const [busca, setBusca] = useState("");
  const [fProdutor, setFProdutor] = useState("todos");
  const [aberto, setAberto] = useState<"novo" | Fazenda | null>(null);
  const [leitura, setLeitura] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<{
    f: Fazenda;
    lancamentos: number;
  } | null>(null);
  const [apagando, setApagando] = useState(false);

  const nomeDoProdutor = useMemo(
    () => new Map(c.produtores.map((p) => [p.id, p.name])),
    [c.produtores],
  );
  const contornos = useMemo(() => {
    const m = new Map<string, ReturnType<typeof deGeoJson>[]>();
    for (const t of c.talhoes) {
      const pts = deGeoJson(t.geometry);
      if (pts.length) m.set(t.farm_id, [...(m.get(t.farm_id) ?? []), pts]);
    }
    return m;
  }, [c.talhoes]);
  const talhoesPorFazenda = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of c.talhoes) m.set(t.farm_id, (m.get(t.farm_id) ?? 0) + 1);
    return m;
  }, [c.talhoes]);

  const lista = useMemo(() => {
    const alvo = normalizarNome(busca);
    return c.fazendas.filter(
      (f) =>
        (fProdutor === "todos" || f.producer_id === fProdutor) &&
        (!alvo ||
          normalizarNome(f.name).includes(alvo) ||
          normalizarNome(f.city ?? "").includes(alvo)),
    );
  }, [c.fazendas, busca, fProdutor]);

  const editando = aberto !== null && aberto !== "novo" ? aberto : null;
  const mesmaChave = c.fazendas.filter(
    (f) => (f.producer_id ?? "") === (form.producer_id || ""),
  );
  const repetido = acharRepetido(mesmaChave, form.name, editando?.id);
  const faltaProdutor = comProdutores && !form.producer_id;
  const contornosDoForm = useMemo(
    () => (editando ? (contornos.get(editando.id) ?? []) : []),
    [contornos, editando],
  );

  function abrir(f: Fazenda | "novo", somenteLer: boolean) {
    setAberto(f);
    setLeitura(somenteLer);
    setForm(
      f === "novo"
        ? { ...VAZIO, producer_id: fProdutor !== "todos" ? fProdutor : "" }
        : {
            name: f.name,
            producer_id: f.producer_id ?? "",
            state: f.state ?? "",
            city: f.city ?? "",
            area: numeroParaCampo(f.area_ha),
            state_registration: f.state_registration ?? "",
            latitude: f.latitude,
            longitude: f.longitude,
            notes: f.notes ?? "",
          },
    );
  }

  async function salvar() {
    if (!form.name.trim() || repetido || faltaProdutor) return;
    const area = lerNumero(form.area);
    if (form.area.trim() && (area == null || area <= 0)) {
      toast.error("Área total inválida.");
      return;
    }
    setSalvando(true);
    const res = await c.salvarFazenda(
      {
        name: form.name.trim(),
        // Fora do modo consultor a fazenda não tem produtor — mas uma que já
        // tinha (a pessoa trocou de modo) mantém o que estava.
        producer_id: form.producer_id || null,
        state: form.state || null,
        city: form.city || null,
        area_ha: area,
        state_registration: form.state_registration.trim() || null,
        latitude: form.latitude,
        longitude: form.longitude,
        notes: form.notes.trim() || null,
      },
      editando?.id,
    );
    setSalvando(false);
    if (res.ok) {
      toast.success(editando ? "Fazenda atualizada" : "Fazenda cadastrada");
      setAberto(null);
    } else toast.error(res.erro);
  }

  async function pedirExclusao(f: Fazenda) {
    setExcluindo({
      f,
      lancamentos: await contarLancamentosLigados({ farmIds: [f.id] }),
    });
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    const res = await c.excluirFazenda(excluindo.f.id);
    setApagando(false);
    if (res.ok) {
      toast.success("Fazenda excluída");
      setExcluindo(null);
      setAberto(null);
    } else toast.error(res.erro);
  }

  const opcoesProdutor = c.produtores.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  if (aberto) {
    const cidades = form.state ? (MUNICIPIOS[form.state] ?? []) : [];
    return (
      <PaginaDeFormulario
        formId="form-fazenda"
        rotuloSalvar={editando ? "Salvar" : "Cadastrar Fazenda"}
        descricao={editando ? editando.name : "Nova fazenda"}
        somenteLeitura={leitura}
        aoEditar={
          editando && podeMexer(editando) ? () => setLeitura(false) : undefined
        }
        aoVoltar={() => setAberto(null)}
        salvando={salvando}
      >
        <form
          id="form-fazenda"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Campo
            rotulo="Nome"
            htmlFor="f-nome"
            obrigatorio
            erro={repetido ? "Já existe uma fazenda com esse nome." : null}
          >
            <Input
              id="f-nome"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              maxLength={120}
              required
            />
          </Campo>
          {(comProdutores || form.producer_id) && (
            <Campo rotulo="Produtor" obrigatorio={comProdutores}>
              <SearchableSelect
                options={opcoesProdutor}
                value={form.producer_id}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, producer_id: v }))
                }
                placeholder={
                  opcoesProdutor.length
                    ? "Escolha o produtor"
                    : "Cadastre um produtor antes"
                }
                searchPlaceholder="Buscar produtor..."
                emptyMessage="Nenhum produtor."
                disabled={leitura}
              />
            </Campo>
          )}
          <Campo rotulo="Estado">
            <SearchableSelect
              options={OPCOES_UF}
              value={form.state}
              onValueChange={(v) =>
                setForm((s) => ({ ...s, state: v, city: "" }))
              }
              placeholder="UF"
              searchPlaceholder="Buscar estado..."
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Cidade">
            <SearchableSelect
              options={cidades.map((m) => ({ value: m, label: m }))}
              value={form.city}
              onValueChange={(v) => setForm((s) => ({ ...s, city: v }))}
              placeholder={form.state ? "Cidade" : "Escolha o estado antes"}
              searchPlaceholder="Buscar cidade..."
              emptyMessage="Nenhuma cidade."
              disabled={leitura || !form.state}
            />
          </Campo>
          <Campo
            rotulo="Área total (ha)"
            htmlFor="f-area"
            ajuda="A área da fazenda inteira, incluindo reserva e sede. A soma dos talhões aparece separada."
          >
            <Input
              id="f-area"
              inputMode="decimal"
              value={form.area}
              onChange={(e) => setForm((s) => ({ ...s, area: e.target.value }))}
              placeholder="0,00"
            />
          </Campo>
          <Campo rotulo="Inscrição Estadual" htmlFor="f-ie">
            <Input
              id="f-ie"
              value={form.state_registration}
              onChange={(e) =>
                setForm((s) => ({ ...s, state_registration: e.target.value }))
              }
            />
          </Campo>
          <Campo rotulo="Sede" className="sm:col-span-2">
            <SeletorDeSede
              latitude={form.latitude}
              longitude={form.longitude}
              aoMudar={(lat, lng) =>
                setForm((s) => ({ ...s, latitude: lat, longitude: lng }))
              }
              somenteLeitura={leitura}
              talhoes={contornosDoForm}
            />
          </Campo>
          <Campo rotulo="Observações" htmlFor="f-obs" className="sm:col-span-2">
            <Textarea
              id="f-obs"
              rows={3}
              value={form.notes}
              onChange={(e) =>
                setForm((s) => ({ ...s, notes: e.target.value }))
              }
            />
          </Campo>
        </form>
      </PaginaDeFormulario>
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
            placeholder="Buscar por nome ou cidade..."
          />
        }
        campos={
          comProdutores
            ? [
                {
                  rotulo: "Produtor",
                  ativo: fProdutor !== "todos",
                  campo: (
                    <SearchableSelect
                      options={[
                        { value: "todos", label: "Todos os produtores" },
                        ...opcoesProdutor,
                      ]}
                      value={fProdutor}
                      onValueChange={(v) => setFProdutor(v || "todos")}
                      searchPlaceholder="Buscar produtor..."
                    />
                  ),
                },
              ]
            : []
        }
        acaoPrincipal={
          podeCriar ? (
            <BotaoNovo
              rotulo="Nova Fazenda"
              onClick={() => abrir("novo", false)}
            />
          ) : undefined
        }
      />

      {c.carregando ? (
        <LoadingState />
      ) : c.fazendas.length === 0 ? (
        <EmptyStateCard
          icon={Barn}
          title="Nenhuma fazenda cadastrada"
          description="Cadastre a fazenda e depois desenhe os talhões dela no mapa."
        />
      ) : (
        <>
          <ItemsCount
            count={lista.length}
            totalCount={c.fazendas.length}
            itemLabel="fazenda"
            itemLabelPlural="fazendas"
            showClearFilters={Boolean(busca) || fProdutor !== "todos"}
            onClearFilters={() => {
              setBusca("");
              setFProdutor("todos");
            }}
          />
          <GradeDeCartoes>
            {lista.map((f) => {
              const n = talhoesPorFazenda.get(f.id) ?? 0;
              const mexe = podeMexer(f);
              return (
                <CartaoDeCadastro
                  key={f.id}
                  titulo={f.name}
                  miniatura={
                    <Miniatura
                      destaque={contornos.get(f.id) ?? []}
                      className="size-16"
                    />
                  }
                  linhas={[
                    comProdutores &&
                      f.producer_id &&
                      nomeDoProdutor.get(f.producer_id),
                    [f.city, f.state].filter(Boolean).join(" — "),
                    [
                      f.area_ha != null ? formatarArea(f.area_ha) : null,
                      `${n} ${n === 1 ? "talhão" : "talhões"}`,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  ]}
                  aoAbrir={() => abrir(f, true)}
                  aoEditar={mexe ? () => abrir(f, false) : undefined}
                  aoExcluir={mexe ? () => void pedirExclusao(f) : undefined}
                />
              );
            })}
          </GradeDeCartoes>
          {lista.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">
              Nenhuma fazenda encontrada com esses filtros.
            </p>
          )}
        </>
      )}

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Excluir Fazenda"
        itemName={excluindo ? `"${excluindo.f.name}"` : undefined}
        loading={apagando}
        cascadeItems={
          excluindo
            ? [
                {
                  label: "Talhões",
                  count: talhoesPorFazenda.get(excluindo.f.id) ?? 0,
                },
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
