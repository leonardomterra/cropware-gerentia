/**
 * Fazenda/talhão de um lançamento ou de uma pendência (módulo Field —
 * docs/UNIFICACAO-FIELD.md).
 *
 * Confere com o client do USUÁRIO, então vale a RLS: só passa fazenda/talhão
 * que a pessoa enxerga, o que também barra apontar para outra organização (a
 * FK sozinha ignora a RLS e aceitaria). Talhão sem fazenda: a fazenda é
 * deduzida dele. Os dois juntos têm que bater.
 */
export async function resolveFarmPlot(
  // deno-lint-ignore no-explicit-any
  client: any,
  farmIdRaw: unknown,
  plotIdRaw: unknown,
): Promise<{ farm_id: string | null; plot_id: string | null } | { error: string }> {
  const farmId = typeof farmIdRaw === "string" && farmIdRaw ? farmIdRaw : null;
  const plotId = typeof plotIdRaw === "string" && plotIdRaw ? plotIdRaw : null;
  if (plotId) {
    const { data: plot } = await client
      .from("farm_plots").select("id, farm_id").eq("id", plotId).maybeSingle();
    if (!plot) return { error: "invalid_plot" };
    if (farmId && farmId !== plot.farm_id) return { error: "plot_not_in_farm" };
    return { farm_id: plot.farm_id, plot_id: plot.id };
  }
  if (farmId) {
    const { data: farm } = await client
      .from("farms").select("id").eq("id", farmId).maybeSingle();
    if (!farm) return { error: "invalid_farm" };
    return { farm_id: farm.id, plot_id: null };
  }
  return { farm_id: null, plot_id: null };
}
