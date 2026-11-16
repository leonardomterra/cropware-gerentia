/**
 * Geometria dos talhões — funções puras, sem Leaflet e sem React.
 *
 * Portado do Flag Field (MapDrawingToolAdvanced.tsx + utils/polygonUtils.ts),
 * que fazia tudo à mão, sem turf. Ver docs/UNIFICACAO-FIELD.md.
 *
 * CONVENÇÃO DE COORDENADAS — a fonte de erro nº 1 deste assunto:
 *   - Dentro do app (mapa, edição): `LatLng = [lat, lng]`, a ordem do Leaflet.
 *   - No BANCO (`farm_plots.geometry`): GeoJSON, que é `[lng, lat]`.
 * A troca acontece SÓ em `paraGeoJson` / `deGeoJson`. Nenhum outro lugar inverte.
 *
 * O anel é guardado ABERTO aqui dentro (sem repetir o 1º ponto); o GeoJSON exige
 * o anel FECHADO, então `paraGeoJson` fecha e `deGeoJson` abre.
 */

export type LatLng = [number, number];

/** GeoJSON que o banco aceita (check em farm_plots.geometry). */
export type GeometriaDoTalhao =
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "Point"; coordinates: [number, number] };

const D2R = Math.PI / 180;
/** Raio equatorial (m) — o mesmo do Leaflet.Draw, para a área bater com o Flag Field. */
const R_EQUATORIAL = 6378137;
/** Raio médio (m) — haversine. */
const R_MEDIO = 6371000;
/** Metros por grau de latitude (aproximação usada no pivô). */
const M_POR_GRAU = 111320;

/**
 * Área geodésica (esférica) em hectares. Corrige a distorção da conta plana em
 * graus: 1° de longitude encolhe com cos(latitude), e a shoelace plana
 * superestimava ~2,5% em MG/GO.
 */
export function areaHa(pts: LatLng[]): number {
  const n = pts.length;
  if (n < 3) return 0;
  let soma = 0;
  for (let i = 0; i < n; i++) {
    const [lat1, lng1] = pts[i];
    const [lat2, lng2] = pts[(i + 1) % n];
    soma +=
      (lng2 - lng1) * D2R * (2 + Math.sin(lat1 * D2R) + Math.sin(lat2 * D2R));
  }
  return Math.abs((soma * R_EQUATORIAL * R_EQUATORIAL) / 2) / 10000;
}

