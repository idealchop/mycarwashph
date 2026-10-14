"use client";

import { Card, cn } from "@river-apps/ui";
import { peso } from "@/lib/format";

export type SalesRow = { label: string; salesCentavos: number };

/** The hour bars from Sales, with the busiest bar in black (Barbers.ph SalesChartCard). */
export function SalesChartCard({ series, sales, className }: { series: SalesRow[]; sales: number; className?: string }) {
  const peak = series.reduce(
    (best, item, index) => (item.salesCentavos > best.sales ? { index, sales: item.salesCentavos, label: item.label } : best),
    { index: -1, sales: 0, label: "" },
  );
  const max = Math.max(1, ...series.map((s) => s.salesCentavos));
  return (
    <Card padding="none" className={cn("px-4 py-4", className)}>
      <h2 className="text-[16px] font-bold">Sales by hour</h2>
      <p className="mt-0.5 text-[12.5px] font-semibold text-muted">
        {peak.sales > 0 ? `Busiest at ${peak.label} · ${peso(peak.sales)}` : "No sales in this range yet."}
      </p>
      {series.length > 0 && sales > 0 ? (
        <div className="mt-4 flex h-40 items-end gap-[3px]" role="img" aria-label={series.map((s) => `${s.label} ${peso(s.salesCentavos)}`).join(", ")}>
          {series.map((item, index) => {
            const on = index === peak.index && item.salesCentavos > 0;
            const height = item.salesCentavos <= 0 ? 8 : Math.max(14, Math.round((item.salesCentavos / max) * 100));
            return (
              <div key={`${item.label}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${item.label} · ${peso(item.salesCentavos)}`}>
                <div className="flex min-h-0 flex-1 items-end">
                  <div className={cn("w-full rounded-t-[8px]", on ? "bg-ink" : "bg-grey-200")} style={{ height: `${height}%` }} />
                </div>
                <span className={cn("mt-2 h-3 truncate text-center text-[10px] leading-none", on ? "font-extrabold text-ink" : "font-semibold text-grey-400")}>
                  {item.label.replace(/:00/, "").replace(" AM", "a").replace(" PM", "p")}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[13.5px] font-semibold text-muted">Finished washes from this shop show up here.</p>
      )}
    </Card>
  );
}
