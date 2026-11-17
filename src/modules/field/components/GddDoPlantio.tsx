import { useEffect, useState } from "react";
import { tbaseDa } from "../dominio/gdd";
import { gddDoPlantio, localDaFazenda } from "../hooks/useClima";
import type { Fazenda, Plantio, Talhao } from "../types";

/**
 * Graus-dia acumulados desde o plantio (fase 5). Por PLANTIO, com a
 * temperatura-base da cultura dele — o painel do Flag Field tirava a média de
 * culturas com bases diferentes, o que não tem sentido agronômico.
 */
export function GddDoPlantio({
  plantio,
  fazenda,
  talhoes,
}: {
  plantio: Plantio;
  fazenda: Fazenda | null;
  talhoes: Talhao[];
}) {
  const [gdd, setGdd] = useState<number | null>(null);
  const [erro, setErro] = useState(false);
  const local = fazenda ? localDaFazenda(fazenda, talhoes) : null;
  const tbase = tbaseDa(plantio.crop);
  const inicio = plantio.planting_date;

  useEffect(() => {
    if (!local || !inicio || inicio > new Date().toISOString().slice(0, 10))
      return;
    let vivo = true;
    gddDoPlantio(plantio, fazenda, talhoes)
      .then((r) => vivo && r && setGdd(r.valor))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.[0], local?.[1], inicio, tbase]);

  if (!inicio) return null;
  if (!local) {
    return (
      <p className="text-xs text-slate-500">
        GDD: marque a sede da fazenda ou desenhe o talhão para calcular.
      </p>
    );
  }
  return (
    <p className="text-sm text-slate-700">
      Graus-dia desde o plantio:{" "}
      <strong className="font-medium tabular-nums">
        {erro
          ? "indisponível"
          : gdd == null
            ? "calculando..."
            : gdd.toLocaleString("pt-BR")}
      </strong>{" "}
      <span className="text-xs text-slate-500">
        (temperatura-base {tbase} °C)
      </span>
    </p>
  );
}
