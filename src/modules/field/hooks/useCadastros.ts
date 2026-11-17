import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  Atividade,
  AtividadeInput,
  Fazenda,
  FazendaInput,
  Plantio,
  PlantioInput,
  Produto,
  ProdutoInput,
  Produtor,
  ProdutorInput,
  Safra,
  SafraInput,
  Talhao,
  TalhaoInput,
} from "../types";

/**
 * Cadastros do Field — direto no banco (supabase-js), e não pela edge: quem
 * decide o que cada um vê e pode mexer é a RLS, e é esse caminho que a fila
 * offline vai reaproveitar (docs/UNIFICACAO-FIELD.md §8). Por isso o id nasce
 * AQUI (`crypto.randomUUID()`), e não no banco.
 *
 * Carrega tudo de uma vez — produtores, fazendas, talhões, safras, catálogo e
 * plantios: são cadastros pequenos e as telas cruzam uns com os outros. As
 * ATIVIDADES, que são o que cresce, ficam no `useAtividades`.
 *
 * Mutação devolve o RESULTADO (id ou mensagem de erro) em vez de só gravar em
 * estado: quem chama precisa da mensagem logo depois do `await`, e o estado
 * ainda não atualizou nesse momento. O toast é do componente.
 */
export type Resultado = { ok: true; id: string } | { ok: false; erro: string };
export type Tabela =
  | "farm_producers"
  | "farms"
  | "farm_plots"
  | "farm_seasons"
  | "farm_products"
  | "farm_plantings"
  | "farm_activities"
  | "farm_trials"
  | "farm_trial_products"
  | "farm_trial_steps"
  | "farm_trial_evaluations"
  | "farm_trial_harvests";

const ROTULO: Record<Tabela, string> = {
  farm_producers: "um produtor",
  farms: "uma fazenda",
  farm_plots: "um talhão",
  farm_seasons: "uma safra",
  farm_products: "um produto",
  farm_plantings: "um plantio",
  farm_activities: "uma atividade",
  farm_trials: "um ensaio",
  farm_trial_products: "um produto no ensaio",
  farm_trial_steps: "uma etapa de avaliação",
  farm_trial_evaluations: "uma avaliação",
  farm_trial_harvests: "uma colheita",
};

function mensagemDoErro(
  tabela: Tabela,
  e: { code?: string; message?: string },
): string {
  if (e.code === "23505")
    return tabela === "farm_trial_harvests" ||
      tabela === "farm_trial_evaluations"
      ? `Este produto já tem ${ROTULO[tabela]} aqui.`
      : `Já existe ${ROTULO[tabela]} com esse nome.`;
  if (e.code === "42501")
    return "Sem permissão para isso. Confira se o módulo Field está ativo.";
  return e.message || "Não foi possível salvar.";
}

/** numeric do Postgres → number (o PostgREST pode devolver string). */
const num = (v: unknown) => (v == null ? null : Number(v));

export async function gravar(
  tabela: Tabela,
  organizationId: string,
  dados: Record<string, unknown>,
  id?: string,
): Promise<Resultado> {
  const novoId = id ?? crypto.randomUUID();
  const { error } = id
    ? await supabase.from(tabela).update(dados).eq("id", id)
    : await supabase
        .from(tabela)
        .insert({ id: novoId, organization_id: organizationId, ...dados });
  if (error) return { ok: false, erro: mensagemDoErro(tabela, error) };
  return { ok: true, id: novoId };
}

export async function apagar(tabela: Tabela, id: string): Promise<Resultado> {
  // `count` para saber se a RLS deixou apagar: sem permissão o delete não dá
  // erro, só não apaga nada — e a tela diria "excluído" à toa.
  const { error, count } = await supabase
    .from(tabela)
    .delete({ count: "exact" })
    .eq("id", id);
  if (error || !count) {
    return {
      ok: false,
      erro: error
        ? mensagemDoErro(tabela, error)
        : `Não foi possível excluir ${ROTULO[tabela]}.`,
    };
  }
  return { ok: true, id };
}

