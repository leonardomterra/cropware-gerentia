import { api, ApiError } from "@/utils/api";

/**
 * Cliente das rotas de NDVI do servidor (handlers/ndvi.ts). Fase 5.
 * Erros viram uma frase pronta para a tela.
 */
export type IndiceDeVegetacao =
  | "RGB"
  | "NDVI"
  | "NDRE"
  | "NDMI"
  | "SAVI"
  | "GNDVI"
  | "EVI"
  | "PSRI";

export const INDICES_DE_VEGETACAO: {
  valor: IndiceDeVegetacao;
  rotulo: string;
  dica: string;
}[] = [
  {
    valor: "NDVI",
    rotulo: "NDVI",
    dica: "Vigor geral da lavoura. O índice de referência.",
  },
  {
    valor: "RGB",
    rotulo: "Cor real",
    dica: "A foto do satélite, como o olho vê.",
  },
  {
    valor: "NDRE",
    rotulo: "NDRE",
    dica: "Vigor em lavoura fechada, onde o NDVI satura.",
  },
  {
    valor: "NDMI",
    rotulo: "NDMI",
    dica: "Água na planta: estresse hídrico antes do NDVI cair.",
  },
  {
    valor: "SAVI",
    rotulo: "SAVI",
    dica: "Ajustado ao solo: melhor no início do ciclo.",
  },
  {
    valor: "GNDVI",
    rotulo: "GNDVI",
    dica: "Sensível à clorofila e ao nitrogênio.",
  },
  {
    valor: "EVI",
    rotulo: "EVI",
    dica: "Vigor com correção de atmosfera e solo.",
  },
  {
    valor: "PSRI",
    rotulo: "PSRI",
    dica: "Senescência: sobe conforme a lavoura seca (para a colheita).",
  },
];

export interface DataDeImagem {
  date: string;
  scene_id: string;
  clareza: number;
  nuvens: number | null;
}
export interface ImagemDeIndice {
  imagem: string;
  bounds: [[number, number], [number, number]];
  legenda: { de: number; ate: number | null; cor: string }[];
  data: string;
}
export interface EstatisticasDeIndice {
  media: number;
  mediana: number;
  min: number;
  max: number;
  clareza: number;
}

export function mensagemDoErroDeNdvi(e: unknown): string {
  if (e instanceof ApiError) {
    let corpo: {
      error?: string;
      detalhe?: string;
      usado?: number;
      teto?: number;
    } = {};
    try {
      corpo = JSON.parse(e.body);
    } catch {
      /* corpo não-JSON */
    }
    if (corpo.error === "teto_atingido")
      return `Você usou as ${corpo.teto} imagens de satélite do mês. O limite renova no dia 1.`;
    if (corpo.error === "talhao_sem_contorno")
      return corpo.detalhe ?? "Desenhe o contorno do talhão.";
    if (corpo.error === "modulo_field")
      return "O NDVI faz parte do módulo Field.";
    if (e.status >= 500)
      return "O serviço de satélite não respondeu. Tente de novo em instantes.";
  }
  return "Não foi possível carregar a imagem de satélite.";
}

/**
 * Imagens já pedidas nesta sessão. Cada imagem gasta 1 do teto mensal, e o
 * React em desenvolvimento (StrictMode) roda o efeito duas vezes — sem isto,
 * a mesma imagem seria pedida (e cobrada) em dobro, e de novo a cada volta.
 * Guarda a PROMESSA: a segunda chamada simultânea pega a mesma.
 */
const imagensDaSessao = new Map<string, Promise<ImagemDeIndice>>();

export const ndvi = {
  datas: (plotId: string) =>
    api<{ datas: DataDeImagem[] }>("/campo/ndvi/datas", {
      method: "POST",
      body: { plot_id: plotId },
    }),
  imagem: (plotId: string, sceneId: string, indice: IndiceDeVegetacao) => {
    const chave = `${plotId}:${sceneId}:${indice}`;
    const ja = imagensDaSessao.get(chave);
    if (ja) return ja;
    const p = api<ImagemDeIndice>("/campo/ndvi/imagem", {
      method: "POST",
      body: { plot_id: plotId, scene_id: sceneId, indice },
    });
    imagensDaSessao.set(chave, p);
    p.catch(() => imagensDaSessao.delete(chave)); // erro não fica guardado
    return p;
  },
  estatisticas: (plotId: string, sceneId: string, indice: IndiceDeVegetacao) =>
    api<EstatisticasDeIndice>("/campo/ndvi/estatisticas", {
      method: "POST",
      body: { plot_id: plotId, scene_id: sceneId, indice },
    }),
  uso: () =>
    api<{ usado: number; teto: number }>("/campo/ndvi/uso", { method: "GET" }),
};
