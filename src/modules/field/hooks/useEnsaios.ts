import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { apagar, gravar, type Resultado, type Tabela } from "./useCadastros";
import type {
  AvaliacaoDoEnsaio,
  ColheitaDoEnsaioRow,
  Ensaio,
  EtapaDoEnsaio,
  ProdutoNoEnsaio,
} from "../types";

/** numeric do Postgres → number. */
const num = (v: unknown) => (v == null ? null : Number(v));

/**
 * Ensaios e as partes deles — direto no banco (supabase-js + RLS), como o resto
 * do Field. Cada parte salva NA HORA (no Flag Field o ensaio inteiro era um
 * jsonb salvo de uma vez: fechar a tela antes do "Salvar" perdia tudo).
 */
export function useEnsaios() {
  const { user } = useAuth();
  const [ensaios, setEnsaios] = useState<Ensaio[]>([]);
  const [produtos, setProdutos] = useState<ProdutoNoEnsaio[]>([]);
  const [etapas, setEtapas] = useState<EtapaDoEnsaio[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDoEnsaio[]>([]);
  const [colheitas, setColheitas] = useState<ColheitaDoEnsaioRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const [e, p, s, a, h] = await Promise.all([
      supabase
        .from("farm_trials")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("farm_trial_products").select("*").order("created_at"),
      supabase.from("farm_trial_steps").select("*").order("created_at"),
      supabase.from("farm_trial_evaluations").select("*").order("date"),
      supabase.from("farm_trial_harvests").select("*").order("created_at"),
    ]);
    setEnsaios(
      ((e.data as Ensaio[]) ?? []).map((x) => ({
        ...x,
        sack_price: num(x.sack_price),
      })),
    );
    setProdutos(
      ((p.data as ProdutoNoEnsaio[]) ?? []).map((x) => ({
        ...x,
        dose_value: num(x.dose_value),
        population: num(x.population),
        cost_ha: num(x.cost_ha),
      })),
    );
    setEtapas((s.data as EtapaDoEnsaio[]) ?? []);
    setAvaliacoes((a.data as AvaliacaoDoEnsaio[]) ?? []);
    setColheitas(
      ((h.data as ColheitaDoEnsaioRow[]) ?? []).map((x) => ({
        ...x,
        productivity: Number(x.productivity),
        net_weight_kg: num(x.net_weight_kg),
        harvested_area_ha: num(x.harvested_area_ha),
        moisture: Number(x.moisture),
        target_moisture: num(x.target_moisture),
        corrected_productivity: num(x.corrected_productivity),
        impurity: num(x.impurity),
        pmg: num(x.pmg),
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
    ensaios,
    produtos,
    etapas,
    avaliacoes,
    colheitas,
    carregando,
    recarregar,
    salvar,
    excluir,
  };
}

export type DadosDosEnsaios = ReturnType<typeof useEnsaios>;
