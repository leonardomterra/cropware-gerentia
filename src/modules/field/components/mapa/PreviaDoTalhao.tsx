import { useEffect, useRef } from "react";
import { L } from "../../geo/leaflet";
import { caixaDe, type LatLng } from "../../geo/geometria";
import { useMapaLeaflet } from "./useMapaLeaflet";

/**
 * Vista do talhão sobre o satélite, só para olhar (sem arrastar, sem zoom) —
 * no formulário. Editar é no EditorDeTalhao, que abre em página inteira.
 */
export function PreviaDoTalhao({
  pontos,
  vizinhos,
}: {
  pontos: LatLng[];
  vizinhos: LatLng[][];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { mapa } = useMapaLeaflet(ref, {
    interativo: false,
    zoomComRoda: false,
  });

  useEffect(() => {
    if (!mapa) return;
    const g = L.layerGroup().addTo(mapa);
    for (const v of vizinhos) {
      if (v.length >= 3)
        L.polygon(v, {
          pane: "vizinhos",
          color: "#ffffff",
          weight: 1.5,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(g);
    }
    if (pontos.length === 1)
      L.marker(pontos[0], { interactive: false }).addTo(g);
    else if (pontos.length >= 3)
      L.polygon(pontos, {
        pane: "desenho",
        color: "#facc15",
        weight: 2.5,
        fillOpacity: 0.2,
        interactive: false,
      }).addTo(g);

    if (pontos.length === 1) mapa.setView(pontos[0], 16);
    else {
      const caixa = caixaDe([pontos]);
      if (caixa) mapa.fitBounds(caixa, { padding: [24, 24], maxZoom: 17 });
    }
    return () => {
      g.remove();
    };
  }, [mapa, pontos, vizinhos]);

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200">
      <div ref={ref} className="h-[260px] w-full bg-slate-100" />
    </div>
  );
}
