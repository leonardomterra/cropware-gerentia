import { useState } from "react";
import ChevronLeft from "~icons/ph/caret-left";
import ChevronRight from "~icons/ph/caret-right";
import ChevronDown from "~icons/ph/caret-down";
import Calendar from "~icons/ph/calendar-blank";
import { cn } from "@/components/ui/utils";
import {
  BOTAO_BARRA,
  ICONE_BOTAO_BARRA,
  SETA_BOTAO_BARRA,
  SUPERFICIE_ESCURA,
} from "@/lib/ui-tokens";
import { TOOLBAR_TRIGGER_CLASS } from "@/components/ui/toolbarTrigger";
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
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const MONTHS_FULL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
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
export function monthRangeISO({ year, month }: YearMonth): {
  from: string;
  to: string;
} {
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
  compact = false,
  variant = "full",
}: {
  value: YearMonth;
  onChange: (next: YearMonth) => void;
  className?: string;
  /** Modo enxuto (pra barras lotadas): 3 chips e seletor só com ícone. */
  compact?: boolean;
  /** "full" = chips + seletor; "chips" = só ◀ meses ▶; "picker" = só o 📅. */
  variant?: "full" | "chips" | "picker";
}) {
  const isMobile = useIsMobile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(value.year);
  const today = currentYearMonth();
  const isCurrentMonth = sameMonth(value, today);

  // Janela de chips centrada no selecionado (3 no compact/mobile, 5 no desktop).
  const half = compact || isMobile ? 1 : 2;
  const windowMonths: YearMonth[] = [];
  for (let i = -half; i <= half; i++) windowMonths.push(addMonths(value, i));

  const showChips = variant !== "picker";
  const showPicker = variant !== "chips";
  // Na variante "chips": os 12 meses do ano, esticados (tipo abas), sem setas e
  // sem recentralizar (posicao fixa). A troca de ANO fica no seletor 📅.
  // Nas outras variantes: janela centrada no mes selecionado, com setas.
  const stretch = variant === "chips";
  const chipMonths: YearMonth[] = stretch
    ? Array.from({ length: 12 }, (_, i) => ({ year: value.year, month: i + 1 }))
    : windowMonths;
  // No mobile a variante "chips" vira "◀ Mês de Ano ▶" (mês ativo centralizado,
  // setas nas laterais) em vez do strip esticado com os 12 meses.
  const mobileChips = stretch && isMobile;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {showChips && mobileChips && (
        <>
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => onChange(addMonths(value, -1))}
            className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex-1 min-w-0 text-center text-sm font-medium text-slate-700 capitalize">
            {MONTHS_FULL[value.month - 1]} {value.year}
          </div>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => onChange(addMonths(value, 1))}
            className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
      {showChips && !mobileChips && (
        <>
          {!stretch && (
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => onChange(addMonths(value, -1))}
              className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}

          <div className={cn("flex items-center gap-1", stretch && "flex-1")}>
            {chipMonths.map((m) => {
              const selected = sameMonth(m, value);
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  type="button"
                  onClick={() => onChange(m)}
                  className={cn(
                    // A borda existe nos DOIS estados — transparente no ativo. Só
                    // no inativo, ela mudaria a caixa em 1px de cada lado e os
                    // chips pulariam de lugar a cada troca de mês.
                    "h-9 rounded-md text-sm capitalize transition-colors border",
                    stretch ? "flex-1 min-w-0 px-1" : "px-3 whitespace-nowrap",
                    selected
                      ? // Mesmo vidro dos menus: o mês ativo é o único bloco
                        // pintado da faixa, e chapado ele puxava o olho mais que a
                        // própria lista. Sobre a área branca a transparência não
                        // TEM o que revelar — o efeito aqui é o bloco ficar mais
                        // leve, não translúcido de fato.
                        "bg-slate-900/65 backdrop-blur-sm text-white font-medium border-transparent"
                      : // Recuado, não ilegível: `slate-500` dá 4,74:1 no branco,
                        // acima do mínimo de 4,5. O `slate-400` que pareceria mais
                        // "apagado" cai pra 2,52:1 — e estes são alvos de clique,
                        // não decoração.
                        "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                  )}
                >
                  {MONTHS_SHORT[m.month - 1]}
                  {m.year !== value.year ? (
                    <span
                      className={cn(
                        "ml-1",
                        selected ? "opacity-70" : "opacity-60",
                      )}
                    >
                      '{String(m.year).slice(2)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {!stretch && (
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => onChange(addMonths(value, 1))}
              className="flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </>
      )}

      {showPicker && (
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
              className={cn(
                variant === "picker"
                  ? // Mesma família dos botões de Filtros e Ordenar: ele é um
                    // filtro, e estava com aparência de campo.
                    cn(BOTAO_BARRA, "inline-flex items-center rounded-md")
                  : cn(TOOLBAR_TRIGGER_CLASS, "ml-1 shrink-0 text-slate-600"),
              )}
            >
              {variant === "picker" ? (
                <>
                  <Calendar className={ICONE_BOTAO_BARRA} />
                  <span className="whitespace-nowrap capitalize">
                    {MONTHS_FULL[value.month - 1]} {value.year}
                  </span>
                  <ChevronDown className={SETA_BOTAO_BARRA} />
                </>
              ) : (
                <>
                  <Calendar className="size-4 text-slate-500 shrink-0" />
                  {!compact && (
                    <span className="hidden sm:inline whitespace-nowrap">
                      {MONTHS_FULL[value.month - 1]} {value.year}
                    </span>
                  )}
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(
              "min-w-[15rem] p-2",
              // Mesmo vidro dos outros painéis — era o único menu opaco que
              // sobrou depois da Etapa A.
              SUPERFICIE_ESCURA,
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                aria-label="Ano anterior"
                onClick={() => setPickerYear((y) => y - 1)}
                className="flex size-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-medium text-white">
                {pickerYear}
              </span>
              <button
                type="button"
                aria-label="Próximo ano"
                onClick={() => setPickerYear((y) => y + 1)}
                className="flex size-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS_SHORT.map((label, i) => {
                const selected =
                  value.year === pickerYear && value.month === i + 1;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      onChange({ year: pickerYear, month: i + 1 });
                      setPickerOpen(false);
                    }}
                    className={cn(
                      "h-9 rounded-lg text-sm capitalize transition-colors",
                      selected
                        ? "bg-white/10 text-white font-medium"
                        : "text-slate-100 hover:bg-white/10",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => {
                  onChange(today);
                  setPickerOpen(false);
                }}
                className="mt-2 w-full h-9 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors"
              >
                Ir para o mês atual
              </button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
