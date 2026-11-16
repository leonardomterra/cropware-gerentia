import { useEffect, useRef, useState, type RefObject } from "react";
import {
  CAMADAS,
  CENTRO_PADRAO,
  L,
  ROTULOS_URL,
  type CamadaDoMapa,
} from "../../geo/leaflet";

/**
 * Cria um mapa Leaflet dentro de `container` e cuida do ciclo de vida: camada de
 * fundo (satélite ou mapa), rótulos por cima do satélite, ajuste de tamanho
 * quando o contêiner muda (abrir num painel, girar o celular) e `remove()` ao
 * desmontar.
 *
 * O mapa só existe depois do primeiro efeito — por isso volta como ESTADO, e
 * quem desenha por cima espera ele chegar (`if (!mapa) return`).
 */
export function useMapaLeaflet(
  container: RefObject<HTMLDivElement | null>,
  opcoes: { zoomComRoda?: boolean; interativo?: boolean } = {},
) {
  const [mapa, setMapa] = useState<L.Map | null>(null);
  const [camada, setCamada] = useState<CamadaDoMapa["id"]>("satelite");
  const fundoRef = useRef<L.TileLayer | null>(null);
  const rotulosRef = useRef<L.TileLayer | null>(null);
  const { zoomComRoda = true, interativo = true } = opcoes;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const m = L.map(el, {
      center: CENTRO_PADRAO,
      zoom: 4,
      zoomControl: interativo,
      attributionControl: true,
      scrollWheelZoom: zoomComRoda,
      dragging: interativo,
      doubleClickZoom: interativo,
      touchZoom: interativo,
      boxZoom: interativo,
      keyboard: interativo,
    });
    // Panes próprios: talhões vizinhos por baixo, o que está sendo editado por
    // cima, vértices acima de tudo — sem isso a ordem depende de quem foi
    // desenhado por último.
    m.createPane("vizinhos").style.zIndex = "410";
    m.createPane("desenho").style.zIndex = "420";
    m.createPane("vertices").style.zIndex = "640";
    setMapa(m);

    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(el);
    return () => {
      obs.disconnect();
      m.remove();
      setMapa(null);
    };
  }, [container, zoomComRoda, interativo]);

  useEffect(() => {
    if (!mapa) return;
    const c = CAMADAS.find((x) => x.id === camada) ?? CAMADAS[0];
    fundoRef.current?.remove();
    rotulosRef.current?.remove();
    fundoRef.current = L.tileLayer(c.url, {
      attribution: c.atribuicao,
      maxZoom: c.maxZoom,
      maxNativeZoom: c.maxZoom,
      ...(c.subdominios ? { subdomains: c.subdominios } : {}),
    }).addTo(mapa);
    rotulosRef.current = c.comRotulos
      ? L.tileLayer(ROTULOS_URL, { maxZoom: 20, subdomains: "abcd" }).addTo(
          mapa,
        )
      : null;
  }, [mapa, camada]);

  return { mapa, camada, setCamada };
}
