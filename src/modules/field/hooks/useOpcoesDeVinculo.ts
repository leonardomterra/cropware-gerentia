import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

/**
 * Fazendas e talhões para ligar um LANÇAMENTO a eles (formulário do
 * financeiro). Versão enxuta do useCadastros: só id/nome, e só busca quando o
 * módulo Field está visível — quem só usa o Finanças não paga essa consulta.
 */
export interface OpcaoDeFazenda {
  id: string;
  name: string;
}
export interface OpcaoDeTalhao {
  id: string;
  name: string;
  farm_id: string;
}

export function useOpcoesDeVinculo(ativo: boolean) {
  const [fazendas, setFazendas] = useState<OpcaoDeFazenda[]>([]);
  const [talhoes, setTalhoes] = useState<OpcaoDeTalhao[]>([]);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    void Promise.all([
      supabase.from("farms").select("id, name").order("name"),
      supabase.from("farm_plots").select("id, name, farm_id").order("name"),
    ]).then(([f, t]) => {
      if (!vivo) return;
      setFazendas((f.data as OpcaoDeFazenda[]) ?? []);
      setTalhoes((t.data as OpcaoDeTalhao[]) ?? []);
    });
    return () => {
      vivo = false;
    };
  }, [ativo]);

  return { fazendas, talhoes };
}
