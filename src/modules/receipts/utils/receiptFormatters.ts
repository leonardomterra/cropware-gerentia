import type { FarmCategory } from "../types";

export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

export function formatDateBR(
  iso: string | null | undefined,
  fallback = "-",
): string {
  if (!iso) return fallback;
  // Aceita YYYY-MM-DD (sem timezone) ou full ISO.
  // YYYY-MM-DD parseado direto vira UTC midnight e podia virar dia anterior em pt-BR.
  // Truque: criar como local date.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = dateOnly
    ? new Date(`${iso}T12:00:00`)
    : new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("pt-BR");
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Devolve o label legivel de uma categoria pelo slug. Se a categoria
 * existir em `categories` usa o `name` (ja correto pt-BR + Title Case).
 * Senao, pretty-print do slug (snake_case -> "Snake Case") com Title
 * Case respeitando conectores curtos. Fallback "—" quando slug e' null.
 */
const LOWERCASE_CONNECTORS = new Set([
  "a", "o", "e", "ou", "de", "da", "do", "das", "dos",
  "em", "na", "no", "nas", "nos", "com", "por", "para",
]);

function prettyFromSlug(slug: string): string {
  return slug
    .split("_")
    .map((word, i) =>
      i > 0 && LOWERCASE_CONNECTORS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function getCategoryLabel(
  slug: string | null | undefined,
  categories: FarmCategory[],
  fallback = "—",
): string {
  if (!slug) return fallback;
  const found = categories.find((c) => c.slug === slug);
  if (found) return found.name;
  return prettyFromSlug(slug);
}

/**
 * Converte input pt-BR ("1.234,56") em number. Tolerante:
 * - "1234.56" -> 1234.56
 * - "1234,56" -> 1234.56
 * - "1.234,56" -> 1234.56
 * - "" / invalid -> NaN
 */
export function parseBRLInput(raw: string): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  // Se tem virgula como decimal (caso brasileiro), tira pontos e troca virgula
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return Number(cleaned);
}

/**
 * Mascara de moeda "se formata sozinho" pro input de valor: trata os digitos
 * digitados como centavos e devolve "1.234,56". Vazio -> "". Usar no onChange
 * do input; no submit passar por parseBRLInput.
 */
export function formatBRLInput(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
