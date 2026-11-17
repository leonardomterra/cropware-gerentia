/**
 * Sentinel-2 L2A pelo Microsoft Planetary Computer (STAC + Titiler) — o NDVI
 * do módulo Field. Portado de planetary_computer.tsx do Flag Field, SEM o
 * legado (NASA GIBS, Google, getAvailableDates) e com as correções de 16/11/2026:
 *   - a imagem e a estatística usam a CENA escolhida (scene_id), e não uma nova
 *     busca "menor nuvem na cena ±3 dias" (que podia trazer outra data);
 *   - o desconto de +1000 por banda só vale para baseline >= 04.00;
 *   - W×H na proporção do retângulo (a imagem 1024×1024 saía esticada);
 *   - a legenda sai do MESMO colormap da imagem;
 *   - erro é erro (o Flag Field inventava estatística quando falhava).
 *
 * Coordenadas: o banco guarda GeoJSON ([lng,lat]); aqui tudo é [lng,lat].
 * Chave opcional PLANETARY_COMPUTER_KEY (só aumenta o limite de uso).
 */

const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1";
const DATA_API = "https://planetarycomputer.microsoft.com/api/data/v1";
const COLLECTION = "sentinel-2-l2a";

/** SCL descartadas: 0 sem dado · 1 saturado · 3 sombra · 8/9 nuvem · 10 cirrus · 11 neve. */
const BAD_SCL = [0, 1, 3, 8, 9, 10, 11];
const CLEAR = `(${BAD_SCL.map((c) => `(SCL!=${c})`).join("&")})`;

export const INDICES = ["NDVI", "NDRE", "NDMI", "SAVI", "GNDVI", "EVI", "PSRI"] as const;
export type Indice = (typeof INDICES)[number] | "RGB";

/**
 * Fórmulas, em duas versões. Cenas com `s2:processing_baseline` >= 04.00 (todas
 * desde 25/01/2022) trazem +1000 em cada banda: a diferença no numerador se
 * cancela, mas a SOMA no denominador vem 2000 maior e achata o índice (medido
 * no Flag Field: 0,53 sem o desconto, 0,84 com ele, em lavoura fechada).
 */
const EXPR_COM_OFFSET: Record<string, string> = {
  NDVI: "(B08-B04)/(B08+B04-2000)",
  GNDVI: "(B08-B03)/(B08+B03-2000)",
  NDRE: "(B08-B05)/(B08+B05-2000)",
  EVI: "2.5*((B08-B04)/(B08+6*B04-7.5*B02+10500))",
  NDMI: "(B08-B11)/(B08+B11-2000)",
  SAVI: "1.5*((B08-B04)/(B08+B04+3000))",
  PSRI: "(B04-B02)/(B06-1000)",
};
const EXPR_SEM_OFFSET: Record<string, string> = {
  NDVI: "(B08-B04)/(B08+B04)",
  GNDVI: "(B08-B03)/(B08+B03)",
  NDRE: "(B08-B05)/(B08+B05)",
  EVI: "2.5*((B08-B04)/(B08+6*B04-7.5*B02+10000))",
  NDMI: "(B08-B11)/(B08+B11)",
  SAVI: "1.5*((B08-B04)/(B08+B04+5000))",
  PSRI: "(B04-B02)/B06",
};
const ASSETS: Record<string, string[]> = {
  NDVI: ["B08", "B04"],
  GNDVI: ["B08", "B03"],
  NDRE: ["B08", "B05"],
  EVI: ["B08", "B04", "B02"],
  NDMI: ["B08", "B11"],
  SAVI: ["B08", "B04"],
  PSRI: ["B04", "B02", "B06"],
};
const FAIXAS: Record<string, { min: number; max: number }> = {
  NDVI: { min: 0.0, max: 0.85 },
  NDRE: { min: 0.0, max: 0.55 },
  GNDVI: { min: 0.0, max: 0.85 },
  EVI: { min: 0.0, max: 0.85 },
  NDMI: { min: -0.3, max: 0.5 },
  SAVI: { min: 0.0, max: 0.6 },
  PSRI: { min: 0.0, max: 0.45 },
};
/** Valor ALTO é ruim (senescência): a paleta inverte. */
const INVERTIDOS = new Set(["PSRI"]);
/** Solo exposto → vigor máximo. */
const PALETA: [number, number, number][] = [
  [0x64, 0x00, 0x00], [0xd7, 0x30, 0x27], [0xf4, 0x6d, 0x43], [0xfd, 0xae, 0x61],
  [0xfe, 0xe0, 0x8b], [0xd9, 0xef, 0x8b], [0xa6, 0xd9, 0x6a], [0x66, 0xbd, 0x63],
  [0x1a, 0x98, 0x50], [0x00, 0x4c, 0x00],
];

