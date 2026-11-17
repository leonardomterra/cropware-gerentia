/**
 * Graus-dia (GDD) — soma de max(0, (Tmáx + Tmín)/2 − Tbase) desde o plantio.
 * Portado de lib/gdd-calculator.ts do Flag Field, com o casamento de cultura
 * EXATO (lá a busca por pedaço de texto fazia "feijão-caupi" cair em feijão).
 */
const TBASE: Record<string, number> = {
  soja: 10,
  milho: 10,
  feijao: 10,
  "feijao-caupi": 11,
  sorgo: 10,
  milheto: 10,
  algodao: 15,
  trigo: 5,
  arroz: 11,
  cana: 18,
  amendoim: 13,
  girassol: 6,
  aveia: 4,
  cevada: 4,
  canola: 5,
  mandioca: 13,
  cafe: 10,
};

const chave = (cultura: string) =>
  cultura.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Temperatura-base da cultura; padrão 10 °C. */
export function tbaseDa(cultura: string): number {
  return TBASE[chave(cultura)] ?? 10;
}

export interface DiaDeTemperatura {
  data: string;
  max: number | null;
  min: number | null;
}

/** Acumulado, arredondado a 0,1. Dias sem dado são pulados. */
export function gddAcumulado(dias: DiaDeTemperatura[], tbase: number): number {
  let soma = 0;
  for (const d of dias) {
    if (
      d.max == null ||
      d.min == null ||
      !Number.isFinite(d.max) ||
      !Number.isFinite(d.min)
    )
      continue;
    soma += Math.max(0, (d.max + d.min) / 2 - tbase);
  }
  return Math.round(soma * 10) / 10;
}

/**
 * Junta o histórico (archive) com o recente (forecast com past_days): o
 * archive atrasa ~5 dias; para cada data, vale o primeiro dado não nulo.
 */
export function juntarSeries(
  ...series: DiaDeTemperatura[][]
): DiaDeTemperatura[] {
  const porData = new Map<string, DiaDeTemperatura>();
  for (const s of series) {
    for (const d of s) {
      const atual = porData.get(d.data);
      if (!atual || atual.max == null || atual.min == null)
        porData.set(d.data, d);
    }
  }
  return [...porData.values()].sort((a, b) => a.data.localeCompare(b.data));
}
