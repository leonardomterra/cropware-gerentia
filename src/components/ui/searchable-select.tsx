import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
import { cn } from "@/components/ui/utils";

/**
 * Item de SearchableSelect. `group` (opcional) agrupa visualmente os
 * items no dropdown - padrão CDM ComboBox. `value` é o que volta no
 * onValueChange.
 */
export interface SearchableOption {
  value: string;
  label: string;
  group?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
}

/**
 * Select com busca interna (cmdk) - padrão CDM ComboBox. Single-select
 * por ora; multiselect virá numa próxima iteração quando o filter
 * receiver aceitar array (precisa mudar gerentia-api edge function).
 *
 * Layout do dropdown:
 * - Input de busca no topo (CommandInput)
 * - Lista filtrada (CommandList + CommandItem)
 * - Items podem ter `group` -> renderiza CommandGroup com label
 * - Estado vazio: CommandEmpty
 *
 * O trigger renderiza o label do item selecionado ou o placeholder.
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado.",
  triggerClassName,
  contentClassName,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  // Fecha o popup ao scrollar o main (idem MultiSearchableSelect).
  useEffect(() => {
    if (!open) return;
    const main = document.querySelector("[data-app-scroll-container]");
    if (!main) return;
    const onScroll = () => setOpen(false);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  // Agrupa preservando ordem (options ja vem ordenado).
  const groups: { name: string | undefined; items: SearchableOption[] }[] = [];
  for (const opt of options) {
    const last = groups[groups.length - 1];
    if (last && last.name === opt.group) last.items.push(opt);
    else groups.push({ name: opt.group, items: [opt] });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-9 w-full inline-flex items-center justify-between gap-2 rounded border border-slate-100 bg-white px-3 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300",
            triggerClassName,
          )}
        >
          <span
            className={cn(
              "truncate text-left flex-1",
              !selected && "text-slate-500",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        avoidCollisions={false}
        className={cn(
          "p-0 w-[var(--radix-popover-trigger-width)] min-w-[220px]",
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
                {g.items.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.value}`}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0 text-slate-500",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