export type Anel = [number, number][]; // [lng, lat]
export interface Caixa {
  oeste: number;
  sul: number;
  leste: number;
  norte: number;
}
export interface FaixaDaLegenda {
  de: number;
  ate: number | null;
  cor: string;
}

const hex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;

function cabecalhos(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const chave = Deno.env.get("PLANETARY_COMPUTER_KEY");
  if (chave) h["Ocp-Apim-Subscription-Key"] = chave;
  return h;
}

export function caixaDe(anel: Anel, margem = 0): Caixa {
  const lngs = anel.map((p) => p[0]);
  const lats = anel.map((p) => p[1]);
  return {
    oeste: Math.min(...lngs) - margem,
    sul: Math.min(...lats) - margem,
    leste: Math.max(...lngs) + margem,
    norte: Math.max(...lats) + margem,
  };
}

const feicao = (anel: Anel) => {
  const r = [...anel];
  const [a, b] = [r[0], r[r.length - 1]];
  if (a[0] !== b[0] || a[1] !== b[1]) r.push(a);
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [r] } };
};
const retangulo = (c: Caixa) =>
  feicao([
    [c.oeste, c.sul],
    [c.leste, c.sul],
    [c.leste, c.norte],
    [c.oeste, c.norte],
  ]);

/** Paleta discreta no formato "intervals" do Titiler. Última faixa ABERTA
 *  (a lavoura mais vigorosa não pode virar transparente); piso fechado (o
 *  pixel de nuvem é min−1 e precisa sair transparente). */
function colormap(indice: string): { json: string; legenda: FaixaDaLegenda[] } {
  const f = FAIXAS[indice];
  const paleta = INVERTIDOS.has(indice) ? [...PALETA].reverse() : PALETA;
  const passo = (f.max - f.min) / paleta.length;
  const legenda: FaixaDaLegenda[] = [];
  const intervalos = paleta.map((rgb, i) => {
    const de = f.min + i * passo;
    const ate = i === paleta.length - 1 ? 1e6 : f.min + (i + 1) * passo;
    legenda.push({
      de: Math.round(de * 100) / 100,
      ate: i === paleta.length - 1 ? null : Math.round(ate * 100) / 100,
      cor: hex(rgb),
    });
    return [[de, ate], [...rgb, 255]];
  });
  return { json: JSON.stringify(intervalos), legenda };
}

// ---- Cache em memória (por isolate; some no cold start — como no Flag Field) --
const cache = new Map<string, { expira: number; valor: unknown }>();
export async function comCache<T>(chave: string, ttlMs: number, fazer: () => Promise<T>): Promise<T> {
  const hit = cache.get(chave);
  if (hit && hit.expira > Date.now()) return hit.valor as T;
  const valor = await fazer();
  cache.set(chave, { expira: Date.now() + ttlMs, valor });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return valor;
}
export const noCache = (chave: string) => {
  const hit = cache.get(chave);
  return !!hit && hit.expira > Date.now();
};

// ---- Busca de cenas e clareza do talhão ------------------------------------------
export interface DataDisponivel {
  date: string;
  scene_id: string;
  /** Fração do TALHÃO sem nuvem/sombra (0..1). */
  clareza: number;
  /** Nuvem da CENA inteira (informativo). */
  nuvens: number | null;
}

/** Datas dos últimos 180 dias até `ate`, 1 cena por dia, com a clareza medida
 *  NO POLÍGONO (a nuvem da cena de 110 km diz pouco sobre um talhão). */
