import { CSSProperties, ReactNode } from 'react';

export interface LiquidGlassCardProps {
  /** Border radius do card (default 24) */
  radius?: number;
  /** Intensidade do blur do backdrop (default 16) */
  blur?: number;
  /** Saturação aplicada ao backdrop. Característico iOS — intensifica cores por trás (default 180%) */
  saturate?: number;
  /** Tint do vidro — vai no background do card. Default branco translúcido. */
  tint?: string;
  /** Borda do card (default 1px branco semitransparente). Passe `''` pra desligar. */
  border?: string;
  /** Sombra do card (formato box-shadow). Default inclui inner highlights estilo iOS. */
  shadow?: string;
  className?: string;
  style?: CSSProperties;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  children: ReactNode;
  onClick?: () => void;
}

/**
 * Glass single-layer: 1 elemento com background tint + backdrop-filter (blur + saturate)
 * + borda translúcida + inset highlights pra simular reflexo de luz.
 *
 * Mais simples que o multi-camada do Cropware Studio mas funciona robusto em qualquer
 * ambiente React/Vite sem problemas de stacking context isolation.
 */
export function LiquidGlassCard({
  radius = 24,
  blur = 16,
  saturate = 180,
  tint = 'rgba(255,255,255,0.15)',
  border = '1px solid rgba(255,255,255,0.25)',
  shadow = 'inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.1)',
  className,
  style,
  contentClassName,
  contentStyle,
  children,
  onClick,
}: LiquidGlassCardProps) {
  const backdropFilterValue = `blur(${blur}px) saturate(${saturate}%)`;
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        background: tint,
        backdropFilter: backdropFilterValue,
        WebkitBackdropFilter: backdropFilterValue,
        border: border || undefined,
        boxShadow: shadow || undefined,
        willChange: 'backdrop-filter',
        ...style,
      }}
    >
      <div
        className={contentClassName}
        style={{
          position: 'relative',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
