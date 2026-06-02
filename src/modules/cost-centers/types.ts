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

// Paleta CLARA/leve (Tailwind 400) - usada como tint do ICONE (visual arejado).
// O TEXTO usa uma versao mais escura desta cor (ver ccTextColor em ccIcons) pq
// cor clara como texto sobre branco some. 2026-06-01.
export const CC_COLORS = [
  "#a1a1aa", // zinc (cinza)
  "#fbbf24", // amber
  "#34d399", // emerald
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
  "#f87171", // red
  "#2dd4bf", // teal
];

export const MAX_COST_CENTERS = 6;
