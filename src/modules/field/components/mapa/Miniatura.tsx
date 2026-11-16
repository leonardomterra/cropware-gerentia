import { cn } from "@/components/ui/utils";
import { caixaDe, type LatLng } from "../../geo/geometria";

/**
 * Miniatura de talhão(ões) em SVG puro — sem mapa de fundo.
 *
 * Decisão da fase 1: uma lista com 40 talhões e um mapa de satélite em cada
 * cartão baixa centenas de imagens e trava no celular; sem rede, nem aparece.
 * O contorno sozinho já diz "qual é" o talhão. A vista com satélite fica no
 * formulário.
 *
 * Projeção simples (lng → x, -lat → y, com a longitude encolhida por
 * cos(latitude)) — para uma miniatura, mais que suficiente.
 */
export function Miniatura({
  destaque,
  outros = [],
  className,
  corDestaque = "#65a30d",
}: {
  /** O(s) contorno(s) em evidência. Ponto único = marcador. */
  destaque: LatLng[][];
  /** Vizinhos, em cinza. */
  outros?: LatLng[][];
  className?: string;
  corDestaque?: string;
}) {
  const todos = [...destaque, ...outros].filter((p) => p.length > 0);
  const caixa = caixaDe(todos);

  if (!caixa) {
    return (
      <div
        className={cn(
          "rounded-md bg-slate-100 flex items-center justify-center text-[10px] text-slate-400",
          className,
        )}
      >
        sem mapa
      </div>
    );
  }

  const [[minLat, minLng], [maxLat, maxLng]] = caixa;
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const larg = Math.max((maxLng - minLng) * k, 1e-6);
  const alt = Math.max(maxLat - minLat, 1e-6);
  const lado = Math.max(larg, alt);
  const margem = lado * 0.12;
  const x = (lng: number) => (lng - minLng) * k + (lado - larg) / 2 + margem;
  const y = (lat: number) => maxLat - lat + (lado - alt) / 2 + margem;
  const vb = lado + margem * 2;
  const traco = vb / 60;

  const desenhar = (pts: LatLng[], cor: string, opac: number, key: string) =>
    pts.length === 1 ? (
      <circle
        key={key}
        cx={x(pts[0][1])}
        cy={y(pts[0][0])}
        r={vb / 14}
        fill={cor}
        stroke="white"
        strokeWidth={traco}
      />
    ) : (
      <polygon
        key={key}
        points={pts.map(([la, ln]) => `${x(ln)},${y(la)}`).join(" ")}
        fill={cor}
        fillOpacity={opac}
        stroke={cor}
        strokeWidth={traco}
        strokeLinejoin="round"
      />
    );

  return (
    <svg
      viewBox={`0 0 ${vb} ${vb}`}
      className={cn("rounded-md bg-slate-50", className)}
      aria-hidden
    >
      {outros.map((p, i) => desenhar(p, "#cbd5e1", 0.35, `o${i}`))}
      {destaque.map((p, i) => desenhar(p, corDestaque, 0.3, `d${i}`))}
    </svg>
  );
}
