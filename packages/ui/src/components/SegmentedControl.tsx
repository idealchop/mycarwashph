"use client";
import { useState } from "react";
import { cn } from "../cn";

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  label: string;
  className?: string;
}

/** Small grey segmented switch (e.g. Today / Week). */
export function SegmentedControl<T extends string>({ options, value, defaultValue, onChange, label, className }: SegmentedControlProps<T>) {
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-[12px] bg-grey-100 p-[3px]", className)}>
      {options.map((o) => {
        const on = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => { setInner(o.value); onChange?.(o.value); }}
            className={cn(
              "rounded-[9px] px-3 py-[5px] text-[12.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-ink",
              on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,.1)]" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
