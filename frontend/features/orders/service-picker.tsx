"use client";

import { Icon3D } from "@river-apps/icons";
import { cn } from "@river-apps/ui";
import { Check } from "lucide-react";
import type { Service } from "@/lib/api";
import { peso } from "@/lib/format";

export const SIZES = [["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["xl", "XL"]] as const;

export const priceFor = (s: Service, size: string) => s.pricesBySize?.[size] ?? s.pricesBySize?.medium ?? 0;

/** Total and minutes for the picked services at a size (display only; the server computes the real price). */
export function orderTotals(services: Service[], picked: string[], size: string) {
  const chosen = services.filter((s) => picked.includes(s.id));
  return { chosen, total: chosen.reduce((t, s) => t + (priceFor(s, size) ?? 0), 0), mins: chosen.reduce((t, s) => t + (s.durationMins || 0), 0) };
}

/**
 * Pick one or more services from Settings > Services (Barbers.ph walk-in picker), with the car size
 * that sets each price. Used by the walk-in form and by Edit on order details.
 */
export function ServicePicker({ services, picked, onPick, size, onSize }: { services: Service[]; picked: string[]; onPick: (ids: string[]) => void; size: string; onSize: (s: string) => void }) {
  const active = services.filter((s) => s.active !== false);
  const { total, mins, chosen } = orderTotals(active, picked, size);
  return (
    <div>
      <p className="text-[13px] font-bold">Car size</p>
      <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Car size">
        {SIZES.map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={size === k} onClick={() => onSize(k)} className={cn("h-11 rounded-[14px] text-[14px] font-bold", size === k ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200")}>
            {label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-[13px] font-bold">Services</p>
      <div className="mt-2 flex flex-col gap-2" data-testid="service-picker">
        {active.map((s, i) => {
          const on = picked.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(on ? picked.filter((id) => id !== s.id) : [...picked, s.id])}
              className={cn("flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-left", on ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200")}
            >
              <Icon3D name={i === 0 ? "bubbles" : "sparkle"} size={40} />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{s.name}</b>
                <small className={cn("text-[12.5px] font-semibold", on ? "text-on-ink/70" : "text-muted")}>{s.durationMins} min</small>
              </span>
              <span className="text-[14px] font-bold">{priceFor(s, size) ? peso(priceFor(s, size)!) : "—"}</span>
              <span aria-hidden className={cn("inline-flex size-6 flex-none items-center justify-center rounded-full", on ? "bg-on-ink text-ink" : "ring-1 ring-grey-300")}>{on ? <Check size={15} strokeWidth={3} /> : null}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-baseline justify-between rounded-[14px] bg-grey-100 px-3.5 py-2.5">
        <span className="text-[13px] font-semibold text-muted">{chosen.length ? `${chosen.length} service${chosen.length > 1 ? "s" : ""} · ${mins} min` : "Pick at least one service"}</span>
        <b className="text-[18px] tracking-[-0.02em]">{peso(total)}</b>
      </div>
    </div>
  );
}
