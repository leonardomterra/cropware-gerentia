import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toSubtitleCase(str: string) {
  if (!str) return '';

  // Se for um email ou ID (contém @ ou hifens de UUID), retornar como está
  if (str.includes('@') || (str.includes('-') && str.length > 20)) return str;

  return str
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      // Manter conectores em minúsculo se não forem a primeira palavra
      const connectors = ['de', 'da', 'do', 'das', 'dos', 'em', 'e', 'com', 'a', 'o'];
      if (connectors.includes(word) && index !== 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
