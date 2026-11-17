import { CATEGORIAS, COR, COR_OUTROS } from "@/lib/paleta";

export interface CostCenter {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
}

export interface CostCenterInput {
  name: string;
  color?: string | null;
  icon?: string | null;
}

/**
 * Cores que a pessoa escolhe para o centro de custo: cinza ("Outros") + as 8
 * categorias PASTÉIS da paleta do app (src/lib/paleta.ts), desde 17/11/2026.
 * O fundo do chip usa a cor; o TEXTO e o ícone, a versão escura dela
 * (ccTextColor em ccIcons). Sem vermelho: vermelho é reservado para erro,
 * saída e excluir — um centro vermelho parecia alerta.
 */
export const CC_COLORS = [COR_OUTROS, ...CATEGORIAS.map((c) => c.claro)];

/**
 * A paleta ANTIGA (Tailwind 400, até 17/11/2026) → a nova. A cor fica gravada
 * no banco (cost_centers.color); em vez de migrar os dados, ela é traduzida
 * na hora de mostrar. Ao editar e salvar o centro, a cor nova é gravada.
 */
const CC_LEGADO: Record<string, string> = {
  "#a1a1aa": COR_OUTROS, // zinc
  "#fbbf24": COR.amber,
  "#34d399": COR.lime, // emerald: o verde da paleta nova é o lima
  "#60a5fa": COR.blue,
  "#a78bfa": COR.violet,
  "#fb923c": COR.orange,
  "#f87171": COR.pink, // red: saiu da paleta (reservado para erro)
  "#f472b6": COR.pink,
  "#2dd4bf": COR.teal,
};

/** A cor do centro como deve aparecer: a gravada, traduzida se for antiga. */
export function corDoCentro(color: string | null | undefined): string | null {
  if (!color) return null;
  return CC_LEGADO[color.toLowerCase()] ?? color;
}

export const MAX_COST_CENTERS = 6;
