import ChevronLeft from "~icons/material-symbols-light/chevron-left";
import ChevronRight from "~icons/material-symbols-light/chevron-right";
import { cn } from "@/components/ui/utils";
import {
  MonthSwitcher,
  currentYearMonth,
  monthLabel,
  type YearMonth,
} from "@/modules/receipts/components/MonthSwitcher";

/**
 * Período do Dashboard: 4 modos que colapsam num intervalo de meses [from, to].
 * - month: 1 mês (régua de 12 meses + picker)
 * - semester: semestre CIVIL (1º jan-jun / 2º jul-dez) + ano
 * - year: ano civil (jan-dez)
 * - custom: de/até em meses, máx. 12 (clamp automático)
 */
export type DashMode = "month" | "semester" | "year" | "custom";

export interface DashPeriod {
  mode: DashMode;
  month: YearMonth;
  semester: { year: number; half: 1 | 2 };
  year: number;
  custom: { from: YearMonth; to: YearMonth };
}

const MONTHS_SHORT_CAP = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function defaultPeriod(): DashPeriod {
  const now = currentYearMonth();
  return {
    mode: "month",
    month: now,
    semester: { year: now.year, half: now.month <= 6 ? 1 : 2 },
    year: now.year,
    custom: { from: { year: now.year, month: 1 }, to: now },
  };
}

export function periodRange(p: DashPeriod): { from: YearMonth; to: YearMonth } {
  switch (p.mode) {
    case "month":
      return { from: p.month, to: p.month };
    case "semester": {
      const start = p.semester.half === 1 ? 1 : 7;
      return {
        from: { year: p.semester.year, month: start },
        to: { year: p.semester.year, month: start + 5 },
      };
    }
    case "year":
      return { from: { year: p.year, month: 1 }, to: { year: p.year, month: 12 } };
    case "custom":
      return p.custom;
  }
}

export function periodLabel(p: DashPeriod): string {
  switch (p.mode) {
    case "month":
      return monthLabel(p.month);
    case "semester":
      return `${p.semester.half}º semestre de ${p.semester.year}`;
    case "year":
      return String(p.year);
    case "custom": {
      const s = (m: YearMonth) => `${MONTHS_SHORT_CAP[m.month - 1]} ${m.year}`;
      return `${s(p.custom.from)} – ${s(p.custom.to)}`;
    }
  }
}

function idx(m: YearMonth): number {
  return m.year * 12 + (m.month - 1);
}
function fromIdx(i: number): YearMonth {
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** Garante from <= to e intervalo de no máximo 12 meses, ajustando o lado oposto ao editado. */
function clampCustom(
  from: YearMonth,
  to: YearMonth,
  changed: "from" | "to",
): { from: YearMonth; to: YearMonth } {
  let f = idx(from);
  let t = idx(to);
  if (changed === "from") {
    if (t < f) t = f;
    if (t - f > 11) t = f + 11;
  } else {
    if (t < f) f = t;
    if (t - f > 11) f = t - 11;
  }
  return { from: fromIdx(f), to: fromIdx(t) };
}

function YearStepper({
  year,
  onChange,
  className,
}: {
  year: number;
  onChange: (y: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        aria-label="Ano anterior"
        onClick={() => onChange(year - 1)}
        className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="text-sm font-medium text-slate-900 min-w-[3.5rem] text-center tabular-nums">
        {year}
      </span>
      <button
        type="button"
        aria-label="Próximo ano"
        onClick={() => onChange(year + 1)}
        className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}

const MODES: Array<[DashMode, string]> = [
  ["month", "Mês"],
  ["semester", "Semestre"],
  ["year", "Ano"],
  ["custom", "Personalizado"],
];

export function PeriodSwitcher({
  value,
  onChange,
  className,
}: {
  value: DashPeriod;
  onChange: (p: DashPeriod) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Segmented de modo */}
      <div className="flex flex-wrap items-center gap-1">
        {MODES.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ ...value, mode })}
            className={cn(
              "h-9 px-3 rounded-md text-sm transition-colors",
              value.mode === mode
                ? "bg-zinc-800 text-white font-medium"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Controles do modo ativo */}
      {value.mode === "month" && (
        <div className="flex items-center gap-2">
          <MonthSwitcher
            value={value.month}
            onChange={(month) => onChange({ ...value, month })}
            variant="chips"
            className="flex-1 min-w-0"
          />
          <MonthSwitcher
            value={value.month}
            onChange={(month) => onChange({ ...value, month })}
            variant="picker"
            className="w-[170px] shrink-0 hidden sm:flex"
          />
        </div>
      )}

      {value.mode === "semester" && (
        <div className="flex items-center gap-2">
          {([1, 2] as const).map((half) => (
            <button
              key={half}
              type="button"
              onClick={() =>
                onChange({ ...value, semester: { ...value.semester, half } })
              }
              className={cn(
                "h-9 flex-1 rounded-md text-sm transition-colors",
                value.semester.half === half
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {half}º semestre
            </button>
          ))}
          <YearStepper
            year={value.semester.year}
            onChange={(year) =>
              onChange({ ...value, semester: { ...value.semester, year } })
            }
            className="shrink-0"
          />
        </div>
      )}

      {value.mode === "year" && (
        <YearStepper
          year={value.year}
          onChange={(year) => onChange({ ...value, year })}
        />
      )}

      {value.mode === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>De</span>
          <MonthSwitcher
            value={value.custom.from}
            onChange={(from) =>
              onChange({
                ...value,
                custom: clampCustom(from, value.custom.to, "from"),
              })
            }
            variant="picker"
            className="w-[170px]"
          />
          <span>até</span>
          <MonthSwitcher
            value={value.custom.to}
            onChange={(to) =>
              onChange({
                ...value,
                custom: clampCustom(value.custom.from, to, "to"),
              })
            }
            variant="picker"
            className="w-[170px]"
          />
          <span className="text-xs text-slate-400">máx. 12 meses</span>
        </div>
      )}
    </div>
  );
}
