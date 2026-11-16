import type { GeometriaDoTalhao } from "./geo/geometria";
import type {
  DetalhesDaAtividade,
  ProdutoDaAtividade,
  TipoDeAtividade,
} from "./dominio/atividades";
import type { CicloDeVida, Finalidade } from "./dominio/plantios";
import type { CategoriaDeProduto, TipoDeCiclo } from "./dominio/catalogo";

/**
 * Cadastros do módulo Field — tabelas da migration
 * 20261118120000_field_cadastros.sql. Visibilidade "igual ao financeiro": o
 * Usuário (member) só recebe o que ele mesmo criou; quem filtra é a RLS.
 */
export interface Produtor {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  partner: string | null;
  notes: string | null;
  created_at: string;
}

export interface Fazenda {
  id: string;
  organization_id: string;
  created_by: string | null;
  producer_id: string | null;
  name: string;
  area_ha: number | null;
  city: string | null;
  state: string | null;
  state_registration: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  created_at: string;
}

export type Irrigacao = "sequeiro" | "irrigado";

export interface Talhao {
  id: string;
  organization_id: string;
  farm_id: string;
  created_by: string | null;
  name: string;
  area_ha: number;
  irrigation: Irrigacao;
  geometry: GeometriaDoTalhao | null;
  notes: string | null;
  created_at: string;
}

export type ProdutorInput = Pick<
  Produtor,
  "name" | "document" | "email" | "phone" | "partner" | "notes"
>;
export type FazendaInput = Pick<
  Fazenda,
  | "producer_id"
  | "name"
  | "area_ha"
  | "city"
  | "state"
  | "state_registration"
  | "latitude"
  | "longitude"
  | "notes"
>;
export type TalhaoInput = Pick<
  Talhao,
  "farm_id" | "name" | "area_ha" | "irrigation" | "geometry" | "notes"
>;

// ---- Fase 2: safra --------------------------------------------------------

export interface Safra {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  starts_on: string;
  ends_on: string;
  notes: string | null;
  created_at: string;
}

export interface Produto {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  category: CategoriaDeProduto;
  manufacturer: string | null;
  supplier: string | null;
  active_ingredient: string | null;
  crop: string | null;
  genetics: string | null;
  maturation_group: number | null;
  cycle_days: number | null;
  cycle_type: TipoDeCiclo | null;
  notes: string | null;
  created_at: string;
}

export interface Plantio {
  id: string;
  organization_id: string;
  created_by: string | null;
  plot_id: string;
  season_id: string | null;
  crop: string;
  variety: string | null;
  purpose: Finalidade;
  planting_date: string | null;
  expected_harvest_date: string | null;
  lifecycle: CicloDeVida;
  completed_at: string | null;
  population: number | null;
  population_unit: "plantas_ha" | "kg_ha" | null;
  area_type: "total" | "partial";
  partial_area_ha: number | null;
  seed_category_planted: string | null;
  seed_category_harvested: string | null;
  seed_homologation: string | null;
  notes: string | null;
  created_at: string;
}

export interface Atividade {
  id: string;
  organization_id: string;
  created_by: string | null;
  farm_id: string;
  plot_id: string | null;
  planting_id: string | null;
  type: TipoDeAtividade;
  date: string;
  status: "planejada" | "realizada";
  responsible: string | null;
  description: string | null;
  area_type: "total" | "partial";
  treated_area_ha: number | null;
  products: ProdutoDaAtividade[];
  cost_total: number | null;
  details: DetalhesDaAtividade;
  notes: string | null;
  created_at: string;
}

type SemMeta<T> = Omit<
  T,
  "id" | "organization_id" | "created_by" | "created_at"
>;
export type SafraInput = SemMeta<Safra>;
export type ProdutoInput = SemMeta<Produto>;
export type PlantioInput = SemMeta<Plantio>;
export type AtividadeInput = SemMeta<Atividade>;
