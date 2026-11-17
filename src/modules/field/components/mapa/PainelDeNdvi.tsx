import { useEffect, useRef, useState } from "react";
import { L } from "../../geo/leaflet";
import { caixaDe, type LatLng } from "../../geo/geometria";
import { useMapaLeaflet } from "./useMapaLeaflet";
import { SeletorDeCamada } from "./ControlesDoMapa";
import {
  INDICES_DE_VEGETACAO,
  mensagemDoErroDeNdvi,
  ndvi,
  type DataDeImagem,
  type EstatisticasDeIndice,
  type ImagemDeIndice,
  type IndiceDeVegetacao,
} from "../../hooks/useNdvi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/components/ui/utils";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const n3 = (x: number) =>
  x.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });

/**
 * Um painel de NDVI: data + índice → a imagem POR CIMA do satélite (camada
 * Leaflet no retângulo exato que o servidor devolve; no Flag Field era um
 * canvas esticado), o contorno do talhão, a legenda do MESMO colormap e as
 * estatísticas do talhão (só pixels sem nuvem).
 *
 * Cada imagem nova conta 1 do teto mensal — por isso nada carrega sozinho ao
 * trocar de data: a pessoa escolhe e a imagem vem.
 */
export function PainelDeNdvi({
  plotId,
  contorno,
  datas,
  dataInicial,
  aoUsar,
}: {
  plotId: string;
  contorno: LatLng[];
  datas: DataDeImagem[];
  dataInicial?: string;
  /** Avisa que uma imagem foi gerada (para o contador do mês). */
  aoUsar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { mapa, camada, setCamada } = useMapaLeaflet(ref, {
    zoomComRoda: false,
  });
  const [sceneId, setSceneId] = useState(
    datas.find((d) => d.date === dataInicial)?.scene_id ??
      datas[0]?.scene_id ??
      "",
  );
  const [indice, setIndice] = useState<IndiceDeVegetacao>("NDVI");
  const [img, setImg] = useState<ImagemDeIndice | null>(null);
  const [stats, setStats] = useState<EstatisticasDeIndice | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aoUsarRef = useRef(aoUsar);
  aoUsarRef.current = aoUsar;

  // Busca a imagem (e as estatísticas) quando data ou índice mudam.
  useEffect(() => {
    if (!sceneId) return;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    setStats(null);
    void (async () => {
      try {
        const i = await ndvi.imagem(plotId, sceneId, indice);
        if (!vivo) return;
        setImg(i);
        aoUsarRef.current();
        if (indice !== "RGB") {
          ndvi
            .estatisticas(plotId, sceneId, indice)
            .then((s) => vivo && setStats(s))
            .catch(() => vivo && setStats(null));
        }
      } catch (e) {
        if (vivo) {
          setImg(null);
          setErro(mensagemDoErroDeNdvi(e));
        }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [plotId, sceneId, indice]);

  // Camadas: imagem do índice + contorno; enquadra no talhão.
  useEffect(() => {
    if (!mapa) return;
    const g = L.layerGroup().addTo(mapa);
    if (img) L.imageOverlay(img.imagem, img.bounds, { opacity: 0.92 }).addTo(g);
    if (contorno.length >= 3) {
      L.polygon(contorno, {
        color: "#ffffff",
        weight: 2,
        fill: false,
        interactive: false,
      }).addTo(g);
    }
    const caixa = caixaDe([contorno]);
    if (caixa) mapa.fitBounds(caixa, { padding: [24, 24], maxZoom: 17 });
    return () => {
      g.remove();
    };
  }, [mapa, img, contorno]);

  const dataAtual = datas.find((d) => d.scene_id === sceneId);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Select value={sceneId} onValueChange={setSceneId}>
          <SelectTrigger>
            <SelectValue placeholder="Data" />
          </SelectTrigger>
          <SelectContent>
            {datas.map((d) => (
              <SelectItem key={d.scene_id} value={d.scene_id}>
                {dataBr(d.date)} · {pct(d.clareza)} limpo
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={indice}
          onValueChange={(v) => setIndice(v as IndiceDeVegetacao)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INDICES_DE_VEGETACAO.map((i) => (
              <SelectItem key={i.valor} value={i.valor}>
                {i.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-slate-200">
        <div ref={ref} className="h-[380px] w-full bg-slate-100" />
        <div className="absolute top-2 right-2 z-[1000]">
          <SeletorDeCamada camada={camada} aoTrocar={setCamada} />
        </div>
        {(carregando || erro) && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/60">
            <p
              className={cn(
                "text-sm px-3 text-center",
                erro ? "text-red-700" : "text-slate-600",
              )}
            >
              {erro ?? "Buscando a imagem do satélite..."}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {INDICES_DE_VEGETACAO.find((i) => i.valor === indice)?.dica}
        {dataAtual ? ` · Sentinel-2 de ${dataBr(dataAtual.date)}` : ""}
      </p>

      {img && img.legenda.length > 0 && (
        <div>
          <div className="flex h-3 rounded overflow-hidden">
            {img.legenda.map((f, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: f.cor }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 tabular-nums">
            <span>{n3(img.legenda[0].de)}</span>
            <span>{n3(img.legenda[img.legenda.length - 1].de)}+</span>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-5 gap-2 text-center">
          {(
            [
              ["Média", n3(stats.media)],
              ["Mediana", n3(stats.mediana)],
              ["Mín.", n3(stats.min)],
              ["Máx.", n3(stats.max)],
              ["Sem nuvem", pct(stats.clareza)],
            ] as const
          ).map(([r, v]) => (
            <div key={r} className="rounded-md bg-slate-50 py-1.5">
              <p className="text-[11px] text-slate-500">{r}</p>
              <p className="text-sm font-medium text-slate-900 tabular-nums">
                {v}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
