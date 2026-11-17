import { useId, useLayoutEffect, useRef } from "react";
import { cn } from "@/components/ui/utils";
import {
  BIGODE,
  LETRAS,
  NOME_TRANSFORM_EXTERNO,
  NOME_TRANSFORM_INTERNO,
  NOME_VIEWBOX,
  OCULOS,
  SIMBOLO_VIEWBOX,
} from "./desenhoDaMarca";

/**
 * Marca animada da tela de entrada (escolhida em 17/11/2026, "reflexo e
 * mexidinha"). Quando e quanto toca: aberturaDaMarca.ts. Fora da entrada,
 * usar Logo / LogoName (Logo.tsx), que são estáticos.
 *
 * Desenho em SVG inline (desenhoDaMarca.ts) para animar as partes: um brilho
 * branco atravessa a armação dos óculos (recortado por ela) e o bigode dá uma
 * mexidinha. Keyframes em app.css (.marca-*).
 */
export function SimboloAnimado({
  tocar,
  pulso,
  className,
}: {
  /** Toca na montagem (visita nova). */
  tocar: boolean;
  /** Cada valor novo (> 0) repete o reflexo e a mexidinha. */
  pulso: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const ativo = tocar || pulso > 0;
  return (
    <svg
      viewBox={SIMBOLO_VIEWBOX}
      role="img"
      aria-label="gerentia.app"
      className={cn("w-auto overflow-visible", className)}
      style={{ aspectRatio: "902 / 522" }}
    >
      <defs>
        <clipPath id={`armacao-${id}`}>
          <path d={OCULOS} clipRule="evenodd" />
        </clipPath>
        <linearGradient id={`brilho-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={OCULOS} fill="#3C3C42" fillRule="evenodd" />
      {/* key = pulso: remontar reinicia a animação CSS. */}
      <path
        key={`b${pulso}`}
        d={BIGODE}
        fill="#3C3C42"
        className={cn("marca-bigode", ativo && "marca-mexe")}
      />
      <g clipPath={`url(#armacao-${id})`}>
        <g transform="rotate(20 780 790)">
          <rect
            key={`r${pulso}`}
            x="150"
            y="300"
            width="140"
            height="1000"
            fill={`url(#brilho-${id})`}
            className={cn("marca-brilho", ativo && "marca-brilha")}
          />
        </g>
      </g>
    </svg>
  );
}

const MS_POR_LETRA = 75;

/**
 * Nome "gerentia.app" digitado letra a letra, com cursor que pisca antes e
 * depois. Sem `digitar`, aparece pronto. O cursor é posicionado pela caixa de
 * cada letra (getBBox), então segue o desenho, que não é monoespaçado.
 */
export function NomeDigitado({
  digitar,
  inicioMs = 600,
  className,
}: {
  digitar: boolean;
  /** Espera antes da 1ª letra (o símbolo anima primeiro). */
  inicioMs?: number;
  className?: string;
}) {
  const grupo = useRef<SVGGElement>(null);
  const cursor = useRef<SVGRectElement>(null);

  useLayoutEffect(() => {
    const g = grupo.current;
    const cur = cursor.current;
    if (!digitar || !g || !cur) return;
    const letras = [...g.querySelectorAll<SVGPathElement>("path")]
      .map((p) => ({ p, b: p.getBBox() }))
      .sort((a, b) => a.b.x - b.b.x);
    if (letras.length < 6) return;
    // Cursor da ponta do "t" (ascendente) até a base do "e".
    const e = letras[1].b;
    const t = letras[5].b;
    cur.setAttribute("y", String(t.y));
    cur.setAttribute("height", String(e.y + e.height - t.y));
    const posicao = (i: number) =>
      cur.setAttribute(
        "x",
        String(
          i < 0 ? letras[0].b.x - 0.3 : letras[i].b.x + letras[i].b.width + 0.9,
        ),
      );

    letras.forEach(({ p }) => (p.style.opacity = "0"));
    posicao(-1);
    cur.style.opacity = "0";

    const timers: number[] = [];
    const em = (ms: number, f: () => void) =>
      timers.push(window.setTimeout(f, ms));
    [0, 1, 2].forEach((k) =>
      em(inicioMs - 520 + k * 170, () => {
        cur.style.opacity = k % 2 ? "0" : "1";
      }),
    );
    letras.forEach(({ p }, i) =>
      em(inicioMs + i * MS_POR_LETRA, () => {
        p.style.opacity = "1";
        posicao(i);
        cur.style.opacity = "1";
      }),
    );
    const fim = inicioMs + letras.length * MS_POR_LETRA;
    [0, 1, 2, 3, 4].forEach((k) =>
      em(fim + 150 + k * 190, () => {
        cur.style.opacity = k % 2 ? "1" : "0";
      }),
    );
    return () => {
      timers.forEach(clearTimeout);
      letras.forEach(({ p }) => (p.style.opacity = ""));
      cur.style.opacity = "0";
    };
  }, [digitar, inicioMs]);

  return (
    <svg
      viewBox={NOME_VIEWBOX}
      role="img"
      aria-label="gerentia.app"
      className={cn("w-auto overflow-visible", className)}
      style={{ aspectRatio: "2278 / 447" }}
    >
      <g transform={NOME_TRANSFORM_EXTERNO}>
        <g ref={grupo} transform={NOME_TRANSFORM_INTERNO} fill="#3C3C42">
          {LETRAS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g transform={NOME_TRANSFORM_INTERNO}>
          <rect
            ref={cursor}
            width="0.9"
            height="0"
            rx="0.2"
            fill="#3C3C42"
            style={{ opacity: 0 }}
          />
        </g>
      </g>
    </svg>
  );
}
