import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Leaflet configurado uma vez para o app inteiro.
 *
 * O ícone padrão do Leaflet aponta para PNGs que o Vite não empacota (o marcador
 * aparece quebrado). Troca por SVG embutido — o mesmo pino do Flag Field.
 */
const PINO = `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 1.108.142 2.186.41 3.215l11.59 24.285 11.59-24.285c.268-1.029.41-2.107.41-3.215C25 5.596 19.404 0 12.5 0z" fill="#3b82f6"/><circle cx="12.5" cy="12.5" r="5" fill="white"/></svg>`;
const SOMBRA = `<svg width="41" height="41" viewBox="0 0 41 41" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="38" rx="11" ry="3" fill="rgba(0,0,0,0.4)"/></svg>`;
const urlSvg = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: urlSvg(PINO),
  iconRetinaUrl: urlSvg(PINO),
  shadowUrl: urlSvg(SOMBRA),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface CamadaDoMapa {
  id: "satelite" | "mapa";
  nome: string;
  url: string;
  atribuicao: string;
  maxZoom: number;
  subdominios?: string;
  /** Sobrepõe os rótulos (cidades, estradas) por cima — só na imagem de satélite. */
  comRotulos: boolean;
}

/**
 * Camadas de fundo. SEM os tiles diretos do Google (mt1.google.com), que o Flag
 * Field usava: consumir aquilo sem a API paga fica numa zona cinza dos termos
 * de uso. A imagem da Esri é gratuita com atribuição.
 */
export const CAMADAS: CamadaDoMapa[] = [
  {
    id: "satelite",
    nome: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    atribuicao: "&copy; Esri",
    maxZoom: 19,
    comRotulos: true,
  },
  {
    id: "mapa",
    nome: "Mapa",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    atribuicao: "&copy; OpenStreetMap",
    maxZoom: 19,
    subdominios: "abc",
    comRotulos: false,
  },
];

export const ROTULOS_URL =
  "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";

/** Centro do Brasil — quando não há nada para enquadrar. */
export const CENTRO_PADRAO: [number, number] = [-15.7801, -47.9292];

export { L };
