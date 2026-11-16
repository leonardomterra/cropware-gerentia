/**
 * Plantios — culturas, finalidades e ciclo de vida. Portado do Flag Field
 * (PlantingForm.tsx, utils/plantingStatus.ts, utils/periodoDoPlantio.ts).
 *
 * "Finalidade" é o antigo "Tipo de Campo": é o que mantém o uso de
 * desenvolvimento de mercado (campo demonstrativo, GD) dentro da gestão de
 * talhões.
 */
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

export const FINALIDADES: Record<Finalidade, { rotulo: string; cor: string }> =
  {
    grain_production: { rotulo: "Produção de grãos", cor: "#65a30d" },
    seed_field: { rotulo: "Campo de semente", cor: "#ca8a04" },
    demo_field: { rotulo: "Campo demonstrativo (GD)", cor: "#7c3aed" },
    gd_commercial: { rotulo: "GD comercial", cor: "#2563eb" },
    third_party: { rotulo: "Campo de terceiros", cor: "#64748b" },
    other: { rotulo: "Outro", cor: "#94a3b8" },
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
