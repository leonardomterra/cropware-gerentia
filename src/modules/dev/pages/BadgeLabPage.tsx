import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

/**
 * Laboratório de BADGES (DEV, fora de produção). Rota: /badges.
 *
 * PARA QUE SERVE: calibrar o tom dos selos. O app fixou a forma — fundo 200,
 * texto 900, sem borda e sem sombra — mas "200" não quer dizer a mesma coisa em
 * todas as cores da paleta do Tailwind. Em amarelo, o 200 é muito mais SATURADO
 * que nas outras, e é por isso que o selo âmbar salta da tela como se fosse de
 * outro sistema.
 *
 * A página mede isso em vez de opinar: lê a cor que o navegador realmente
 * pintou e converte para OKLCH, o espaço em que "claridade" e "saturação"
 * correspondem ao que o olho vê (em HSL não correspondem — amarelo e azul com o
 * mesmo "L" parecem clarezas completamente diferentes).
 *
 * Como usar: olhe a coluna CROMA na primeira tabela. Os valores devem ficar
 * numa faixa estreita; quem está muito acima é o que destoa.
 */

// ---------------------------------------------------------------- medição

/**
 * Lê a cor computada e devolve claridade e croma em OKLCH.
 *
 * O navegador devolve em formatos diferentes conforme a cor foi escrita: o
 * Tailwind v4 define a paleta em `oklch(...)` e o Chrome ENTREGA `oklch(...)`
 * de volta, enquanto um `bg-[#eedea1]` volta como `rgb(...)`. Ler os dois é
 * obrigatório — tratar "oklch(0.9 0.08 96)" como se fosse RGB dá números sem
 * sentido, e o gráfico inteiro mente sem parecer que está mentindo.
 */
function medir(cor: string): { L: number; C: number } | null {
  const n = cor.match(/-?\d*\.?\d+/g)?.map(Number);
  if (!n || n.length < 3) return null;

  if (cor.startsWith("oklch")) return { L: n[0], C: n[1] };

  // `color(srgb 0-1 ...)` ou `rgb(0-255 ...)`.
  const esc = cor.startsWith("color(") ? 1 : 1 / 255;
  const lin = (v: number) => {
    const c = v * esc;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = [lin(n[0]), lin(n[1]), lin(n[2])];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb) };
}

/** Mede o fundo de cada elemento marcado com data-medir. */
function useMedidas(dep: unknown) {
  const raiz = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState<
    Record<string, { L: number; C: number }>
  >({});
  useEffect(() => {
    if (!raiz.current) return;
    const out: Record<string, { L: number; C: number }> = {};
    raiz.current.querySelectorAll<HTMLElement>("[data-medir]").forEach((el) => {
      const v = medir(getComputedStyle(el).backgroundColor);
      if (v) out[el.dataset.medir!] = v;
    });
    setMedidas(out);
  }, [dep]);
  return { raiz, medidas };
}

// ---------------------------------------------------------------- dados

const FAMILIA = [
  "slate",
  "amber",
  "emerald",
  "red",
  "blue",
  "green",
  "orange",
  "yellow",
  "purple",
  "cyan",
  "teal",
  "indigo",
  "pink",
  "rose",
  "sky",
  "lime",
] as const;

/**
 * Candidatos para o âmbar. Os dois calibrados foram calculados a partir do
 * PRÓPRIO amber-200: mesma matiz, croma trazido para a faixa da família
 * (0,06-0,09) e claridade alinhada com emerald-200 e orange-200.
 */
const CANDIDATOS: {
  id: string;
  rotulo: string;
  nota: string;
  classe: string;
}[] = [
  {
    id: "adotado",
    rotulo: "Adotado",
    nota: "L 0,914 · croma 0,075 — a mediana da família. É o que o app usa hoje.",
    classe: "bg-[oklch(0.914_0.075_95.746)] text-amber-900",
  },
  {
    id: "antigo",
    rotulo: "Anterior",
    nota: "amber-200 — croma 0,120, o dobro de red e blue. Era o que destoava.",
    classe: "bg-amber-200 text-amber-900",
  },
  {
    id: "mais-fundo",
    rotulo: "Mais fundo",
    nota: "L 0,900 · croma 0,085 — se o adotado parecer apagado demais",
    classe: "bg-[oklch(0.900_0.085_95.746)] text-amber-900",
  },
  {
    id: "cem",
    rotulo: "amber-100",
    nota: "croma cabe, mas L 0,962 — clareia demais e some no card branco",
    classe: "bg-amber-100 text-amber-900",
  },
  {
    id: "laranja",
    rotulo: "orange-200",
    nota: "token existente e já na faixa, mas colide com o selo de previsto",
    classe: "bg-orange-200 text-orange-900",
  },
];

/** Os rótulos âmbar que existem de verdade no app. */
const USOS = ["Pagar", "Trial", "Não verificado", "Dono", "Vence hoje"];

