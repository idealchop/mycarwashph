"use client";
import { cn } from "../cn";

export interface DateStripItem {
  /** Stable key, e.g. an ISO date. */
  key: string;
  weekday: string;
  day: string | number;
  /** Number of events that day; shows up to 3 dots. */
  count?: number;
  /** Accessible label, e.g. "Saturday 3 October, 4 bookings". */
  ariaLabel?: string;
}

export interface DateStripProps {
  items: DateStripItem[];
  /** Key of the selected (black) tile, usually today. */
  selectedKey?: string;
  onSelect?: (key: string) => void;
  className?: string;
  label?: string;
}

/** A row of rounded day tiles. The selected day is solid black; others are white. */
export function DateStrip({ items, selectedKey, onSelect, className, label = "Choose a day" }: DateStripProps) {
  return (
    <div role="group" aria-label={label} className={cn("flex gap-2", className)}>
      {items.map((d) => {
        const on = d.key === selectedKey;
        return (
          <button
            key={d.key}
            type="button"
            aria-pressed={on}
            aria-label={d.ariaLabel}
            onClick={() => onSelect?.(d.key)}
            className={cn(
              "flex h-[74px] min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-panel transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              on ? "bg-ink text-on-ink shadow-raised" : "bg-surface text-ink shadow-tile hover:bg-grey-50",
            )}
          >
            <small className={cn("text-[12px] font-semibold", on ? "text-on-ink-muted" : "text-ink/55")}>{d.weekday}</small>
            <b className="text-[20px] font-extrabold leading-[1.1]">{d.day}</b>
            <span aria-hidden className="mt-1 flex h-1 gap-[3px]">
              {Array.from({ length: Math.min(d.count ?? 0, 3) }).map((_, i) => (
                <i key={i} className={cn("block size-1 rounded-full", on ? "bg-on-ink" : "bg-ink/35")} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
