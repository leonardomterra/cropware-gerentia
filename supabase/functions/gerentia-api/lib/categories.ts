// Categorias visíveis pro usuário (presets não-ocultos + custom/legado da org),
// pra o agente do WhatsApp mapear/validar contra as categorias REAIS — inclusive
// as personalizadas — em vez de uma lista hardcoded no prompt.
//
// service_role ignora RLS, então replicamos no app o que a policy de
// farm_categories faria: is_preset OR organization_id = orgId, menos o que a org
// desativou — por categoria (farm_category_hidden) ou pelo grupo inteiro
// (farm_category_groups.hidden). Precisa acompanhar `visibleCategories` do
// front (src/modules/receipts/categoryGroups.ts): se as duas listas divergirem,
// o agente do WhatsApp classifica em categoria que o usuário não enxerga.

export interface CategoryRow {
  slug: string;
  name: string;
  direction: "expense" | "income";
}

const SELECT_COLS =
  "id, slug, name, direction, is_preset, organization_id, group_name";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
export async function listVisibleCategories(
  admin: any,
  orgId: string,
  _userId: string,
): Promise<CategoryRow[]> {
  // orgId vem do DB (farm_whatsapp_links), mas validamos como defesa em
  // profundidade. Em vez de interpolar num .or() (superfície de injeção se um
  // dia a origem mudar), usamos dois .eq() parametrizados e juntamos no app.
  const validOrg = UUID_RE.test(orgId) ? orgId : null;
  if (!validOrg) console.warn("[categories] orgId não-UUID, usando só presets:", orgId);

  const [presetRes, orgRes, hiddenRes, groupsRes] = await Promise.all([
    admin.from("farm_categories").select(SELECT_COLS).eq("is_preset", true),
    validOrg
      ? admin.from("farm_categories").select(SELECT_COLS).eq("organization_id", validOrg)
      : Promise.resolve({ data: [] }),
    validOrg
      ? admin.from("farm_category_hidden").select("category_id").eq("organization_id", validOrg)
      : Promise.resolve({ data: [] }),
    validOrg
      ? admin
        .from("farm_category_groups")
        .select("group_key")
        .eq("organization_id", validOrg)
        .eq("hidden", true)
      : Promise.resolve({ data: [] }),
  ]);

  const hidden = new Set<string>(
    (hiddenRes.data ?? []).map((h: { category_id: string }) => h.category_id),
  );
  const hiddenGroups = new Set<string>(
    (groupsRes.data ?? []).map((g: { group_key: string }) => g.group_key),
  );

  // Org primeiro: assim o override custom da org vence o preset no dedup por slug.
  const rows = [...(orgRes.data ?? []), ...(presetRes.data ?? [])];
  const out: CategoryRow[] = [];
  const seen = new Set<string>();
  for (const c of rows) {
    if (c.is_preset && hidden.has(c.id)) continue; // preset desativado pra org
    if (c.group_name && hiddenGroups.has(c.group_name)) continue; // grupo desativado
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
 * Nunca devolve slug inválido nem slug que o usuário não enxerga.
 *
 * O destino de "não consegui classificar" segue esta ordem:
 *  1. outros_despesa / outros_receita — o preset padrão;
 *  2. a_classificar — CONVENÇÃO pra org que desativou os presets e montou o
 *     próprio plano de contas: se ela criar uma conta com esse slug, é nela
 *     que o não-classificado cai (e o contador sabe que aquilo é pra revisar);
 *  3. primeira categoria visível da direção — último recurso, destino
 *     arbitrário, só pra nunca gravar slug que o usuário não enxerga.
 */
export function snapCategory(
  input: string | undefined | null,
  cats: CategoryRow[],
  direction: "expense" | "income",
): string {
  const pool = cats.filter((c) => c.direction === direction);
  const preferred = direction === "income" ? "outros_receita" : "outros_despesa";
  const fallback =
    pool.find((c) => c.slug === preferred)?.slug ??
      pool.find((c) => c.slug === "a_classificar")?.slug ??
      pool[0]?.slug ??
      preferred;

  if (!input) return fallback;
  const n = String(input).trim().toLowerCase();
  if (!n) return fallback;
  const hit =
    pool.find((c) => c.slug.toLowerCase() === n) ||
    pool.find((c) => c.name.toLowerCase() === n);
  return hit ? hit.slug : fallback;
}
