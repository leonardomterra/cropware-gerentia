import type { ImgHTMLAttributes } from "react";
import { cn } from "@/components/ui/utils";

/**
 * Simbolo proprio do Cropware Farm. Servido em `/logo-farm-01.svg`
 * (public/). E' um glifo quase quadrado (viewBox 0 0 450 500, aspect
 * ~0.9:1) - NAO tem wordmark; o nome aparece na tagline ao lado no
 * header (AppShell). Cor nativa do path = preto, entao em fundo claro
 * renderiza escuro; pra fundo escuro (header slate) usar prop `white`
 * que aplica `filter: brightness(0) invert(1)`.
 *
 * Exemplos:
 *   <Logo className="h-8 w-auto shrink-0" white />     // header
 *   <Logo className="h-7 w-auto" />                    // AuthLayout
 */
export function Logo({
  className,
  white = false,
  alt = "Cropware Farm",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { white?: boolean }) {
  return (
    <img
      src="/logo-farm-01.svg"
      alt={alt}
      className={cn("w-auto object-contain", className)}
      style={white ? { filter: "brightness(0) invert(1)" } : undefined}
      {...props}
    />
  );
}

/**
 * Wordmark "CROPWARE FARM" (so o texto, sem o simbolo). Servido em
 * `/logo-farm-name.svg` (viewBox 0 0 965 115, aspect ~8.4:1). Cor nativa
 * preta; usar `white` no header escuro. Combina com <Logo> (simbolo) pra
 * formar o lockup completo.
 */
export function LogoName({
  className,
  white = false,
  alt = "Cropware Farm",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { white?: boolean }) {
  return (
    <img
      src="/logo-farm-name.svg"
      alt={alt}
      className={cn("w-auto object-contain", className)}
      style={white ? { filter: "brightness(0) invert(1)" } : undefined}
      {...props}
    />
  );
}
