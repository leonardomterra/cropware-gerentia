import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/ui/utils";
import type { SearchableOption } from "./searchable-select";

interface MultiSearchableSelectProps {
  options: SearchableOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Mensagem no trigger quando há >1 item selecionado. Recebe o count. */
  multiLabel?: (count: number) => string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
}

/**
 * Multi-select com busca interna (cmdk) - padrão CDM ComboBox multi.
 * Trigger mostra:
 *   - placeholder quando vazio
 *   - label do unico item quando count === 1
 *   - "N selecionados" quando count > 1
 *
 * Items podem ter `group` -> renderiza CommandGroup com label visual.
 * Cada item tem Checkbox controlada à esquerda. Click no item toggle.
 * Popover não fecha ao selecionar (multi-pick UX).
 */
export function MultiSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado.",
  multiLabel = (n) => `${n} selecionados`,
  triggerClassName,
  contentClassName,
  disabled = false,
}: MultiSearchableSelectProps) {
  const [open, setOpen] = useState(false);

  // Fecha o popup ao scrollar o main. Radix Floating UI nao re-ancora
  // sempre direito quando o trigger sai da viewport por scroll de um
  // container interno (nosso <main> em vez do body) - sem isso, o popup
  // "boia" no topo da viewport descolado do trigger.
  useEffect(() => {
    if (!open) return;
    const main = document.querySelector("[data-app-scroll-container]");
    if (!main) return;
    const onScroll = () => setOpen(false);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [open]);

  const selectedSet = new Set(value);
  const singleSelected =
    value.length === 1
      ? options.find((o) => o.value === value[0])
      : undefined;

  // Agrupa preservando ordem.
  const groups: { name: string | undefined; items: SearchableOption[] }[] = [];
  for (const opt of options) {
    const last = groups[groups.length - 1];
    if (last && last.name === opt.group) last.items.push(opt);
    else groups.push({ name: opt.group, items: [opt] });
  }

  const toggle = (v: string) => {
    if (selectedSet.has(v)) onValueChange(value.filter((x) => x !== v));
    else onValueChange([...value, v]);
  };

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? singleSelected?.label ?? placeholder
        : multiLabel(value.length);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-9 w-full inline-flex items-center justify-between gap-2 rounded border border-slate-100 bg-white px-3 text-sm text-slate-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300",
            triggerClassName,
          )}
        >
          <span className="truncate text-left flex-1">{triggerLabel}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        avoidCollisions={false}
        className={cn(
          "p-0 w-[var(--radix-popover-trigger-width)] min-w-[240px]",
          contentClassName,
        )}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {groups.map((g, gi) => (
              <CommandGroup
                key={`${g.name ?? "__"}-${gi}`}
                heading={g.name}
                className={
                  g.name
                    ? "[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                    : undefined
                }
              >
                {g.items.map((opt) => {
                  const checked = selectedSet.has(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      value={`${opt.label} ${opt.value}`}
                      onSelect={() => toggle(opt.value)}
                      className="gap-2"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(opt.value)}
                        aria-label={`Selecionar ${opt.label}`}
                        className="pointer-events-none"
                      />
                      <span className="truncate flex-1">{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