export function useCadastros() {
  const { user } = useAuth();
  const [produtores, setProdutores] = useState<Produtor[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [safras, setSafras] = useState<Safra[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [plantios, setPlantios] = useState<Plantio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setErro(null);
    const [p, f, t, s, pr, pl] = await Promise.all([
      supabase.from("farm_producers").select("*").order("name"),
      supabase.from("farms").select("*").order("name"),
      supabase.from("farm_plots").select("*").order("name"),
      supabase
        .from("farm_seasons")
        .select("*")
        .order("starts_on", { ascending: false }),
      supabase.from("farm_products").select("*").order("name"),
      supabase
        .from("farm_plantings")
        .select("*")
        .order("planting_date", { ascending: false }),
    ]);
    const falha =
      p.error ?? f.error ?? t.error ?? s.error ?? pr.error ?? pl.error;
    if (falha) setErro(falha.message);
    setProdutores((p.data as Produtor[]) ?? []);
    setFazendas(
      ((f.data as Fazenda[]) ?? []).map((x) => ({
        ...x,
        area_ha: num(x.area_ha),
        latitude: num(x.latitude),
        longitude: num(x.longitude),
      })),
    );
    setTalhoes(
      ((t.data as Talhao[]) ?? []).map((x) => ({
        ...x,
        area_ha: Number(x.area_ha),
      })),
    );
    setSafras((s.data as Safra[]) ?? []);
    setProdutos(
      ((pr.data as Produto[]) ?? []).map((x) => ({
        ...x,
        maturation_group: num(x.maturation_group),
      })),
    );
    setPlantios(
      ((pl.data as Plantio[]) ?? []).map((x) => ({
        ...x,
        population: num(x.population),
        partial_area_ha: num(x.partial_area_ha),
      })),
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const salvar = useCallback(
    async (tabela: Tabela, dados: Record<string, unknown>, id?: string) => {
      if (!user)
        return {
          ok: false,
          erro: "Sessão expirada. Entre de novo.",
        } as Resultado;
      const res = await gravar(tabela, user.organizationId, dados, id);
      if (res.ok) await recarregar();
      return res;
    },
    [user, recarregar],
  );

  const excluir = useCallback(
    async (tabela: Tabela, id: string) => {
      const res = await apagar(tabela, id);
      if (res.ok) await recarregar();
      return res;
    },
    [recarregar],
  );

  return {
    produtores,
    fazendas,
    talhoes,
    safras,
    produtos,
    plantios,
    carregando,
    erro,
    recarregar,
    salvarProdutor: (d: ProdutorInput, id?: string) =>
      salvar("farm_producers", d, id),
    salvarFazenda: (d: FazendaInput, id?: string) => salvar("farms", d, id),
    salvarTalhao: (d: TalhaoInput, id?: string) => salvar("farm_plots", d, id),
    salvarSafra: (d: SafraInput, id?: string) => salvar("farm_seasons", d, id),
    salvarProduto: (d: ProdutoInput, id?: string) =>
      salvar("farm_products", d, id),
    salvarPlantio: (d: Partial<PlantioInput>, id?: string) =>
      salvar("farm_plantings", d, id),
    excluirProdutor: (id: string) => excluir("farm_producers", id),
    excluirFazenda: (id: string) => excluir("farms", id),
    excluirTalhao: (id: string) => excluir("farm_plots", id),
    excluirSafra: (id: string) => excluir("farm_seasons", id),
    excluirProduto: (id: string) => excluir("farm_products", id),
    excluirPlantio: (id: string) => excluir("farm_plantings", id),
  };
}

/**
 * Atividades — à parte porque é o que cresce (dezenas por talhão por safra).
 * Carrega as da organização que a pessoa enxerga, mais recentes primeiro.
 */
export function useAtividades() {
  const { user } = useAuth();
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const { data } = await supabase
      .from("farm_activities")
      .select("*")
      .order("date", { ascending: false })
      .limit(5000);
    setAtividades(
      ((data as Atividade[]) ?? []).map((x) => ({
        ...x,
        treated_area_ha: num(x.treated_area_ha),
        cost_total: num(x.cost_total),
      })),
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const salvarAtividade = useCallback(
    async (d: Partial<AtividadeInput>, id?: string) => {
      if (!user)
        return {
          ok: false,
          erro: "Sessão expirada. Entre de novo.",
        } as Resultado;
      const res = await gravar(
        "farm_activities",
        user.organizationId,
        { ...d },
        id,
      );
      if (res.ok) await recarregar();
      return res;
    },
    [user, recarregar],
  );

  const excluirAtividade = useCallback(
    async (id: string) => {
      const res = await apagar("farm_activities", id);
      if (res.ok) await recarregar();
      return res;
    },
    [recarregar],
  );

  return {
    atividades,
    carregando,
    recarregar,
    salvarAtividade,
    excluirAtividade,
  };
}

/**
 * Quantos lançamentos perdem o vínculo se a fazenda/talhão sair — para o
 * diálogo de exclusão contar o que acontece. Conta só o que a pessoa enxerga.
 */
export async function contarLancamentosLigados(filtro: {
  farmIds?: string[];
  plotIds?: string[];
}): Promise<number> {
  const { farmIds = [], plotIds = [] } = filtro;
  if (farmIds.length === 0 && plotIds.length === 0) return 0;
  let q = supabase
    .from("farm_receipts")
    .select("id", { count: "exact", head: true });
  q = farmIds.length > 0 ? q.in("farm_id", farmIds) : q.in("plot_id", plotIds);
  const { count } = await q;
  return count ?? 0;
}
