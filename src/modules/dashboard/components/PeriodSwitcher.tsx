import ChevronLeft from "~icons/material-symbols-light/chevron-left";
import ChevronRight from "~icons/material-symbols-light/chevron-right";
import ChevronDown from "~icons/material-symbols-light/keyboard-arrow-down";
import Calendar from "~icons/material-symbols-light/calendar-month-outline";
import { cn } from "@/components/ui/utils";
import { TOOLBAR_TRIGGER_CLASS } from "@/components/ui/toolbarTrigger";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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

/**
 * Seletor de MODO isolado (Mês/Semestre/Ano/Personalizado) — dropdown no mesmo
 * estilo do chip "Todos os Centros". Fica na barra de topo, ao lado dos centros;
 * os controles de cada modo ficam no <PeriodSwitcher> logo abaixo.
 */
export function PeriodModeSelect({
  value,
  onChange,
  className,
}: {
  value: DashPeriod;
  onChange: (p: DashPeriod) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(TOOLBAR_TRIGGER_CLASS, "w-[180px]", className)}
        >
          <Calendar className="size-5 text-slate-500 shrink-0" />
          <span className="flex-1 text-left truncate">
            {MODES.find(([m]) => m === value.mode)?.[1]}
          </span>
          <ChevronDown className="size-4 text-slate-500 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[180px]">
        {MODES.map(([mode, label]) => (
          <DropdownMenuItem
            key={mode}
            onClick={() => onChange({ ...value, mode })}
            className={value.mode === mode ? "bg-white/10 font-medium" : ""}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
      {/* Controles do modo ativo */}
      {value.mode === "month" && (
        // Régua de 12 meses (scrubber). O picker "Junho 2026" foi pra barra de
        // topo, ao lado dos chips de modo e de centros.
        <MonthSwitcher
          value={value.month}
          onChange={(month) => onChange({ ...value, month })}
          variant="chips"
          className="w-full"
        />
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
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 sm:w-auto">De</span>
            <MonthSwitcher
              value={value.custom.from}
              onChange={(from) =>
                onChange({
                  ...value,
                  custom: clampCustom(from, value.custom.to, "from"),
                })
              }
              variant="picker"
              className="flex-1 sm:w-[170px] sm:flex-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 sm:w-auto">até</span>
            <MonthSwitcher
              value={value.custom.to}
              onChange={(to) =>
                onChange({
                  ...value,
                  custom: clampCustom(value.custom.from, to, "to"),
                })
              }
              variant="picker"
              className="flex-1 sm:w-[170px] sm:flex-none"
            />
          </div>
          <span className="text-xs text-slate-400">máx. 12 meses</span>
        </div>
      )}
    </div>
  );
}
