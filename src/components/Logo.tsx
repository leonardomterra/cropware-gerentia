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
 * Apenas o glifo (icone) do Cropware - sem o quadrado de fundo e sem
 * wordmark. fill=currentColor pra tingir via Tailwind text-*.
 * Mantido como backup pra usos compactos no futuro (hoje sem call site).
 */
export function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 150 150"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Cropware"
      {...props}
    >
      <g transform="matrix(0.93985,0,0,1.030498,3.874577,-0.427471)">
        <g transform="matrix(1.292245,0,0,1.178572,-21.298044,-15.145047)">
          <path
            fill="currentColor"
            d="M75.544,33.636C75.235,33.457 74.854,33.457 74.544,33.636L39.511,53.863C39.201,54.041 39.011,54.371 39.011,54.729L39.011,95.182C39.011,95.539 39.201,95.869 39.511,96.048L74.544,116.275C74.854,116.454 75.235,116.454 75.544,116.275L110.578,96.048C110.887,95.869 111.078,95.539 111.078,95.182L111.078,75.261L75.044,96.065L56.763,85.51L56.763,64.4L75.044,74.955L111.078,54.151L75.544,33.636Z"
          />
        </g>
      </g>
    </svg>
  );
}
