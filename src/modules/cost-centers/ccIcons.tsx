import type { ComponentType, SVGProps } from "react";
import { COR, COR_OUTROS } from "@/lib/paleta";
import { CC_COLORS, corDoCentro } from "./types";
// Filled (material-symbols regular) - mais encorpado que o -light/outline e
// consistente; bom com fundo pintado. Ver Q1/Q2 (2026-06-01).
import IconHome from "~icons/ph/house-fill";
import IconPerson from "~icons/ph/user-fill";
import IconAgriculture from "~icons/ph/tractor-fill";
import IconEco from "~icons/ph/leaf-fill";
import IconStore from "~icons/ph/storefront-fill";
import IconCar from "~icons/ph/car-fill";
import IconSavings from "~icons/ph/piggy-bank-fill";
import IconWork from "~icons/ph/briefcase-fill";
import IconBuild from "~icons/ph/wrench-fill";
import IconReceipt from "~icons/ph/receipt-fill";
import IconSchool from "~icons/ph/graduation-cap-fill";
import IconMedical from "~icons/ph/first-aid-kit-fill";
import IconRestaurant from "~icons/ph/fork-knife-fill";
import IconCart from "~icons/ph/shopping-cart-fill";
import IconFlight from "~icons/ph/airplane-tilt-fill";
import IconApartment from "~icons/ph/building-apartment-fill";
import IconPets from "~icons/ph/paw-print-fill";
import IconBolt from "~icons/ph/lightning-fill";
import IconCategory from "~icons/ph/tag-fill";
import IconApps from "~icons/ph/squares-four-fill";
import { cn } from "@/components/ui/utils";

export type CCIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface CCIconDef {
  /** Guardado no DB (farm_cost_centers.icon). Curto e estavel - desacoplado
   *  do nome material-symbols, da pra trocar o glifo sem migration. */
  slug: string;
  label: string;
  Icon: CCIconComponent;
}

/**
 * Set CURADO de icones pra Centros de Custo (material-symbols-light, offline
 * via unplugin-icons). O unplugin exige import estatico, entao a lista e' fixa
 * - editar AQUI pra mudar as opcoes do seletor. O DB guarda so o `slug`.
 */
export const CC_ICONS: CCIconDef[] = [
  { slug: "home", label: "Casa", Icon: IconHome },
  { slug: "person", label: "Pessoal", Icon: IconPerson },
  { slug: "agriculture", label: "Fazenda", Icon: IconAgriculture },
  { slug: "eco", label: "Plantio", Icon: IconEco },
  { slug: "store", label: "Negócio", Icon: IconStore },
  { slug: "car", label: "Veículo", Icon: IconCar },
  { slug: "savings", label: "Cofre", Icon: IconSavings },
  { slug: "work", label: "Trabalho", Icon: IconWork },
  { slug: "build", label: "Manutenção", Icon: IconBuild },
  { slug: "receipt", label: "Contas", Icon: IconReceipt },
  { slug: "school", label: "Educação", Icon: IconSchool },
  { slug: "medical", label: "Saúde", Icon: IconMedical },
  { slug: "restaurant", label: "Alimentação", Icon: IconRestaurant },
  { slug: "cart", label: "Compras", Icon: IconCart },
  { slug: "flight", label: "Viagem", Icon: IconFlight },
  { slug: "apartment", label: "Imóvel", Icon: IconApartment },
  { slug: "pets", label: "Animais", Icon: IconPets },
  { slug: "bolt", label: "Energia", Icon: IconBolt },
];

export const CC_ICON_MAP: Record<string, CCIconComponent> = Object.fromEntries(
  CC_ICONS.map((i) => [i.slug, i.Icon]),
);

/** Fallback pra CC sem icone escolhido (ou slug desconhecido). */
const FallbackIcon: CCIconComponent = IconCategory;

/**
 * Renderiza o icone de um Centro de Custo, tingido com a cor do CC.
 * Substitui a antiga "bolinha". CC sem icone cai no fallback (category).
 */
