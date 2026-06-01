import type { ImgHTMLAttributes } from "react";
import { cn } from "@/components/ui/utils";

/**
 * Simbolo do Cropware Farm - PNG (logo-farm-01.png, 136x144 @3x pra
 * exibicao a 48px). Exportado do Affinity em sRGB + Lanczos transparente.
 *
 * Por que PNG e nao SVG inline: o desenho e' detalhado demais e serrilhava
 * como vetor em tamanho pequeno; o downscale Lanczos do PNG @3x rende
 * melhor nesse tamanho fixo de header. Cor nativa preta/#111827; em fundo
 * escuro (se voltar) usar prop `white` (filter brightness/invert).
 */
export function Logo({
  className,
  white = false,
  alt = "Cropware Farm",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { white?: boolean }) {
  return (
    <img
      src="/icon.png"
      alt={alt}
      className={cn("w-auto object-contain", className)}
      style={white ? { filter: "brightness(0) invert(1)" } : undefined}
      {...props}
    />
  );
}

/**
 * Wordmark "CROPWARE FARM" (so o texto, sem o simbolo). Via <img> ainda -
 * o wordmark e' "cheio" e nao sofre o serrilhamento que o simbolo sofria.
 * Cor nativa: CROPWARE #111827 + FARM emerald. NUNCA usar white (mataria
 * o verde via filter).
 */
export function LogoName({
  className,
  alt = "Cropware Farm",
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src="/logo-farm-name.svg"
      alt={alt}
      className={cn("w-auto object-contain", className)}
      {...props}
    />
  );
}