/** Distância entre dois pontos, em metros (haversine). */
export function distanciaM([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const dLat = (lat2 - lat1) * D2R;
  const dLng = (lng2 - lng1) * D2R;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MEDIO * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Perímetro do polígono fechado (inclui a aresta último → primeiro), em metros. */
export function perimetroM(pts: LatLng[]): number {
  const n = pts.length;
  if (n < 2) return 0;
  let soma = 0;
  for (let i = 0; i < n; i++) soma += distanciaM(pts[i], pts[(i + 1) % n]);
  return soma;
}

/** "850 m" ou "1,24 km". */
export function formatarDistancia(m: number): string {
  return m >= 1000
    ? `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`
    : `${Math.round(m)} m`;
}

/** "12,5 ha". */
export function formatarArea(ha: number): string {
  return `${ha.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`;
}

function cruzam(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const ccw = (p: LatLng, q: LatLng, r: LatLng) =>
    (r[1] - p[1]) * (q[0] - p[0]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = ccw(c, d, a);
  const d2 = ccw(c, d, b);
  const d3 = ccw(a, b, c);
  const d4 = ccw(a, b, d);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Polígono "gravata-borboleta": duas arestas NÃO vizinhas se cruzam. A área de
 * um polígono assim não significa nada, então o editor recusa.
 */
export function seAutoIntercepta(pts: LatLng[]): boolean {
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Pula as arestas que compartilham vértice (vizinhas e a de fechamento).
      if (j === (i + 1) % n || (j + 1) % n === i) continue;
      if (cruzam(a, b, pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * Pivô central → polígono de `lados` vértices. O pivô é guardado como polígono
 * (e não como círculo) para ser editável vértice a vértice e caber no mesmo
 * GeoJSON dos outros talhões.
 */
export function pivoParaPoligono(
  centro: LatLng,
  raioM: number,
  lados = 36,
): LatLng[] {
  const [lat, lng] = centro;
  const pts: LatLng[] = [];
  for (let i = 0; i < lados; i++) {
    const ang = (i / lados) * 2 * Math.PI;
    pts.push([
      lat + (raioM / M_POR_GRAU) * Math.cos(ang),
      lng + (raioM / (M_POR_GRAU * Math.cos(lat * D2R))) * Math.sin(ang),
    ]);
  }
  return pts;
}

/** Ray casting. */
export function pontoDentro([lat, lng]: LatLng, poligono: LatLng[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [latI, lngI] = poligono[i];
    const [latJ, lngJ] = poligono[j];
    const corta =
      lngI > lng !== lngJ > lng &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
    if (corta) dentro = !dentro;
  }
  return dentro;
}

function media(pts: LatLng[]): LatLng {
  const s = pts.reduce<LatLng>(
    (acc, [a, b]) => [acc[0] + a, acc[1] + b],
    [0, 0],
  );
  return [s[0] / pts.length, s[1] / pts.length];
}

function limites(pts: LatLng[]) {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const [lat, lng] of pts) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Ponto para o rótulo do talhão, GARANTIDAMENTE dentro dele. O centróide
 * geométrico de um talhão em "L" ou em "U" cai fora do polígono; nesse caso
 * procura numa grade 10×10 o ponto interno mais longe das bordas.
 */
export function pontoDoRotulo(pts: LatLng[]): LatLng {
  if (pts.length < 3) return media(pts);

  let area = 0,
    cLat = 0,
    cLng = 0;
  for (let i = 0; i < pts.length; i++) {
    const [latI, lngI] = pts[i];
    const [latJ, lngJ] = pts[(i + 1) % pts.length];
    const cruz = lngI * latJ - lngJ * latI;
    area += cruz;
    cLng += (lngI + lngJ) * cruz;
    cLat += (latI + latJ) * cruz;
  }
  area /= 2;
  const centroide: LatLng =
    Math.abs(area) < 1e-6 ? media(pts) : [cLat / (6 * area), cLng / (6 * area)];
  if (pontoDentro(centroide, pts)) return centroide;

  const { minLat, maxLat, minLng, maxLng } = limites(pts);
  const passoLat = (maxLat - minLat) / 10;
  const passoLng = (maxLng - minLng) / 10;
  let melhor: LatLng | null = null;
  let melhorDist = -Infinity;
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      const p: LatLng = [minLat + i * passoLat, minLng + j * passoLng];
      if (!pontoDentro(p, pts)) continue;
      let menor = Infinity;
      for (let k = 0; k < pts.length; k++) {
        const [aLat, aLng] = pts[k];
        const [bLat, bLng] = pts[(k + 1) % pts.length];
        const d =
          Math.abs(
            (bLng - aLng) * p[0] -
              (bLat - aLat) * p[1] +
              bLat * aLng -
              bLng * aLat,
          ) / Math.hypot(bLng - aLng, bLat - aLat);
        if (d < menor) menor = d;
      }
      if (menor > melhorDist) {
        melhorDist = menor;
        melhor = p;
      }
    }
  }
  return melhor ?? [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
}

/** Desenho do editor → GeoJSON do banco. 1 ponto = marcador; 3+ = polígono. */
export function paraGeoJson(pts: LatLng[]): GeometriaDoTalhao | null {
  if (pts.length === 1)
    return { type: "Point", coordinates: [pts[0][1], pts[0][0]] };
  if (pts.length < 3) return null;
  const anel = pts.map(([lat, lng]) => [lng, lat] as [number, number]);
  anel.push(anel[0]);
  return { type: "Polygon", coordinates: [anel] };
}

/** GeoJSON do banco → pontos do editor (anel aberto). */
export function deGeoJson(g: GeometriaDoTalhao | null | undefined): LatLng[] {
  if (!g) return [];
  if (g.type === "Point") return [[g.coordinates[1], g.coordinates[0]]];
  const anel = (g.coordinates[0] ?? []).map(
    ([lng, lat]) => [lat, lng] as LatLng,
  );
  if (anel.length > 1) {
    const [p, u] = [anel[0], anel[anel.length - 1]];
    if (p[0] === u[0] && p[1] === u[1]) anel.pop();
  }
  return anel;
}

/** Caixa que envolve vários talhões — para enquadrar o mapa ou a miniatura. */
export function caixaDe(conjuntos: LatLng[][]): [LatLng, LatLng] | null {
  const todos = conjuntos.flat();
  if (todos.length === 0) return null;
  const { minLat, maxLat, minLng, maxLng } = limites(todos);
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