export async function datasDisponiveis(anel: Anel, ate?: string): Promise<DataDisponivel[]> {
  const fim = ate ? new Date(ate) : new Date(Date.now() - 2 * 864e5);
  const ini = new Date(fim.getTime() - 180 * 864e5);
  const c = caixaDe(anel);
  const res = await fetch(`${STAC}/search`, {
    method: "POST",
    headers: cabecalhos(),
    body: JSON.stringify({
      collections: [COLLECTION],
      bbox: [c.oeste, c.sul, c.leste, c.norte],
      datetime: `${ini.toISOString().slice(0, 10)}T00:00:00Z/${fim.toISOString().slice(0, 10)}T23:59:59Z`,
      query: { "eo:cloud_cover": { lt: 95 } },
      limit: 100,
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    }),
  });
  if (!res.ok) throw new Error(`STAC ${res.status}`);
  // deno-lint-ignore no-explicit-any
  const feats: any[] = (await res.json()).features ?? [];

  // deno-lint-ignore no-explicit-any
  const porDia = new Map<string, any>();
  for (const f of feats) {
    const d = f.properties?.datetime?.slice(0, 10);
    if (!d) continue;
    const atual = porDia.get(d);
    if (!atual || (f.properties["eo:cloud_cover"] ?? 100) < (atual.properties["eo:cloud_cover"] ?? 100)) {
      porDia.set(d, f);
    }
  }
  const cenas = [...porDia.values()]
    .sort((a, b) => b.properties.datetime.localeCompare(a.properties.datetime))
    .slice(0, 24);

  const geo = feicao(anel);
  const medidas = await Promise.all(
    cenas.map(async (cena): Promise<DataDisponivel | null> => {
      const p = new URLSearchParams({ collection: COLLECTION, item: cena.id, asset_as_band: "true", expression: CLEAR });
      p.append("assets", "SCL");
      try {
        const r = await fetch(`${DATA_API}/item/statistics?${p}`, {
          method: "POST",
          headers: cabecalhos(),
          body: JSON.stringify(geo),
        });
        if (!r.ok) return null;
        const j = await r.json();
        const stats = j?.properties?.statistics ?? j?.statistics ?? {};
        // deno-lint-ignore no-explicit-any
        const primeiro = Object.values(stats)[0] as any;
        return {
          date: cena.properties.datetime.slice(0, 10),
          scene_id: cena.id,
          clareza: Math.round((primeiro?.mean ?? 0) * 1000) / 1000,
          nuvens: cena.properties["eo:cloud_cover"] ?? null,
        };
      } catch {
        return null; // uma cena que falha não derruba a lista
      }
    }),
  );
  return medidas
    .filter((m): m is DataDisponivel => !!m && m.clareza >= 0.3)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Lê o item para saber a data e se a cena tem o offset (baseline >= 04.00). */
async function itemDaCena(sceneId: string): Promise<{ data: string; comOffset: boolean }> {
  return await comCache(`item:${sceneId}`, 7 * 864e5, async () => {
    const r = await fetch(`${STAC}/collections/${COLLECTION}/items/${encodeURIComponent(sceneId)}`, {
      headers: cabecalhos(),
    });
    if (!r.ok) throw new Error(`cena_nao_encontrada (${r.status})`);
    const j = await r.json();
    const baseline = parseFloat(String(j?.properties?.["s2:processing_baseline"] ?? "0"));
    const data = String(j?.properties?.datetime ?? "").slice(0, 10);
    // Sem o campo, decide pela data do início do baseline 04.00.
    const comOffset = Number.isFinite(baseline) && baseline > 0 ? baseline >= 4 : data >= "2022-01-25";
    return { data, comOffset };
  });
}

/** W×H na proporção do retângulo (corrigida pela latitude), lado maior = 1024. */
function tamanho(c: Caixa): { w: number; h: number } {
  const k = Math.cos((((c.sul + c.norte) / 2) * Math.PI) / 180);
  const largura = (c.leste - c.oeste) * k;
  const altura = c.norte - c.sul;
  const maior = Math.max(largura, altura);
  return {
    w: Math.max(64, Math.round((largura / maior) * 1024)),
    h: Math.max(64, Math.round((altura / maior) * 1024)),
  };
}

async function pngComoDataUrl(url: string, corpo: unknown): Promise<string> {
  const r = await fetch(url, { method: "POST", headers: cabecalhos(), body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`titiler ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:image/png;base64,${btoa(bin)}`;
}

export interface ImagemDoIndice {
  imagem: string;
  /** Leaflet: [[sul, oeste], [norte, leste]] — o retângulo exato da imagem. */
  bounds: [[number, number], [number, number]];
  legenda: FaixaDaLegenda[];
  data: string;
}

export async function imagemDoIndice(anel: Anel, sceneId: string, indice: Indice): Promise<ImagemDoIndice> {
  const item = await itemDaCena(sceneId);
  const c = caixaDe(anel, 0.003);
  const { w, h } = tamanho(c);
  const p = new URLSearchParams({ collection: COLLECTION, item: sceneId, asset_as_band: "true" });
  let legenda: FaixaDaLegenda[] = [];

  if (indice === "RGB") {
    // Cor real. O esticamento começa em 1000 com o offset (senão sai lavada).
    p.set("rescale", item.comOffset ? "1000,4000" : "0,3000");
    for (const a of ["B04", "B03", "B02"]) p.append("assets", a);
  } else {
    const f = FAIXAS[indice];
    const e = (item.comOffset ? EXPR_COM_OFFSET : EXPR_SEM_OFFSET)[indice];
    const cm = colormap(indice);
    legenda = cm.legenda;
    // Nuvem vira sentinela abaixo do piso → transparente no colormap.
    p.set("expression", `where(${CLEAR},${e},${f.min - 1})`);
    p.set("colormap", cm.json);
    for (const a of [...ASSETS[indice], "SCL"]) p.append("assets", a);
  }

  const imagem = await pngComoDataUrl(`${DATA_API}/item/crop/${w}x${h}.png?${p}`, retangulo(c));
  return {
    imagem,
    bounds: [
      [c.sul, c.oeste],
      [c.norte, c.leste],
    ],
    legenda,
    data: item.data,
  };
}

export interface Estatisticas {
  media: number;
  mediana: number;
  min: number;
  max: number;
  /** Fração do talhão com pixel limpo nesta cena. */
  clareza: number;
}

/** Estatística no polígono EXATO, só pixels limpos (4 expressões numa chamada;
 *  o Titiler não aceita NaN nem `nodata` com expressão — ver Flag Field). */
export async function estatisticasDoIndice(anel: Anel, sceneId: string, indice: Exclude<Indice, "RGB">): Promise<Estatisticas> {
  const item = await itemDaCena(sceneId);
  const E = (item.comOffset ? EXPR_COM_OFFSET : EXPR_SEM_OFFSET)[indice];
  const geo = feicao(anel);
  const rodar = async (expression: string, percentis: number[] = []) => {
    const p = new URLSearchParams({ collection: COLLECTION, item: sceneId, asset_as_band: "true", expression });
    for (const a of [...ASSETS[indice], "SCL"]) p.append("assets", a);
    for (const x of percentis) p.append("p", String(x));
    const r = await fetch(`${DATA_API}/item/statistics?${p}`, {
      method: "POST",
      headers: cabecalhos(),
      body: JSON.stringify(geo),
    });
    if (!r.ok) throw new Error(`estatistica ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    // deno-lint-ignore no-explicit-any
    return Object.values(j?.properties?.statistics ?? j?.statistics ?? {}) as any[];
  };

  const [soma, mascara, comNuvemAlta, comNuvemBaixa] = await rodar(
    `${E}*${CLEAR};${CLEAR};where(${CLEAR},${E},999);where(${CLEAR},${E},-999)`,
  );
  const clareza = mascara?.mean ?? 0;
  if (!(clareza > 0)) throw new Error("talhao_sem_pixel_limpo");
  const media = (soma?.mean ?? 0) / clareza;

  let mediana = media;
  if (clareza > 0.02) {
    const pc = Math.max(1, Math.min(99, Math.round(50 * clareza)));
    const [comPct] = await rodar(`where(${CLEAR},${E},999)`, [pc]);
    const v = comPct?.[`percentile_${pc}`];
    if (typeof v === "number" && v < 900) mediana = v;
  }
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    media: r3(media),
    mediana: r3(mediana),
    min: r3(comNuvemAlta?.min ?? 0),
    max: r3(comNuvemBaixa?.max ?? 0),
    clareza: r3(clareza),
  };
}
