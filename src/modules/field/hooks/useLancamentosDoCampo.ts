import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import type { LancamentoDoCampo } from "../dominio/custo";

/** Lançamentos de despesa ligados a fazenda/talhão — a parte "realizado". */
export function useLancamentosDoCampo() {
  const [lancamentos, setLancamentos] = useState<LancamentoDoCampo[]>([]);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    void supabase
      .from("farm_receipts")
      .select(
        "farm_id, plot_id, total_value, direction, status, doc_type, is_estimated, transaction_date, paid_date, description",
      )
      .not("farm_id", "is", null)
      .eq("direction", "expense")
      .limit(10000)
      .then(({ data }) => {
        setLancamentos(
          ((data as LancamentoDoCampo[]) ?? []).map((r) => ({
            ...r,
            total_value: Number(r.total_value),
          })),
        );
        setCarregando(false);
      });
  }, []);
  return { lancamentos, carregando };
}