export function CostCenterIcon({
  icon,
  color,
  className,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  className?: string;
}) {
  const Icon = (icon && CC_ICON_MAP[icon]) || FallbackIcon;
  return (
    <Icon
      className={className}
      style={{ color: corDoCentro(color) ?? COR_OUTROS }}
    />
  );
}

/**
 * CC como "chip" tonal: quadradinho arredondado com FUNDO na cor do CC (clara,
 * Tailwind 400) e o ICONE na versao escura da mesma cor (ccTextColor, 700/800) -
 * mesmo look do seletor. Tamanho do box via className (default size-6); o icone
 * ocupa ~62% do box.
 */
export function CostCenterChip({
  icon,
  color,
  className,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  className?: string;
}) {
  const Icon = (icon && CC_ICON_MAP[icon]) || FallbackIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md shrink-0 size-6",
        className,
      )}
      style={{ backgroundColor: corDoCentro(color) ?? COR_OUTROS }}
    >
      <Icon className="size-[62%]" style={{ color: ccTextColor(color) }} />
    </span>
  );
}

/**
 * Chip pra "Todos os Centros" (todos). Tom claro/neutro (fundo slate-100, icone
 * slate-400) pra se distinguir dos CCs coloridos sem competir com eles.
 */
export function AllCentersChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md shrink-0 size-6 bg-slate-100",
        className,
      )}
    >
      <IconApps className="size-[62%] text-slate-400" />
    </span>
  );
}

/** Escurece um hex multiplicando os canais (0..1). */
function darken(hex: string, factor: number): string {
  const m = (hex || "").replace("#", "");
  if (m.length !== 6) return hex || "#52525b";
  const ch = (i: number) =>
    Math.round(parseInt(m.slice(i, i + 2), 16) * factor);
  const h = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(ch(0))}${h(ch(2))}${h(ch(4))}`;
}

/** Clareia um hex aproximando os canais do branco (0..1). Espelho de darken. */
function lighten(hex: string, factor: number): string {
  const m = (hex || "").replace("#", "");
  if (m.length !== 6) return hex || "#d4d4d8";
  const ch = (i: number) => {
    const v = parseInt(m.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * factor);
  };
  const h = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(ch(0))}${h(ch(2))}${h(ch(4))}`;
}

/**
 * Cor do centro nas ÁREAS GRANDES (fatias do gráfico de gastos por centro).
 * Desde 17/11/2026 a paleta já é pastel (src/lib/paleta.ts), então a cor vai
 * como está — antes clareava-se o 400 para o 300. Cor custom, fora da paleta,
 * ainda é clareada em direção ao branco.
 */
export function ccChartColor(color: string | null | undefined): string {
  const c = corDoCentro(color);
  if (!c) return COR_OUTROS;
  return CC_COLORS.includes(c.toLowerCase()) ? c : lighten(c, 0.4);
}

/** Cada cor da paleta → a versão ESCURA dela (OKLCH: mesmo matiz, claridade
 *  0,40, saturação 0,09). Texto sobre branco ≥ 8,5:1; ícone sobre o chip
 *  ≥ 3,4:1. Calculado em 17/11/2026 junto com a paleta pastel. */
const CC_DARK: Record<string, string> = {
  [COR_OUTROS]: "#4c4c52", // grafite 700
  [COR.lime]: "#365117",
  [COR.blue]: "#294778",
  [COR.pink]: "#6c314b",
  [COR.sky]: "#004e72",
  [COR.orange]: "#6e3617",
  [COR.violet]: "#4a3d73",
  [COR.amber]: "#663d00",
  [COR.teal]: "#00574c",
};

/**
 * Versão ESCURA da cor do centro. Usada como (a) TEXTO do nome do centro e
 * (b) ícone sobre o chip — a cor pastel some como texto, a escura do mesmo
 * matiz dá o look tonal e fica legível. Cor custom cai num darken.
 */
export function ccTextColor(color: string | null | undefined): string {
  const c = corDoCentro(color);
  if (!c) return "#4c4c52";
  return CC_DARK[c.toLowerCase()] || darken(c, 0.55);
}
