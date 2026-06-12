import type { ImgHTMLAttributes } from "react";
import { cn } from "@/components/ui/utils";

/**
 * Simbolo do gerentia.app - PNG (logo-farm-01.png, 136x144 @3x pra
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
  alt = "gerentia.app",
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
 * Wordmark "DIRETOR IA" (so o texto + balaozinho, sem o simbolo), via <img>.
 * Versao estatica do logo, usada em telas fora da sidebar (ex: JoinPage).
 * Na sidebar usamos o <LogoWordmark> (texto vivo + animacao). Cor nativa
 * #111827.
 */
export function LogoName({
  className,
  alt = "gerentia.app",
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
