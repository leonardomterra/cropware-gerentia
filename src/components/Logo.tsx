import type { ImgHTMLAttributes } from "react";
import { cn } from "@/components/ui/utils";

/**
 * Marca do gerentia.app, em dois arquivos de `public/`, os dois na cor da marca
 * (#3C3C42, o grafite da Cropware):
 *
 * - `Logo` — o símbolo (óculos + bigode), `gerentia-symbol.svg`. Aspecto
 *   ~1.73:1; dimensionar pela altura (`h-6`, `h-16`…).
 * - `LogoName` — o nome "gerentia.app" desenhado, `gerentia-name.svg`. Aspecto
 *   ~5.1:1. Substituiu o nome em texto vivo (fonte Mozilla Headline, com
 *   animação de digitação) em 17/11/2026: a marca agora é o desenho.
 *
 * Em fundo escuro, `white` pinta de branco (filtro). No tema escuro a classe
 * `marca-img` clareia a marca sozinha (app.css). A cor vem do próprio SVG,
 * então não usar `opacity-*` em cima: muda o tom da marca.
 */
type Props = ImgHTMLAttributes<HTMLImageElement> & { white?: boolean };

const BRANCO = { filter: "brightness(0) invert(1)" };

export function Logo({
  className,
  white = false,
  alt = "gerentia.app",
  ...props
}: Props) {
  return (
    <img
      src="/gerentia-symbol.svg"
      alt={alt}
      className={cn("marca-img w-auto object-contain", className)}
      style={white ? BRANCO : undefined}
      {...props}
    />
  );
}

export function LogoName({
  className,
  white = false,
  alt = "gerentia.app",
  ...props
}: Props) {
  return (
    <img
      src="/gerentia-name.svg"
      alt={alt}
      className={cn("marca-img w-auto object-contain", className)}
      style={white ? BRANCO : undefined}
      {...props}
    />
  );
}
