import type { GeometriaDoTalhao } from "./geo/geometria";

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
