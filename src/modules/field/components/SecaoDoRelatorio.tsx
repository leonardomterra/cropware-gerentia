import type {
  ReportCell,
  ReportColumn,
  ReportMeta,
  ReportTable,
} from "@/modules/reports/reportBuilders";
import {
  ALTURA_GRAFICO,
  formasDoGrafico,
  legendaDeSeries,
  type Forma,
} from "@/modules/reports/reportCharts";
import { cn } from "@/components/ui/utils";

/**
 * Uma seção de `ReportDoc` (título, gráfico, tabela) desenhada NA TELA. O
 * gráfico usa as formas de reportCharts — o mesmo cálculo da página impressa e
 * do PDF do celular —, então o que se vê é o que sai no relatório.
 */
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function celula(v: ReportCell, col: ReportColumn): string {
  if (col.money && typeof v === "number") return brl(v);
  return String(v ?? "");
}

function FormaSvg({ f }: { f: Forma }) {
  if (f.tipo === "ret")
    return (
      <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={1.5} fill={f.cor} />
    );
  if (f.tipo === "path")
    return (
      <path
        d={f.d}
        fill={f.cor ?? "none"}
        fillOpacity={f.opacidade}
        stroke={f.contorno}
        strokeWidth={f.contorno ? 1 : undefined}
      />
    );
  if (f.tipo === "linha")
    return <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.cor} />;
  return (
    <text
      x={f.x}
      y={f.y}
      fontSize={f.tamanho}
      fill={f.cor}
      textAnchor={
        f.ancora === "meio" ? "middle" : f.ancora === "fim" ? "end" : "start"
      }
    >
      {f.texto}
    </text>
  );
}

const LARGURA = 600;

export function SecaoDoRelatorio({
  t,
  className,
}: {
  t: ReportTable;
  className?: string;
}) {
  const formas = t.chart
    ? formasDoGrafico(t.chart, LARGURA, ALTURA_GRAFICO)
    : [];
  const series = t.chart ? legendaDeSeries(t.chart) : [];
  return (
    <section
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-3 space-y-3 min-w-0",
        className,
      )}
    >
      {t.title && (
        <h3 className="text-sm font-medium text-slate-900">{t.title}</h3>
      )}
      {formas.length > 0 && (
        <>
          <svg
            viewBox={`0 0 ${LARGURA} ${ALTURA_GRAFICO}`}
            className="w-full h-auto max-h-40"
            role="img"
            aria-label={t.title}
          >
            {formas.map((f, i) => (
              <FormaSvg key={i} f={f} />
            ))}
          </svg>
          {series.length > 0 && (
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              {series.map((s) => (
                <span key={s.nome} className="flex items-center gap-1.5">
                  <i
                    className="inline-block size-2.5 rounded-sm"
                    style={{ backgroundColor: s.cor }}
                  />
                  {s.nome}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              {t.columns.map((c) => (
                <th
                  key={c.label}
                  className={cn(
                    "font-normal px-2 py-1.5",
                    c.align === "right" || c.money ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {t.rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {r.map((v, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-2 py-1.5 text-slate-800",
                      t.columns[j].align === "right" || t.columns[j].money
                        ? "text-right whitespace-nowrap"
                        : "",
                    )}
                  >
                    {celula(v, t.columns[j])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {t.total && (
            <tfoot className="tabular-nums border-t border-slate-200 font-medium">
              <tr>
                {t.total.map((v, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-2 py-1.5",
                      t.columns[j].align === "right" || t.columns[j].money
                        ? "text-right whitespace-nowrap"
                        : "",
                    )}
                  >
                    {celula(v, t.columns[j])}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

/** Os cartões de número (`meta`) na tela. */
export function CartoesDoRelatorio({ meta }: { meta: ReportMeta[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {meta.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border border-slate-200 bg-white p-3"
        >
          <p className="text-sm text-slate-500">{m.label}</p>
          <p
            className={cn(
              "text-lg font-medium tabular-nums",
              m.tone === "out"
                ? "text-red-700"
                : m.tone === "in"
                  ? "text-emerald-700"
                  : "text-slate-900",
            )}
          >
            {m.value}
          </p>
        </div>
      ))}
    </div>
  );
}
