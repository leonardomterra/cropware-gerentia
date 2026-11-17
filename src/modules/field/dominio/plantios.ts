/**
 * Plantios — culturas, finalidades e ciclo de vida. Portado do Flag Field
 * (PlantingForm.tsx, utils/plantingStatus.ts, utils/periodoDoPlantio.ts).
 *
 * "Finalidade" é o antigo "Tipo de Campo": é o que mantém o uso de
 * desenvolvimento de mercado (campo demonstrativo, GD) dentro da gestão de
 * talhões.
 */
import { COR, COR_OUTROS } from "@/lib/paleta";

export const CULTURAS = [
  "Soja",
  "Milho",
  "Trigo",
  "Feijão",
  "Algodão",
  "Arroz",
  "Sorgo",
  "Milheto",
  "Girassol",
  "Canola",
  "Aveia",
  "Amendoim",
  "Cana",
  "Café",
  "Plantas de cobertura",
  "Outro",
];

export type Finalidade =
  | "grain_production"
  | "seed_field"
  | "demo_field"
  | "gd_commercial"
  | "third_party"
  | "other";

/** Cores na ordem fixa da paleta do app (src/lib/paleta.ts, 17/11/2026). */
export const FINALIDADES: Record<Finalidade, { rotulo: string; cor: string }> =
  {
    grain_production: { rotulo: "Produção de grãos", cor: COR.lime },
    seed_field: { rotulo: "Campo de semente", cor: COR.blue },
    demo_field: { rotulo: "Campo demonstrativo (GD)", cor: COR.pink },
    gd_commercial: { rotulo: "GD comercial", cor: COR.sky },
    third_party: { rotulo: "Campo de terceiros", cor: COR.orange },
    other: { rotulo: "Outro", cor: COR_OUTROS },
  };

export type CicloDeVida = "planned" | "active" | "completed";
export const CICLOS: Record<CicloDeVida, string> = {
  planned: "Planejado",
  active: "Em andamento",
  completed: "Concluído",
};

export const CATEGORIAS_DE_SEMENTE = [
  "Genética",
  "Básica",
  "C1",
  "C2",
  "S1",
  "S2",
];

const dataCurta = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
};

/** "12/10/25 a 20/02/26", "Plantio em 12/10/25", "Sem datas". */
export function periodoDoPlantio(p: {
  planting_date: string | null;
  expected_harvest_date: string | null;
}): string {
  const { planting_date: ini, expected_harvest_date: fim } = p;
  if (ini && fim) return `${dataCurta(ini)} a ${dataCurta(fim)}`;
  if (ini) return `Plantio em ${dataCurta(ini)}`;
  if (fim) return `Colheita em ${dataCurta(fim)}`;
  return "Sem datas";
}

/** "Soja · M6410" — o nome curto do plantio. */
export function identidadeDoPlantio(p: {
  crop: string;
  variety: string | null;
}): string {
  return p.variety ? `${p.crop} · ${p.variety}` : p.crop;
}
