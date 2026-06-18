import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ccTextColor } from "@/modules/cost-centers/ccIcons";

/**
 * Laboratório de BADGES (DEV / não-produção). Acessível em /badges.
 * Compara modelos de estilo de badge (soft, sólido, outline, dot…) aplicados
 * aos status reais do app, pra escolher um padrão único e consistente.
 *
 * Obs.: as classes de cor são escritas LITERAIS (mapa PALETTE) porque o Tailwind
 * só gera o CSS de classes que existem no código — `bg-${cor}-50` não funciona.
 */

type Color =
  | "emerald"
  | "amber"
  | "blue"
  | "red"
  | "slate"
  | "orange"
  | "rose";

// Mesmos status, mas mapeados às cores EXATAS da paleta de Centro de Custo
// (hex Tailwind 400). Texto na versão escura via ccTextColor (700/800).
const STATUSES_CC: { label: string; hex: string }[] = [
  { label: "Pago", hex: "#34d399" },     // emerald
  { label: "Pagar", hex: "#fbbf24" },    // amber
  { label: "A Receber", hex: "#60a5fa" },// blue
  { label: "Recebido", hex: "#34d399" }, // emerald
  { label: "Vencido", hex: "#f87171" },  // red
  { label: "Cancelado", hex: "#a1a1aa" },// zinc
  { label: "Previsto", hex: "#a78bfa" }, // violet (distinto do amber)
  { label: "Entrada", hex: "#34d399" },  // emerald
  { label: "Saída", hex: "#f87171" },    // red
];

// Status reais do app (lançamentos) + entrada/saída.
const STATUSES: { label: string; color: Color }[] = [
  { label: "Pago", color: "emerald" },
  { label: "Pagar", color: "amber" },
  { label: "A Receber", color: "blue" },
  { label: "Recebido", color: "emerald" },
  { label: "Vencido", color: "red" },
  { label: "Cancelado", color: "slate" },
  { label: "Previsto", color: "orange" },
  { label: "Entrada", color: "emerald" },
  { label: "Saída", color: "rose" },
];

// Paleta literal por cor (todas as variações usadas pelos modelos abaixo).
const PALETTE: Record<
  Color,
  {
    bg50: string; bg100: string; bg300: string; bg400: string; bg500: string; bg600: string; bg700: string; bg800: string;
    text700: string; text800: string;
    border200: string;
    dot500: string;
  }
> = {
  emerald: { bg50: "bg-emerald-50", bg100: "bg-emerald-100", bg300: "bg-emerald-300", bg400: "bg-emerald-400", bg500: "bg-emerald-500", bg600: "bg-emerald-600", bg700: "bg-emerald-700", bg800: "bg-emerald-800", text700: "text-emerald-700", text800: "text-emerald-800", border200: "border-emerald-200", dot500: "bg-emerald-500" },
  amber:   { bg50: "bg-amber-50",   bg100: "bg-amber-100",   bg300: "bg-amber-300",   bg400: "bg-amber-400",   bg500: "bg-amber-500",   bg600: "bg-amber-600",   bg700: "bg-amber-700",   bg800: "bg-amber-800",   text700: "text-amber-700",   text800: "text-amber-800",   border200: "border-amber-200",   dot500: "bg-amber-500" },
  blue:    { bg50: "bg-blue-50",    bg100: "bg-blue-100",    bg300: "bg-blue-300",    bg400: "bg-blue-400",    bg500: "bg-blue-500",    bg600: "bg-blue-600",    bg700: "bg-blue-700",    bg800: "bg-blue-800",    text700: "text-blue-700",    text800: "text-blue-800",    border200: "border-blue-200",    dot500: "bg-blue-500" },
  red:     { bg50: "bg-red-50",     bg100: "bg-red-100",     bg300: "bg-red-300",     bg400: "bg-red-400",     bg500: "bg-red-500",     bg600: "bg-red-600",     bg700: "bg-red-700",     bg800: "bg-red-800",     text700: "text-red-700",     text800: "text-red-800",     border200: "border-red-200",     dot500: "bg-red-500" },
  slate:   { bg50: "bg-slate-50",   bg100: "bg-slate-100",   bg300: "bg-slate-300",   bg400: "bg-slate-400",   bg500: "bg-slate-500",   bg600: "bg-slate-600",   bg700: "bg-slate-700",   bg800: "bg-slate-800",   text700: "text-slate-700",   text800: "text-slate-800",   border200: "border-slate-200",   dot500: "bg-slate-500" },
  orange:  { bg50: "bg-orange-50",  bg100: "bg-orange-100",  bg300: "bg-orange-300",  bg400: "bg-orange-400",  bg500: "bg-orange-500",  bg600: "bg-orange-600",  bg700: "bg-orange-700",  bg800: "bg-orange-800",  text700: "text-orange-700",  text800: "text-orange-800",  border200: "border-orange-200",  dot500: "bg-orange-500" },
  rose:    { bg50: "bg-rose-50",    bg100: "bg-rose-100",    bg300: "bg-rose-300",    bg400: "bg-rose-400",    bg500: "bg-rose-500",    bg600: "bg-rose-600",    bg700: "bg-rose-700",    bg800: "bg-rose-800",    text700: "text-rose-700",    text800: "text-rose-800",    border200: "border-rose-200",    dot500: "bg-rose-500" },
};

