import { useEffect, useState } from "react";
import {
  anexosDoPlantio,
  montarRelatorioDoPlantio,
  type DadosDoPlantio,
} from "../dominio/relatorioDoPlantio";
import type { Plantio } from "../types";
import { BotoesDoRelatorio } from "./BotoesDoRelatorio";
import {
  carregarDadosDoPlantio,
  nomeDoRelatorioDoPlantio,
  type Cadastros,
} from "./doPlantio";

/** Botões no topo do plantio aberto: CSV · Relatório · com fotos. */
export function RelatorioDoPlantio({
  plantio,
  c,
}: {
  plantio: Plantio;
  c: Cadastros;
}) {
  const [dados, setDados] = useState<DadosDoPlantio | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    carregarDadosDoPlantio(plantio, c)
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantio.id]);

  if (erro)
    return (
      <p className="text-xs text-red-700">
        Não foi possível carregar o relatório.
      </p>
    );
  if (!dados)
    return <p className="text-xs text-slate-400">Preparando o relatório…</p>;
  return (
    <BotoesDoRelatorio
      montar={() => montarRelatorioDoPlantio(dados)}
      nome={nomeDoRelatorioDoPlantio(plantio, c)}
      anexos={anexosDoPlantio(dados.atividades)}
    />
  );
}
