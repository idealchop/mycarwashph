"use client";

import { cn } from "@river-apps/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SalesSummary } from "@/lib/api";
import { peso } from "@/lib/format";

const RED = "#C62828";
const GREEN = "#0B7A3E";
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function compactPeso(centavos: number) {
  const n = centavos / 100;
  const a = Math.abs(n);
  if (a >= 1_000_000) return `₱${+(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `₱${+(n / 1_000).toFixed(1)}k`;
  return `₱${Math.round(n)}`;
}
const keyOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).replaceAll("-", "");
const short = (key: string) => new Date(`${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Fallback Mon–Sun week (no data yet, or a guest). */
function emptyWeek(today: string): NonNullable<SalesSummary["week"]> {
  const noon = new Date(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T12:00:00+08:00`).getTime();
  const dow = new Date(noon).getUTCDay();
  const monday = noon - ((dow + 6) % 7) * 86_400_000;
  const days = DOW.map((d, i) => ({ date: keyOf(new Date(monday + i * 86_400_000)), dow: d, centavos: 0, cars: 0 }));
  return { from: days[0]!.date, to: days[6]!.date, totalCentavos: 0, cars: 0, days };
}

/**
 * Home "Your weekly sales" (Barbers.ph ProfitReportCard layout): week total, Mon–Sun cells with today ringed,
 * and a footer for today's unpaid cars (red) or all paid (green). The whole card opens Sales.
 */
export function WeeklySalesCard({ summary, unpaid, loading, className = "" }: { summary: SalesSummary | null; unpaid: number; loading?: boolean; className?: string }) {
  const today = keyOf(new Date());
  const week = summary?.week ?? emptyWeek(today);
  return (
    <Link href="/sales" aria-label="Open sales" className={`block rounded-card bg-surface px-4 pb-3.5 pt-4 shadow-card active:scale-[0.99] ${className}`}>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[13px] font-bold text-muted">Your weekly sales<ChevronRight size={15} strokeWidth={2.4} aria-hidden className="text-subtle" /></span>
          {loading ? <span className="skeleton mt-1 block h-7 w-28 rounded-[8px]" /> : <b className="mt-1 block text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{peso(week.totalCentavos) || "₱0"}</b>}
        </span>
        <span className="mt-0.5 flex-none text-right">
          <span className="block text-[12px] font-semibold text-muted">{short(week.from)} – {short(week.to)}</span>
          <span className="mt-1 block text-[11.5px] font-semibold text-muted">{week.cars} car{week.cars === 1 ? "" : "s"}</span>
        </span>
      </span>
      <span className="mt-3.5 grid grid-cols-7 gap-1" aria-hidden>
        {week.days.map((d) => {
          const isToday = d.date === today, future = d.date > today;
          const red = isToday && unpaid > 0;
          return (
            <span key={d.date} className={cn("flex h-[58px] min-w-0 flex-col items-center justify-center rounded-[12px] bg-grey-50", isToday && "ring-[1.5px] ring-inset ring-ink")}>
              <span className={cn("text-[11px] font-bold", isToday ? "text-ink" : "text-muted")}>{isToday ? "Today" : d.dow}</span>
              <span className={cn("mt-1 whitespace-nowrap text-[13.5px] font-extrabold leading-none tabular-nums", future || !d.centavos ? "text-muted opacity-50" : "text-ink")} style={red && d.centavos ? { color: RED } : undefined}>
                {future || !d.centavos ? "–" : compactPeso(d.centavos)}
              </span>
            </span>
          );
        })}
      </span>
      <span className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[12.5px] font-semibold">
        {loading ? <span className="text-muted">Checking today’s cars…</span> : unpaid > 0
          ? <span className="flex items-center gap-1.5" style={{ color: RED }}><i className="size-1.5 rounded-full" style={{ background: RED }} />{peso(unpaid)} unpaid today</span>
          : <span className="flex items-center gap-1.5" style={{ color: GREEN }}><i className="size-1.5 rounded-full" style={{ background: GREEN }} />All cars paid</span>}
        <span className="flex items-center gap-2.5 text-[11px]">
          <span className="flex items-center gap-1"><i className="size-1.5 rounded-full" style={{ background: GREEN }} /><span style={{ color: GREEN }}>Paid</span></span>
          <span className="flex items-center gap-1"><i className="size-1.5 rounded-full" style={{ background: RED }} /><span style={{ color: RED }}>Unpaid</span></span>
        </span>
      </span>
    </Link>
  );
}
