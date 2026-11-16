/** Catálogo de insumos — categorias do Flag Field (App.tsx / ProductFormDialog). */
export type CategoriaDeProduto =
  | "sementes"
  | "defensivos"
  | "fertilizantes"
  | "biologicos"
  | "nutricao"
  | "adjuvantes"
  | "inoculantes"
  | "fisiologia"
  | "especialidades"
  | "outros";

export const CATEGORIAS_DE_PRODUTO: Record<CategoriaDeProduto, string> = {
  sementes: "Sementes",
  defensivos: "Defensivos",
  fertilizantes: "Fertilizantes",
  biologicos: "Biológicos",
  nutricao: "Nutrição",
  adjuvantes: "Adjuvantes",
  inoculantes: "Inoculantes",
  fisiologia: "Fisiologia",
  especialidades: "Especialidades",
  outros: "Outros",
};

export type TipoDeCiclo = "super_precoce" | "precoce" | "medio" | "tardio";
export const TIPOS_DE_CICLO: Record<TipoDeCiclo, string> = {
  super_precoce: "Superprecoce",
  precoce: "Precoce",
  medio: "Médio",
  tardio: "Tardio",
};
