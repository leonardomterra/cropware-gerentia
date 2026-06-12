/**
 * Helpers de acesso a Centros de Custo.
 *
 * Usado tanto pelos handlers (com user client + RLS) quanto pelo bot
 * (service_role bypass RLS — enforcement OBRIGATORIO em app code aqui).
 *
 * Regra de ouro: owner/admin enxergam "all"; member enxerga so o subset
 * em farm_user_cost_centers.
 */

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export interface CostCenterRow {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
}

/**
 * Retorna "all" se owner/admin; senao array de IDs permitidos.
 */
export async function getAllowedCostCenterIds(
  admin: AdminClient,
  userId: string,
  organizationId: string,
): Promise<"all" | string[]> {
  const { data: meta } = await admin
    .from("users_meta")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (meta?.role === "owner" || meta?.role === "admin") return "all";
  const { data } = await admin
    .from("farm_user_cost_centers")
    .select("cost_center_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);
  // deno-lint-ignore no-explicit-any
  return (data || []).map((r: any) => r.cost_center_id as string);
}

/**
 * Lista de CostCenter rows visiveis pro user (admin -> todos da org; member -> subset).
 * Ordenado: default primeiro, depois por created_at.
 */
export async function listUserCostCenters(
  admin: AdminClient,
  userId: string,
  organizationId: string,
): Promise<CostCenterRow[]> {
  const allowed = await getAllowedCostCenterIds(admin, userId, organizationId);
  let q = admin
    .from("farm_cost_centers")
    .select("id, organization_id, slug, name, color, icon, is_default")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (allowed !== "all") {
    if (allowed.length === 0) return [];
    q = q.in("id", allowed);
  }
  const { data } = await q;
  return (data || []) as CostCenterRow[];
}

/**
 * CC default do user: o is_default da org se ele pode acessar, senao o primeiro permitido.
 */
export async function getUserDefaultCostCenter(
  admin: AdminClient,
  userId: string,
  organizationId: string,
): Promise<CostCenterRow | null> {
  const list = await listUserCostCenters(admin, userId, organizationId);
  if (list.length === 0) return null;
  return list.find((c) => c.is_default) || list[0];
}

/**
 * Validacao binaria (delegada pra funcao SQL pra reaproveitar logica do RLS).
 */
export async function userCanAccessCC(
  admin: AdminClient,
  userId: string,
  costCenterId: string,
): Promise<boolean> {
  const { data } = await admin.rpc("farm_user_can_access_cc", {
    p_user_id: userId,
    p_cc_id: costCenterId,
  });
  return !!data;
}

/**
 * Resolve CC a partir de slug, nome (case-insensitive) ou id. Util pro bot
 * traduzir "Fazenda" / "fazenda" / uuid pro id real.
 */
export async function resolveCCFromText(
  admin: AdminClient,
  organizationId: string,
  input: string,
): Promise<CostCenterRow | null> {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  // Match exato por id, slug ou name.
  const { data } = await admin
    .from("farm_cost_centers")
    .select("id, organization_id, slug, name, color, icon, is_default")
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (!data) return null;
  // deno-lint-ignore no-explicit-any
  const found = (data as any[]).find((c) =>
    c.id === input
    || c.slug.toLowerCase() === normalized
    || c.name.toLowerCase() === normalized
  );
  return (found as CostCenterRow) || null;
}
