import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Campo } from "../components/Cadastro";
import { PainelDeNdvi } from "../components/mapa/PainelDeNdvi";
import { useCadastros } from "../hooks/useCadastros";
import {
  mensagemDoErroDeNdvi,
  ndvi,
  type DataDeImagem,
} from "../hooks/useNdvi";
import { deGeoJson } from "../geo/geometria";

/**
 * NDVI e índices de vegetação (fase 5 da unificação) — Sentinel-2 pelo
 * Planetary Computer, via servidor (handlers/ndvi.ts). As datas vêm com a
 * fração do TALHÃO sem nuvem (a nuvem da cena de 110 km diz pouco). Teto de
 * imagens por mês por organização, mostrado aqui.
 */
export default function NdviPage() {
  const c = useCadastros();
  const [params] = useSearchParams();
  const [farmId, setFarmId] = useState("");
  const [plotId, setPlotId] = useState(params.get("talhao") ?? "");
  const [datas, setDatas] = useState<DataDeImagem[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [uso, setUso] = useState<{ usado: number; teto: number } | null>(null);
  const [comparar, setComparar] = useState(false);

  const comContorno = useMemo(
    () => c.talhoes.filter((t) => t.geometry?.type === "Polygon"),
    [c.talhoes],
  );
  const talhao = comContorno.find((t) => t.id === plotId) ?? null;
  const contorno = useMemo(() => deGeoJson(talhao?.geometry), [talhao]);

  // Talhão vindo por link: já seleciona a fazenda dele.
  useEffect(() => {
    if (talhao && !farmId) setFarmId(talhao.farm_id);
  }, [talhao, farmId]);

  const atualizarUso = () =>
    void ndvi
      .uso()
      .then(setUso)
      .catch(() => setUso(null));
  useEffect(atualizarUso, []);

  async function buscar() {
    if (!plotId) return;
    setBuscando(true);
    setErro(null);
    setDatas(null);
    setComparar(false);
    try {
      setDatas((await ndvi.datas(plotId)).datas);
    } catch (e) {
      setErro(mensagemDoErroDeNdvi(e));
    } finally {
      setBuscando(false);
    }
  }

  if (c.carregando) return <LoadingState />;
  if (comContorno.length === 0) {
    return (
      <EmptyStateCard
        title="Nenhum talhão com contorno"
        description="O NDVI precisa do desenho do talhão. Desenhe o contorno em Field → Talhões."
      />
    );
  }

  const talhoesDaFazenda = comContorno.filter(
    (t) => !farmId || t.farm_id === farmId,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <Campo rotulo="Fazenda">
          <SearchableSelect
            options={[
              { value: "", label: "Todas as fazendas" },
              ...c.fazendas.map((f) => ({ value: f.id, label: f.name })),
            ]}
            value={farmId}
            onValueChange={(v) => {
              setFarmId(v);
              setPlotId("");
              setDatas(null);
            }}
          />
        </Campo>
        <Campo rotulo="Talhão">
          <SearchableSelect
            options={talhoesDaFazenda.map((t) => ({
              value: t.id,
              label: t.name,
            }))}
            value={plotId}
            onValueChange={(v) => {
              setPlotId(v);
              setDatas(null);
            }}
            placeholder="Escolha o talhão"
            searchPlaceholder="Buscar talhão..."
          />
        </Campo>
        <Button
          type="button"
          onClick={() => void buscar()}
          disabled={!plotId || buscando}
        >
          {buscando ? "Buscando..." : "Buscar imagens"}
        </Button>
      </div>

      {uso && (
        <p className="text-xs text-slate-500">
          {uso.usado} de {uso.teto} imagens de satélite usadas este mês (a
          organização inteira).
        </p>
      )}
      {erro && <p className="text-sm text-red-700">{erro}</p>}

      {datas && datas.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhuma passagem do satélite com o talhão visível nos últimos 6 meses.
        </p>
      )}

      {talhao && datas && datas.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {datas.length}{" "}
              {datas.length === 1 ? "data disponível" : "datas disponíveis"}{" "}
              para <strong className="font-medium">{talhao.name}</strong>
            </p>
            {datas.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setComparar((x) => !x)}
              >
                {comparar ? "Ver uma data" : "Comparar duas datas"}
              </Button>
            )}
          </div>
          <div
            className={comparar ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : ""}
          >
            <PainelDeNdvi
              key={`${talhao.id}-a`}
              plotId={talhao.id}
              contorno={contorno}
              datas={datas}
              aoUsar={atualizarUso}
            />
            {comparar && (
              <PainelDeNdvi
                key={`${talhao.id}-b`}
                plotId={talhao.id}
                contorno={contorno}
                datas={datas}
                dataInicial={datas[1]?.date}
                aoUsar={atualizarUso}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
