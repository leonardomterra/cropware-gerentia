import type {
  FarmCategory,
  FarmCategoryGroup,
  ReceiptDirection,
} from "./types";

/**
 * Resolucao de grupos de categoria.
 *
 * Um grupo pode vir de dois lugares:
 * - PRESET INTOCADO: nao tem linha em farm_category_groups. A chave (o
 *   group_name que veio do preset) e' tambem o rotulo. Ex: "Escritório".
 * - LINHA DA ORG: a org renomeou, ocultou, reordenou ou criou o grupo. A
 *   chave continua a mesma; o rotulo vem de `name`.
 *
 * Por isso NADA no app deve exibir `category.group_name` cru: passa por aqui
 * pra virar o rotulo que a org escolheu. `useCategories` ja faz isso, entao
 * quem consome ele nao precisa saber que existe grupo renomeado.
 */

/** Bucket de quem nao tem grupo definido. */
export const FALLBACK_GROUP = "Outras";
/** Grupo default das categorias criadas fora de uma secao. */
export const DEFAULT_CUSTOM_GROUP = "Minhas Categorias";
/** sort_order de grupo preset que a org nunca tocou. */
export const DEFAULT_SORT_ORDER = 100;
/** Baldes genericos vao pro fim da lista, depois de qualquer sort_order. */
const TRAILING_SORT_ORDER = 900;

export interface ResolvedGroup {
  /** chave estavel - e' o que farm_categories.group_name guarda. */
  key: string;
  /** rotulo exibido (rename da org ou a propria chave). */
  name: string;
  hidden: boolean;
  sortOrder: number;
  /** true = criado pela org, pode ser excluido. false = grupo preset. */
  isCustom: boolean;
  code: string | null;
  /** aba onde o grupo aparece enquanto esta VAZIO. Null = nas duas. */
  direction: ReceiptDirection | null;
  /** linha em farm_category_groups, ou null se o preset esta intocado. */
  row: FarmCategoryGroup | null;
}

function trailing(key: string): boolean {
  return key === DEFAULT_CUSTOM_GROUP || key === FALLBACK_GROUP;
}

function presetGroup(key: string): ResolvedGroup {
  return {
    key,
    name: key,
    hidden: false,
    sortOrder: trailing(key) ? TRAILING_SORT_ORDER : DEFAULT_SORT_ORDER,
    isCustom: false,
    code: null,
    direction: null,
    row: null,
  };
}

function fromRow(row: FarmCategoryGroup): ResolvedGroup {
  return {
    key: row.group_key,
    name: row.name,
    hidden: row.hidden,
    sortOrder: row.sort_order,
    isCustom: row.is_custom,
    code: row.code,
    direction: row.direction,
    row,
  };
}

/**
 * Indexa os grupos por chave: as linhas da org + os grupos preset que
 * aparecem em alguma categoria e ainda nao foram tocados. Um grupo da org
 * sem nenhuma categoria dentro tambem entra (secao vazia e' valida).
 */
export function resolveGroups(
  categories: Pick<FarmCategory, "group_name">[],
  groupRows: FarmCategoryGroup[],
): Map<string, ResolvedGroup> {
  const map = new Map<string, ResolvedGroup>();
  for (const row of groupRows) map.set(row.group_key, fromRow(row));
  for (const c of categories) {
    const key = c.group_name || FALLBACK_GROUP;
    if (!map.has(key)) map.set(key, presetGroup(key));
  }
  return map;
}

/** Grupo de uma categoria, criando o preset intocado se preciso. */
export function groupOf(
  category: Pick<FarmCategory, "group_name">,
  groups: Map<string, ResolvedGroup>,
): ResolvedGroup {
  const key = category.group_name || FALLBACK_GROUP;
  return groups.get(key) ?? presetGroup(key);
}

/** sort_order asc, depois rotulo (pt-BR). Baldes genericos por ultimo. */
export function compareGroups(a: ResolvedGroup, b: ResolvedGroup): number {
  return (
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")
  );
}

/**
 * O que o usuario pode escolher num lancamento: tira preset desativado pela
 * org, tira grupo desativado, e troca `group_name` pelo rotulo exibido.
 * Ordena por grupo (sort_order) e depois por nome da categoria.
 */
export function visibleCategories(
  categories: FarmCategory[],
  hiddenCategoryIds: Set<string>,
  groups: Map<string, ResolvedGroup>,
): FarmCategory[] {
  const out: { cat: FarmCategory; group: ResolvedGroup }[] = [];
  for (const c of categories) {
    if (c.is_preset && hiddenCategoryIds.has(c.id)) continue;
    const group = groupOf(c, groups);
    if (group.hidden) continue;
    out.push({ cat: { ...c, group_name: group.name }, group });
  }
  out.sort(
    (a, b) =>
      compareGroups(a.group, b.group) ||
      a.cat.name.localeCompare(b.cat.name, "pt-BR"),
  );
  return out.map((o) => o.cat);
}

/** Chave opaca de grupo criado pela org - nunca colide com nome de preset. */
export function newGroupKey(): string {
  return `grp_${crypto.randomUUID().slice(0, 8)}`;
}
