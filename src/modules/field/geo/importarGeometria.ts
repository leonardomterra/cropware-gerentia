import type { LatLng } from "./geometria";

/**
 * Importa o contorno de um talhão de um arquivo KML, KMZ ou GeoJSON — o que sai
 * do Google Earth, do QGIS e dos monitores de colheita/plantio.
 *
 * Portado do Flag Field. Sem biblioteca de parser: KML é XML simples
 * (DOMParser) e KMZ é um ZIP com um .kml dentro (JSZip, carregado só quando
 * preciso). Pega o PRIMEIRO polígono do arquivo.
 *
 * Devolve o anel ABERTO em [lat, lng]. Lança `ErroDeImportacao` com uma frase
 * pronta para mostrar ao usuário.
 */
export class ErroDeImportacao extends Error {}

export const EXTENSOES_ACEITAS = ".kml,.kmz,.json,.geojson";

function soValidos(pares: LatLng[]): LatLng[] {
  return pares.filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng),
  );
}

function deKml(texto: string): LatLng[] | null {
  const doc = new DOMParser().parseFromString(texto, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new ErroDeImportacao("O arquivo KML está corrompido.");
  }
  // KML sempre tem namespace; getElementsByTagName casa pelo nome local de forma
  // confiável (querySelector com namespace é instável).
  const poligonos = doc.getElementsByTagName("Polygon");
  let coords =
    poligonos.length > 0
      ? (poligonos[0].getElementsByTagName("coordinates")[0]?.textContent ?? "")
      : "";
  if (!coords.trim()) {
    coords = doc.getElementsByTagName("coordinates")[0]?.textContent ?? "";
  }
  if (!coords.trim()) return null;
  // Cada ponto é "lng,lat[,altitude]", separados por espaço ou quebra de linha.
  return soValidos(
    coords
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((pt) => {
        const [lng, lat] = pt.split(",").map(Number);
        return [lat, lng] as LatLng;
      }),
  );
}

function deGeoJsonTexto(texto: string): LatLng[] | null {
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new ErroDeImportacao("O arquivo GeoJSON está corrompido.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = json as any;
  const geometria =
    j?.type === "FeatureCollection"
      ? j.features?.[0]?.geometry
      : j?.type === "Feature"
        ? j.geometry
        : j;
  const paraLatLng = (anel: number[][]) =>
    soValidos(anel.map(([lng, lat]) => [lat, lng] as LatLng));
  if (geometria?.type === "Polygon")
    return paraLatLng(geometria.coordinates[0]);
  if (geometria?.type === "MultiPolygon")
    return paraLatLng(geometria.coordinates[0][0]);
  return null;
}

async function kmlDeDentroDoKmz(dados: ArrayBuffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(dados);
  const kml = Object.values(zip.files).find((f) =>
    f.name.toLowerCase().endsWith(".kml"),
  );
  if (!kml) throw new ErroDeImportacao("O arquivo KMZ não contém um .kml.");
  return kml.async("text");
}

export async function importarArquivoDeContorno(
  arquivo: File,
): Promise<LatLng[]> {
  const nome = arquivo.name.toLowerCase();
  let pontos: LatLng[] | null;

  if (nome.endsWith(".kmz")) {
    pontos = deKml(await kmlDeDentroDoKmz(await arquivo.arrayBuffer()));
  } else {
    const texto = await arquivo.text();
    if (texto.startsWith("PK")) {
      // KMZ renomeado para .kml (assinatura de ZIP): trata como KMZ.
      pontos = deKml(await kmlDeDentroDoKmz(await arquivo.arrayBuffer()));
    } else if (nome.endsWith(".kml")) {
      pontos = deKml(texto);
    } else if (nome.endsWith(".json") || nome.endsWith(".geojson")) {
      pontos = deGeoJsonTexto(texto);
    } else {
      throw new ErroDeImportacao("Use um arquivo KML, KMZ ou GeoJSON.");
    }
  }

  if (!pontos || pontos.length < 3) {
    throw new ErroDeImportacao("Nenhum polígono encontrado no arquivo.");
  }
  // Anel fechado (1º = último) → abre.
  const [p, u] = [pontos[0], pontos[pontos.length - 1]];
  if (p[0] === u[0] && p[1] === u[1]) pontos.pop();
  return pontos;
}
