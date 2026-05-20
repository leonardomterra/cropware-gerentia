"use client";

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "./utils"
import { Button } from "./button"
import { Badge } from "./badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"

export interface MultiSelectOption {
  value: string;
  label: string;
  richLabel?: React.ReactNode;
  badgeLabel?: React.ReactNode;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecionar...",
  emptyMessage = "Nenhum resultado encontrado",
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const safeOptions = options || [];
  const safeSelected = selected || [];

  const handleSelect = (value: string) => {
    const newSelected = safeSelected.includes(value)
      ? safeSelected.filter((item) => item !== value)
      : [...safeSelected, value];
    onChange(newSelected);
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(safeSelected.filter((item) => item !== value));
  };

  const selectedOptions = safeSelected
    .map((value) => safeOptions.find((opt) => opt.value === value))
    .filter((opt): opt is MultiSelectOption => !!opt);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-[2.3rem] px-3 py-2 bg-white border border-slate-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] hover:bg-white text-sm font-normal", className)}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground text-sm font-normal">{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <Badge key={option.value} variant="secondary" className="mr-1 mb-1 text-sm py-0.5 px-2" >
                  {option.badgeLabel || option.label}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 inline-flex cursor-pointer"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRemove(option.value, e as any);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => handleRemove(option.value, e)}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {safeOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded border shadow-sm transition-all",
                      safeSelected.includes(option.value)
                        ? "bg-white border-black text-[#3b9f73]"
                        : "opacity-50 [&_svg]:invisible border-slate-300 bg-white"
                    )}
                  >
                    <Check className={cn("h-3.5 w-3.5")} strokeWidth={3} />
                  </div>
                  <span>{option.richLabel || option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}