interface Model {
  id: string;
  name: string;
  desc: string;
  /** classes de cor do badge (fundo/texto/borda). */
  cls: (c: Color) => string;
  /** mostra um ponto colorido antes do texto. */
  dot?: boolean;
}

const MODELS: Model[] = [
  // Soft (tons claros) — fundo 50/100, texto escuro.
  { id: "soft", name: "Soft (bg-50 + borda)", desc: "bg-50 · text-700 · border-200", cls: (c) => `${PALETTE[c].bg50} ${PALETTE[c].text700} border ${PALETTE[c].border200}` },
  { id: "soft-nb", name: "Soft sem borda", desc: "bg-50 · text-700", cls: (c) => `${PALETTE[c].bg50} ${PALETTE[c].text700}` },
  { id: "soft-strong", name: "Soft forte", desc: "bg-100 · text-800 · border-200", cls: (c) => `${PALETTE[c].bg100} ${PALETTE[c].text800} border ${PALETTE[c].border200}` },
  // Sólidos — claros (300/400) usam texto escuro; branco não contrasta o bastante.
  { id: "solid-300", name: "Sólido 300 (bem suave)", desc: "bg-300 · texto escuro", cls: (c) => `${PALETTE[c].bg300} ${PALETTE[c].text800}` },
  { id: "solid-400", name: "Sólido 400 (suave)", desc: "bg-400 · texto escuro", cls: (c) => `${PALETTE[c].bg400} ${PALETTE[c].text800}` },
  { id: "solid-400-white", name: "Sólido 400 · texto branco", desc: "bg-400 · text-white", cls: (c) => `${PALETTE[c].bg400} text-white` },
  { id: "solid-500", name: "Sólido 500 (mais vibrante)", desc: "bg-500 · text-white", cls: (c) => `${PALETTE[c].bg500} text-white` },
  { id: "solid-600", name: "Sólido 600", desc: "bg-600 · text-white", cls: (c) => `${PALETTE[c].bg600} text-white` },
  { id: "solid-700", name: "Sólido 700 (menos vibrante)", desc: "bg-700 · text-white", cls: (c) => `${PALETTE[c].bg700} text-white` },
];

type Shape = "rounded" | "pill";
type Size = "default" | "compact";

