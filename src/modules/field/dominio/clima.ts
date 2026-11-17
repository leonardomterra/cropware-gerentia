/**
 * Clima do campo — a JANELA DE APLICAÇÃO e os textos do tempo. Funções puras.
 *
 * Regras portadas do `get_spray_window` do Flag Field, com as correções de
 * 16/11/2026: lá a umidade horária nem era pedida (valia 0% e toda hora perdia
 * 20 pontos) e não havia regra de temperatura nem de calmaria. As regras estão
 * numa TABELA para o agrônomo ajustar sem mexer na lógica.
 */
export const REGRAS_DE_APLICACAO = {
  ventoRejeita: 15, // km/h — acima disso, deriva
  ventoAtencao: 10, // km/h — entre atenção e rejeita: −pontos
  ventoCalmaria: 3, // km/h — abaixo disso, risco de inversão térmica
  chuvaProb: 30, // % na hora ou nas 2 seguintes → rejeita
  chuvaMm: 0.5, // mm na hora ou nas 2 seguintes → rejeita
  umidadeBaixa: 55, // %
  umidadeAlta: 90, // %
  temperaturaAlta: 30, // °C
  pontos: {
    ventoAtencao: -25,
    calmaria: -15,
    umidadeBaixa: -20,
    umidadeAlta: -15,
    temperaturaAlta: -25,
    horaBoa: 15, // 6–10 e 16–19
    horaQuente: -30, // 11–15
  },
};

export interface HoraDoClima {
  /** "aaaa-mm-ddTHH:MM" no fuso local da fazenda (timezone=auto do Open-Meteo). */
  hora: string;
  temperatura: number;
  umidade: number;
  vento: number; // km/h
  chuvaProb: number; // %
  chuvaMm: number;
}

export interface JanelaDeAplicacao {
  hora: string;
  nota: number;
  motivos: string[];
}

/** Nota de 0 a 100 para cada hora; `null` = hora rejeitada. */
export function notaDaHora(
  h: HoraDoClima,
  proximas: HoraDoClima[],
): { nota: number; motivos: string[] } | null {
  const r = REGRAS_DE_APLICACAO;
  const motivos: string[] = [];
  if (h.vento > r.ventoRejeita) return null;
  const chove = [h, ...proximas.slice(0, 2)].some(
    (x) => x.chuvaProb > r.chuvaProb || x.chuvaMm > r.chuvaMm,
  );
  if (chove) return null;

  let nota = 100;
  if (h.vento > r.ventoAtencao) {
    nota += r.pontos.ventoAtencao;
    motivos.push(`vento ${Math.round(h.vento)} km/h`);
  } else if (h.vento < r.ventoCalmaria) {
    nota += r.pontos.calmaria;
    motivos.push(`calmaria (${Math.round(h.vento)} km/h, risco de inversão)`);
  }
  if (h.umidade < r.umidadeBaixa) {
    nota += r.pontos.umidadeBaixa;
    motivos.push(`umidade baixa (${Math.round(h.umidade)}%)`);
  } else if (h.umidade > r.umidadeAlta) {
    nota += r.pontos.umidadeAlta;
    motivos.push(`umidade alta (${Math.round(h.umidade)}%)`);
  }
  if (h.temperatura >= r.temperaturaAlta) {
    nota += r.pontos.temperaturaAlta;
    motivos.push(`calor (${Math.round(h.temperatura)} °C)`);
  }
  const hh = Number(h.hora.slice(11, 13));
  if ((hh >= 6 && hh <= 10) || (hh >= 16 && hh <= 19)) {
    nota += r.pontos.horaBoa;
  } else if (hh >= 11 && hh <= 15) {
    nota += r.pontos.horaQuente;
    motivos.push("horário quente");
  }
  return { nota: Math.max(0, Math.min(100, nota)), motivos };
}

/**
 * As melhores horas para aplicar, a partir de `agora` (mesmo fuso das horas):
 * até `quantas`, de preferência em dias diferentes. Hora já passada não entra
 * (no Flag Field o "já passou" estava deslocado em 3 h pelo fuso).
 */
export function janelaDeAplicacao(
  horas: HoraDoClima[],
  agora: string,
  quantas = 3,
): JanelaDeAplicacao[] {
  const notas: JanelaDeAplicacao[] = [];
  horas.forEach((h, i) => {
    if (h.hora < agora.slice(0, 13)) return;
    const n = notaDaHora(h, horas.slice(i + 1));
    if (n && n.nota >= 50) notas.push({ hora: h.hora, ...n });
  });
  notas.sort((a, b) => b.nota - a.nota || a.hora.localeCompare(b.hora));
  const escolhidas: JanelaDeAplicacao[] = [];
  const dias = new Set<string>();
  for (const n of notas) {
    if (escolhidas.length >= quantas) break;
    if (dias.has(n.hora.slice(0, 10))) continue;
    dias.add(n.hora.slice(0, 10));
    escolhidas.push(n);
  }
  // Se não deu em dias diferentes, completa com as melhores restantes.
  for (const n of notas) {
    if (escolhidas.length >= quantas) break;
    if (!escolhidas.includes(n)) escolhidas.push(n);
  }
  return escolhidas.sort((a, b) => a.hora.localeCompare(b.hora));
}

/** Código WMO do Open-Meteo → texto curto em pt-BR. */
export function rotuloDoTempo(codigo: number): string {
  if (codigo === 0) return "Céu limpo";
  if (codigo <= 2) return "Parcialmente nublado";
  if (codigo === 3) return "Nublado";
  if (codigo === 45 || codigo === 48) return "Neblina";
  if (codigo >= 51 && codigo <= 57) return "Garoa";
  if (codigo >= 61 && codigo <= 67) return "Chuva";
  if (codigo >= 71 && codigo <= 77) return "Neve";
  if (codigo >= 80 && codigo <= 82) return "Pancadas de chuva";
  if (codigo >= 95) return "Tempestade";
  return "—";
}
