import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  Fazenda,
  FazendaInput,
  Produtor,
  ProdutorInput,
  Talhao,
  TalhaoInput,
} from "../types";

/**
 * Produtores, fazendas e talhões da organização — direto no banco (supabase-js),
 * e não pela edge: quem decide o que cada um vê e pode mexer é a RLS, e é esse
 * caminho que a fila offline vai reaproveitar (docs/UNIFICACAO-FIELD.md §8).
 * Por isso o id nasce AQUI (`crypto.randomUUID()`), e não no banco.
 *
 * Carrega os três de uma vez: são cadastros pequenos e as três telas usam os
 * três (a fazenda mostra o produtor, o talhão mostra a fazenda).
 *
 * Mutação devolve o RESULTADO (id ou mensagem de erro) em vez de só gravar em
 * estado: quem chama precisa da mensagem logo depois do `await`, e o estado
 * ainda não atualizou nesse momento. O toast é do componente.
 */
export type Resultado = { ok: true; id: string } | { ok: false; erro: string };
type Tabela = "farm_producers" | "farms" | "farm_plots";

const ROTULO: Record<Tabela, string> = {
  farm_producers: "produtor",
  farms: "fazenda",
  farm_plots: "talhão",
};

function mensagemDoErro(
  tabela: Tabela,
  e: { code?: string; message?: string },
): string {
  if (e.code === "23505")
    return `Já existe um ${ROTULO[tabela]} com esse nome.`;
  if (e.code === "42501")
    return "Sem permissão para isso. Confira se o módulo Field está ativo.";
  return e.message || "Não foi possível salvar.";
}

export function useCadastros() {
  const { user } = useAuth();
  const [produtores, setProdutores] = useState<Produtor[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setErro(null);
    const [p, f, t] = await Promise.all([
      supabase.from("farm_producers").select("*").order("name"),
      supabase.from("farms").select("*").order("name"),
      supabase.from("farm_plots").select("*").order("name"),
    ]);
    const falha = p.error ?? f.error ?? t.error;
    if (falha) setErro(falha.message);
    setProdutores((p.data as Produtor[]) ?? []);
    setFazendas(
      ((f.data as Fazenda[]) ?? []).map((x) => ({
        ...x,
        // numeric chega como string do PostgREST quando passa de 15 dígitos;
        // aqui garante número para a tela.
        area_ha: x.area_ha == null ? null : Number(x.area_ha),
        latitude: x.latitude == null ? null : Number(x.latitude),
        longitude: x.longitude == null ? null : Number(x.longitude),
      })),
    );
    setTalhoes(
      ((t.data as Talhao[]) ?? []).map((x) => ({
        ...x,
        area_ha: Number(x.area_ha),
      })),
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const salvar = useCallback(
    async (
      tabela: Tabela,
      dados: Record<string, unknown>,
      id?: string,
    ): Promise<Resultado> => {
      if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };
      const novoId = id ?? crypto.randomUUID();
      const { error } = id
        ? await supabase.from(tabela).update(dados).eq("id", id)
        : await supabase.from(tabela).insert({
            id: novoId,
            organization_id: user.organizationId,
            ...dados,
          });
      if (error) return { ok: false, erro: mensagemDoErro(tabela, error) };
      await recarregar();
      return { ok: true, id: novoId };
    },
    [user, recarregar],
  );

  const excluir = useCallback(
    async (tabela: Tabela, id: string): Promise<Resultado> => {
      // `count` para saber se a RLS deixou apagar: sem permissão o delete não
      // dá erro, só não apaga nada — e a tela diria "excluído" à toa.
      const { error, count } = await supabase
        .from(tabela)
        .delete({ count: "exact" })
        .eq("id", id);
      if (error || !count) {
        return {
          ok: false,
          erro: error
            ? mensagemDoErro(tabela, error)
            : `Não foi possível excluir este ${ROTULO[tabela]}.`,
        };
      }
      await recarregar();
      return { ok: true, id };
    },
    [recarregar],
  );

  return {
    produtores,
    fazendas,
    talhoes,
    carregando,
    erro,
    recarregar,
    salvarProdutor: (d: ProdutorInput, id?: string) =>
      salvar("farm_producers", d, id),
    salvarFazenda: (d: FazendaInput, id?: string) => salvar("farms", d, id),
    salvarTalhao: (d: TalhaoInput, id?: string) => salvar("farm_plots", d, id),
    excluirProdutor: (id: string) => excluir("farm_producers", id),
    excluirFazenda: (id: string) => excluir("farms", id),
    excluirTalhao: (id: string) => excluir("farm_plots", id),
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

/** Quem pode mexer num cadastro: quem criou (gestor não edita o de terceiro). */
export function podeEditar(
  item: { created_by: string | null },
  userId: string | undefined,
  canWrite: boolean,
): boolean {
  return canWrite && !!userId && item.created_by === userId;
}