export default function BadgeLabPage() {
  const [shape, setShape] = useState<Shape>("rounded");
  const [size, setSize] = useState<Size>("default");

  const shapeCls = shape === "pill" ? "rounded-full" : "rounded";
  const sizeCls = size === "compact" ? "h-5 text-[11px] px-2" : "h-6 text-xs px-2.5";

  function badgeCls(model: Model, c: Color): string {
    return `inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap border-transparent ${shapeCls} ${sizeCls} ${model.cls(c)}`;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-base font-medium text-slate-900">Laboratório de Badges</h1>
        <p className="text-sm text-slate-500 mt-1">
          Compare os modelos e escolha um padrão. Os status são os reais do app.
        </p>
      </div>

      {/* Controles globais */}
      <div className="flex flex-wrap items-center gap-4 bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Cantos:</span>
          {(["rounded", "pill"] as Shape[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShape(s)}
              className={`h-8 px-3 rounded-md text-sm transition-colors ${shape === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {s === "rounded" ? "Arredondado" : "Pílula"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Tamanho:</span>
          {(["default", "compact"] as Size[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`h-8 px-3 rounded-md text-sm transition-colors ${size === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {s === "default" ? "Padrão (h-6)" : "Compacto (h-5)"}
            </button>
          ))}
        </div>
      </div>

      {/* Componente atual (referência) */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-slate-900">Componente atual &lt;Badge&gt;</h2>
        <p className="text-xs text-slate-500 mb-3">Como está hoje no app (não usa os controles acima).</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s, i) => (
            <Badge key={i} colorScheme={s.color}>{s.label}</Badge>
          ))}
        </div>
      </section>

      {/* Cores exatas do Centro de Custo (fill 400 + texto escuro) */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 ring-1 ring-slate-900/5">
        <h2 className="text-sm font-medium text-slate-900">Cores do Centro de Custo</h2>
        <p className="text-xs text-slate-400 mb-3 font-mono">fill hex 400 · texto escuro (ccTextColor)</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES_CC.map((s, i) => (
            <span
              key={i}
              className={`inline-flex items-center justify-center font-medium whitespace-nowrap border-transparent ${shapeCls} ${sizeCls}`}
              style={{ backgroundColor: s.hex, color: ccTextColor(s.hex) }}
            >
              {s.label}
            </span>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-400 mb-2">Em contexto (card de lançamento):</p>
          <div className="border border-slate-200 rounded-lg p-3 max-w-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-900 truncate">Posto 15</p>
              <p className="font-medium tabular-nums text-sm text-slate-900">R$ 50,00</p>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">16/06/2026 — Combustível</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center font-medium whitespace-nowrap border-transparent ${shapeCls} ${sizeCls}`} style={{ backgroundColor: "#f87171", color: ccTextColor("#f87171") }}>Saída</span>
              <span className={`inline-flex items-center justify-center font-medium whitespace-nowrap border-transparent ${shapeCls} ${sizeCls}`} style={{ backgroundColor: "#34d399", color: ccTextColor("#34d399") }}>Pago</span>
            </div>
          </div>
        </div>
      </section>

      {/* Modelos candidatos */}
      {MODELS.map((model) => (
        <section key={model.id} className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-slate-900">{model.name}</h2>
          <p className="text-xs text-slate-400 mb-3 font-mono">{model.desc}</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s, i) => (
              <span key={i} className={badgeCls(model, s.color)}>
                {model.dot && (
                  <span className={`size-1.5 rounded-full ${PALETTE[s.color].dot500}`} />
                )}
                {s.label}
              </span>
            ))}
          </div>

          {/* Simulação em contexto: card de lançamento */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 mb-2">Em contexto (card de lançamento):</p>
            <div className="border border-slate-200 rounded-lg p-3 max-w-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-900 truncate">Posto 15</p>
                <p className="font-medium tabular-nums text-sm text-slate-900">R$ 50,00</p>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">16/06/2026 — Combustível</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={badgeCls(model, "rose")}>
                  {model.dot && <span className={`size-1.5 rounded-full ${PALETTE.rose.dot500}`} />}
                  Saída
                </span>
                <span className={badgeCls(model, "emerald")}>
                  {model.dot && <span className={`size-1.5 rounded-full ${PALETTE.emerald.dot500}`} />}
                  Pago
                </span>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
