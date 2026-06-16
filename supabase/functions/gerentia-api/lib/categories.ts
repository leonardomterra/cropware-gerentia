// Categorias visíveis pro usuário (presets não-ocultos + custom/legado da org),
// pra o agente do WhatsApp mapear/validar contra as categorias REAIS — inclusive
// as personalizadas — em vez de uma lista hardcoded no prompt.
//
// service_role ignora RLS, então replicamos no app o que a policy de
// farm_categories faria: is_preset OR organization_id = orgId, menos os presets
// ocultos pra org (farm_category_hidden).

export interface CategoryRow {
  slug: string;
  name: string;
  direction: "expense" | "income";
}

// deno-lint-ignore no-explicit-any
export async function listVisibleCategories(
  admin: any,
  orgId: string,
  _userId: string,
): Promise<CategoryRow[]> {
  const [catsRes, hiddenRes] = await Promise.all([
    admin
      .from("farm_categories")
      .select("id, slug, name, direction, is_preset, organization_id")
      .or(`is_preset.eq.true,organization_id.eq.${orgId}`),
    admin
      .from("farm_category_hidden")
      .select("category_id")
      .eq("organization_id", orgId),
  ]);

  const hidden = new Set<string>(
    (hiddenRes.data ?? []).map((h: { category_id: string }) => h.category_id),
  );

  const out: CategoryRow[] = [];
  const seen = new Set<string>();
  for (const c of catsRes.data ?? []) {
    if (c.is_preset && hidden.has(c.id)) continue; // preset desativado pra org
    if (seen.has(c.slug)) continue; // dedup por slug (org override > preset)
    seen.add(c.slug);
    out.push({
      slug: c.slug,
      name: c.name,
      direction: c.direction === "income" ? "income" : "expense",
    });
  }
  return out;
}

/**
 * Faz "snap" do que a IA mandou (slug ou nome) numa categoria válida da lista.
 * Nunca devolve slug inválido: cai em outros_despesa/outros_receita.
 */
export function snapCategory(
  input: string | undefined | null,
  cats: CategoryRow[],
  direction: "expense" | "income",
): string {
  const fallback = direction === "income" ? "outros_receita" : "outros_despesa";
  if (!input) return fallback;
  const n = String(input).trim().toLowerCase();
  if (!n) return fallback;
  const pool = cats.filter((c) => c.direction === direction);
  const hit =
    pool.find((c) => c.slug.toLowerCase() === n) ||
    pool.find((c) => c.name.toLowerCase() === n);
  return hit ? hit.slug : fallback;
}
