import type { ImgHTMLAttributes } from "react";
import { cn } from "@/components/ui/utils";

/**
 * Simbolo do gerentia.app - SVG monocromatico (gerentia-symbol.svg), o mesmo
 * usado nos posts do Cropware Studio. viewBox ja cropado no bounding box justo
 * (aspecto ~1.728:1, mais largo que alto). Um unico <path>; cor nativa escura
 * (path preto). Em fundo escuro usar prop `white` (filter brightness/invert);
 * aqui o default e' escuro, pros fundos claros do app.
 *
 * (Substitui o antigo /icon.png - o simbolo "rosto" da fase Diretor IA. Marca
 * unica Gerentia; ver docs/GERENTIA-BRAND.md.)
 */
export function Logo({
  className,
  white = false,
  alt = "gerentia.app",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { white?: boolean }) {
  return (
    <img
      src="/gerentia-symbol.svg"
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
