import type { ComponentType, SVGProps } from "react";
// Filled (material-symbols regular) - mais encorpado que o -light/outline e
// consistente; bom com fundo pintado. Ver Q1/Q2 (2026-06-01).
import IconHome from "~icons/ph/house-fill";
import IconPerson from "~icons/ph/user-fill";
import IconAgriculture from "~icons/ph/tractor-fill";
import IconEco from "~icons/ph/plant-fill";
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
  return <Icon className={className} style={{ color: color || "#a1a1aa" }} />;
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
      style={{ backgroundColor: color || "#a1a1aa" }}
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
  const ch = (i: number) => Math.round(parseInt(m.slice(i, i + 2), 16) * factor);
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(ch(0))}${h(ch(2))}${h(ch(4))}`;
}

/** Cada cor da paleta (Tailwind 400, ver CC_COLORS) -> o 700 da MESMA cor. */
const CC_DARK: Record<string, string> = {
  "#a1a1aa": "#3f3f46", // zinc (cinza)
  "#fbbf24": "#b45309", // amber
  "#34d399": "#047857", // emerald
  "#60a5fa": "#1d4ed8", // blue
  "#a78bfa": "#5b21b6", // violet (800 - 700 ficava fraco no chip)
  "#f472b6": "#9d174d", // pink (800)
  "#f87171": "#991b1b", // red (800)
  "#2dd4bf": "#0f766e", // teal
};

/**
 * Versao ESCURA (Tailwind 700) da cor do CC. Usada como (a) TEXTO do nome do CC
 * e (b) icone SELECIONADO sobre o chip no seletor - a cor clara 400 some como
 * texto/sobre-cor, o 700 da mesma cor da o look tonal e fica legivel. Cor custom
 * fora da paleta cai num darken multiplicativo.
 */
export function ccTextColor(color: string | null | undefined): string {
  if (!color) return "#52525b";
  return CC_DARK[color.toLowerCase()] || darken(color, 0.55);
}
