import { useEffect, useRef } from "react";
import X from "~icons/ph/x";
import { L } from "../../geo/leaflet";
import { caixaDe, type LatLng } from "../../geo/geometria";
import { useMapaLeaflet } from "./useMapaLeaflet";
import {
  BotaoDoMapa,
  BotaoGps,
  BuscaNoMapa,
  SeletorDeCamada,
} from "./ControlesDoMapa";

/**
 * Onde fica a sede da fazenda. Clicar no mapa (ou arrastar o pino) marca; o
 * "x" apaga. Mostra os talhões da fazenda em branco, para a sede ser marcada
 * com referência. Portado do FarmLocationPicker do Flag Field.
 *
 * A roda do mouse NÃO dá zoom: o mapa fica no meio de um formulário que rola, e
 * rolar a página não pode virar zoom quando o cursor passa por cima dele.
 */
export function SeletorDeSede({
  latitude,
  longitude,
  aoMudar,
  somenteLeitura,
  talhoes = [],
}: {
  latitude: number | null;
  longitude: number | null;
  aoMudar: (lat: number | null, lng: number | null) => void;
  somenteLeitura?: boolean;
  talhoes?: LatLng[][];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { mapa, camada, setCamada } = useMapaLeaflet(ref, {
    zoomComRoda: false,
  });
  const pinoRef = useRef<L.Marker | null>(null);
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const enquadrou = useRef(false);

  // Talhões de referência + enquadramento inicial (uma vez).
  useEffect(() => {
    if (!mapa) return;
    const grupo = L.layerGroup().addTo(mapa);
    for (const t of talhoes) {
      if (t.length >= 3) {
        L.polygon(t, {
          pane: "vizinhos",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(grupo);
      }
    }
    if (!enquadrou.current) {
      enquadrou.current = true;
      const caixa = caixaDe(talhoes);
      if (latitude != null && longitude != null) {
        mapa.setView([latitude, longitude], 15);
      } else if (caixa) {
        mapa.fitBounds(caixa, { padding: [30, 30], maxZoom: 16 });
      }
    }
    return () => {
      grupo.remove();
    };
  }, [mapa, talhoes, latitude, longitude]);

  // O pino acompanha o valor do formulário.
  useEffect(() => {
    if (!mapa) return;
    pinoRef.current?.remove();
    pinoRef.current = null;
    if (latitude == null || longitude == null) return;
    const pino = L.marker([latitude, longitude], {
      draggable: !somenteLeitura,
    }).addTo(mapa);
    pino.on("dragend", () => {
      const p = pino.getLatLng();
      aoMudarRef.current(p.lat, p.lng);
    });
    pinoRef.current = pino;
  }, [mapa, latitude, longitude, somenteLeitura]);

  // Clique marca a sede.
  useEffect(() => {
    if (!mapa || somenteLeitura) return;
    const aoClicar = (e: L.LeafletMouseEvent) =>
      aoMudarRef.current(e.latlng.lat, e.latlng.lng);
    mapa.on("click", aoClicar);
    mapa.getContainer().style.cursor = "crosshair";
    return () => {
      mapa.off("click", aoClicar);
      mapa.getContainer().style.cursor = "";
    };
  }, [mapa, somenteLeitura]);

  const irPara = (p: LatLng, zoom = 15) => mapa?.setView(p, zoom);

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200">
      <div ref={ref} className="h-[320px] w-full bg-slate-100" />
      {!somenteLeitura && (
        <div className="absolute top-2 left-12 right-14 z-[1000]">
          <BuscaNoMapa aoAchar={(p) => irPara(p)} />
        </div>
      )}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1.5">
        <SeletorDeCamada camada={camada} aoTrocar={setCamada} />
        <BotaoGps
          aoAchar={(p) => {
            irPara(p, 16);
            if (!somenteLeitura && latitude == null) aoMudar(p[0], p[1]);
          }}
        />
        {!somenteLeitura && latitude != null && (
          <BotaoDoMapa
            rotulo="Tirar a sede"
            onClick={() => aoMudar(null, null)}
          >
            <X className="size-5" />
          </BotaoDoMapa>
        )}
      </div>
      {!somenteLeitura && latitude == null && (
        <p className="absolute bottom-2 left-2 z-[1000] text-xs bg-white/90 rounded px-2 py-1 text-slate-600">
          Toque no mapa para marcar a sede.
        </p>
      )}
    </div>
  );
}
