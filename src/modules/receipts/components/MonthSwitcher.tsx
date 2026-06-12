import { useState } from "react";
import ChevronLeft from "~icons/material-symbols-light/chevron-left";
import ChevronRight from "~icons/material-symbols-light/chevron-right";
import Calendar from "~icons/material-symbols-light/calendar-month-outline";
import { cn } from "@/components/ui/utils";
import { useIsMobile } from "@/components/ui/use-mobile";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function currentYearMonth(): YearMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** "Junho de 2026" */
export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTHS_FULL[month - 1]} de ${year}`;
}

/** Primeiro/último dia do mês em ISO YYYY-MM-DD (sem timezone). */
export function monthRangeISO({ year, month }: YearMonth): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function sameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * Navegação de mês (acima da tabela de lançamentos). Mostra o mês atual e os
 * vizinhos como chips (3 no mobile, 5 no desktop), com setas pra andar e um
 * seletor (popover com grade de meses + ano) pra pular pra qualquer período.
 * O agrupamento é por transaction_date (definido pelo caller via from/to).
 */
export function MonthSwitcher({
  value,
  onChange,
  className,
}: {
  value: YearMonth;
  onChange: (next: YearMonth) => void;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(value.year);

  // Janela de chips centrada no selecionado.
  const half = isMobile ? 1 : 2;
  const windowMonths: YearMonth[] = [];
  for (let i = -half; i <= half; i++) windowMonths.push(addMonths(value, i));

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => onChange(addMonths(value, -1))}
        className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
      >
        <ChevronLeft className="size-5" />
      </button>

      <div className="flex items-center gap-1">
        {windowMonths.map((m) => {
          const selected = sameMonth(m, value);
          return (
            <button
              key={`${m.year}-${m.month}`}
              type="button"
              onClick={() => onChange(m)}
              className={cn(
                "h-9 px-3 rounded-md text-sm capitalize whitespace-nowrap transition-colors",
                selected
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {MONTHS_SHORT[m.month - 1]}
              {m.year !== value.year ? (
                <span className={cn("ml-1", selected ? "opacity-70" : "text-slate-400")}>
                  '{String(m.year).slice(2)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => onChange(addMonths(value, 1))}
        className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
      >
        <ChevronRight className="size-5" />
      </button>

      <Popover
        open={pickerOpen}
        onOpenChange={(open) => {
          if (open) setPickerYear(value.year);
          setPickerOpen(open);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Escolher mês"
            className="ml-1 h-9 inline-flex items-center gap-1.5 px-3 rounded-md text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
          >
            <Calendar className="size-4 text-slate-500" />
            <span className="hidden sm:inline whitespace-nowrap">
              {MONTHS_FULL[value.month - 1]} {value.year}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              aria-label="Ano anterior"
              onClick={() => setPickerYear((y) => y - 1)}
              className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-slate-900">{pickerYear}</span>
            <button
              type="button"
              aria-label="Próximo ano"
              onClick={() => setPickerYear((y) => y + 1)}
              className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS_SHORT.map((label, i) => {
              const selected = value.year === pickerYear && value.month === i + 1;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onChange({ year: pickerYear, month: i + 1 });
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "h-9 rounded-md text-sm capitalize transition-colors",
                    selected
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
