import type { ComponentType } from "react";
import IconeFinancas from "~icons/ph/currency-circle-dollar-fill";
import IconeField from "~icons/ph/plant-fill";

/**
 * Módulos do gerentia — ver docs/UNIFICACAO-FIELD.md.
 *
 * O gerentia passou a ser um app com módulos: o **Finanças** (o gerentia de
 * sempre) e o **Field** (o Flag Field, que está sendo trazido para cá). Cada
 * módulo tem as suas telas e o seu direito de uso (trial ou assinatura), que o
 * servidor calcula em `farm_org_modules()` e devolve no /auth/me.
 *
 * Este arquivo é o registro: id, nome e ícone de cada módulo. As telas de cada
 * um são marcadas no menu (`NavItem.modulo` em AppShell).
 */
export type ModuloId = "financas" | "field";

export interface Modulo {
  id: ModuloId;
  nome: string;
  Icon: ComponentType<{ className?: string }>;
}

export const MODULOS: Modulo[] = [
  {
    id: "financas",
    // "Finance" e não "Finanças" (18/11/2026): os nomes dos módulos são de
    // produto, e ficam consistentes com o "Field".
    nome: "Finance",
    Icon: IconeFinancas,
  },
  { id: "field", nome: "Field", Icon: IconeField },
];

export const moduloPorId = (id: ModuloId) => MODULOS.find((m) => m.id === id)!;

/**
 * Chave de lançamento do Field. Com `false`, o módulo só aparecia para o
 * master — mesmo que a org tivesse direito a ele (o trial libera todos os
 * módulos).
 *
 * LIGADA em 17/11/2026, na branch da unificação, para o Leonardo ver o Field na
 * própria conta (direito por cortesia: organizations.modulos_cortesia). Só vai
 * ao ar no merge na main — e aí o Field aparece para toda org com direito,
 * inclusive as em trial. É o lançamento previsto na fase 9.
 */
export const FIELD_LIBERADO = true;

/**
 * Módulos com direito de uso. `null` (o servidor não conseguiu calcular, ou a
 * API ainda é a versão anterior) vira só o Finanças: é o que todo usuário tinha
 * antes dos módulos existirem — fail-open, como o PaywallGate.
 */
export function modulosComDireito(
  modules: string[] | null | undefined,
): ModuloId[] {
  if (!modules) return ["financas"];
  return MODULOS.map((m) => m.id).filter((id) => modules.includes(id));
}

/**
 * Módulos que aparecem no menu. O Finanças aparece sempre (o paywall cuida de
 * quem está sem direito, como sempre cuidou); o Field só com direito e, antes do
 * lançamento, só para o master.
 */
export function modulosVisiveis(
  modules: string[] | null | undefined,
  isMaster: boolean,
): ModuloId[] {
  const comDireito = modulosComDireito(modules);
  const visiveis: ModuloId[] = ["financas"];
  if (isMaster || (FIELD_LIBERADO && comDireito.includes("field"))) {
    visiveis.push("field");
  }
  return visiveis;
}
