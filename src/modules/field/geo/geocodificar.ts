import type { LatLng } from "./geometria";

/**
 * Busca de lugar no mapa: aceita coordenada digitada ("-17.79, -50.92") ou um
 * nome (cidade, fazenda conhecida, rodovia), resolvido no Nominatim
 * (OpenStreetMap, gratuito, sem chave), restrito ao Brasil.
 *
 * Devolve null quando não acha; lança quando a rede falha.
 */
const COORDENADA =
  /^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/;

export function lerCoordenada(texto: string): LatLng | null {
  const m = texto.match(COORDENADA);
  if (!m) return null;
  const lat = Number(m[1].replace(",", "."));
  const lng = Number(m[2].replace(",", "."));
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

export async function buscarLugar(texto: string): Promise<LatLng | null> {
  const coordenada = lerCoordenada(texto);
  if (coordenada) return coordenada;

  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=" +
    encodeURIComponent(texto.trim());
  const resp = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!resp.ok) throw new Error("Falha na busca de localização.");
  const dados = (await resp.json()) as { lat: string; lon: string }[];
  if (!dados.length) return null;
  return [parseFloat(dados[0].lat), parseFloat(dados[0].lon)];
}