// ---------------------------------------------------------------- página

export default function BadgeLabPage() {
  const [fundo, setFundo] = useState<"branco" | "cinza">("branco");
  const { raiz, medidas } = useMedidas(fundo);

  const linhas = FAMILIA.map((c) => ({
    cor: c,
    ...(medidas[c] ?? { L: 0, C: 0 }),
  })).sort((a, b) => b.C - a.C);
  const coloridas = linhas.filter((l) => l.C > 0.001);
  const mediana = coloridas.length
    ? coloridas[Math.floor(coloridas.length / 2)].C
    : 0;

  return (
    <div ref={raiz} className="space-y-8 pb-16">
      <header className="space-y-1">
        <h1 className="text-base font-medium text-slate-900">
          Laboratório de Selos
        </h1>
        <p className="text-sm text-slate-500">
          Mede a cor que o navegador pintou, em OKLCH. Croma é saturação como o
          olho vê; quem está muito acima da mediana destoa da família.
        </p>
        <div className="flex gap-2 pt-2">
          {(["branco", "cinza"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFundo(f)}
              className={cn(
                "h-8 px-3 rounded-md text-sm",
                fundo === f
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              Fundo {f}
            </button>
          ))}
        </div>
      </header>

      {/* 1 — a família inteira, ordenada por croma */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-900">
          A família, do mais saturado ao menos
        </h2>
        <div
          className={cn(
            "rounded-xl border border-slate-200 p-4",
            fundo === "branco" ? "bg-white" : "bg-slate-50",
          )}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="text-left font-normal py-1.5">Selo</th>
                <th className="text-right font-normal">Claridade</th>
                <th className="text-right font-normal">Croma</th>
                <th className="text-right font-normal">vs. mediana</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const fora = l.C > 0.001 && l.C > mediana * 1.5;
                return (
                  <tr key={l.cor} className="border-b border-slate-50">
                    <td className="py-1.5">
                      <Badge
                        colorScheme={l.cor}
                        data-medir={l.cor}
                        className="min-w-[104px] justify-center"
                      >
                        {l.cor}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums text-slate-600">
                      {l.L.toFixed(3)}
                    </td>
                    <td className="text-right tabular-nums text-slate-600">
                      {l.C.toFixed(3)}
                    </td>
                    <td
                      className={cn(
                        "text-right tabular-nums",
                        fora ? "text-red-600 font-medium" : "text-slate-400",
                      )}
                    >
                      {l.C > 0.001 ? `${(l.C / mediana).toFixed(2)}×` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2 — candidatos para o âmbar */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-900">
          Candidatos para o âmbar
        </h2>
        <div
          className={cn(
            "rounded-xl border border-slate-200 p-4 space-y-3",
            fundo === "branco" ? "bg-white" : "bg-slate-50",
          )}
        >
          {CANDIDATOS.map((c) => {
            const m = medidas[`cand-${c.id}`];
            return (
              <div key={c.id} className="flex items-start gap-3">
                <Badge
                  colorScheme="none"
                  data-medir={`cand-${c.id}`}
                  className={cn(c.classe, "min-w-[104px] justify-center")}
                >
                  {c.rotulo}
                </Badge>
                <div className="min-w-0 text-sm">
                  <div className="text-slate-600">{c.nota}</div>
                  {m && (
                    <div className="text-slate-400 tabular-nums">
                      medido: L {m.L.toFixed(3)} · croma {m.C.toFixed(3)}
                      {mediana > 0 &&
                        ` · ${(m.C / mediana).toFixed(2)}× a mediana`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 — em contexto: ao lado dos vizinhos que ele tem de verdade */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-900">
          Em contexto, ao lado dos vizinhos reais
        </h2>
        <p className="text-sm text-slate-500">
          É aqui que se decide. Um tom só nunca parece errado sozinho — ele
          parece errado ao lado dos outros, numa lista.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CANDIDATOS.map((c) => (
            <div
              key={c.id}
              className={cn(
                "rounded-xl border border-slate-200 p-3 space-y-2",
                fundo === "branco" ? "bg-white" : "bg-slate-50",
              )}
            >
              <div className="text-sm font-medium text-slate-900">
                {c.rotulo}
              </div>
              {USOS.map((u) => (
                <div
                  key={u}
                  className="flex items-center justify-between gap-2 text-sm border-b border-slate-50 pb-2 last:border-0"
                >
                  <span className="text-slate-600 truncate">{u}</span>
                  <div className="flex gap-1 shrink-0">
                    <Badge colorScheme="none" className={c.classe}>
                      {u}
                    </Badge>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-1 pt-1">
                <Badge colorScheme="none" className={c.classe}>
                  Pagar
                </Badge>
                <Badge colorScheme="emerald">Pago</Badge>
                <Badge colorScheme="blue">A Receber</Badge>
                <Badge colorScheme="red">Vencido</Badge>
                <Badge colorScheme="slate">Cancelado</Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
