"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "./utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Checkbox({
  className,
  checked,
  onCheckedChange,
  onChange,
  ...props
}: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onCheckedChange?.(e.target.checked);
  };

  return (
    <label className="relative inline-flex items-center justify-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={handleChange}
        {...props}
      />
      <div
        data-state={checked ? "checked" : "unchecked"}
        style={props.style}
        className={cn(
          "size-4 shrink-0 rounded border shadow-sm transition-all cursor-pointer flex items-center justify-center",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-green-500/50 peer-focus-visible:border-green-500",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          "bg-white border-slate-300",
          "peer-checked:bg-slate-600 peer-checked:border-slate-600 peer-checked:text-white",
          checked && "bg-slate-600 border-slate-600 text-white",
          "peer-aria-invalid:ring-destructive/20 peer-aria-invalid:border-destructive",
          className
        )}
      >
        {checked && (
          <Check className="size-3.5" strokeWidth={3} />
        )}
      </div>
    </label>
  );
}

export { Checkbox };
