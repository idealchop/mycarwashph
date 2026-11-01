"use client";

import { cn } from "@river-apps/ui";
import type { FinanceWeek } from "@/lib/api";

type Key = "salesCentavos" | "expensesCentavos" | "profitCentavos";
const ROWS: { key: Key; label: string }[] = [
  { key: "salesCentavos", label: "Sales" },
  { key: "expensesCentavos", label: "Expenses" },
  { key: "profitCentavos", label: "Profit" },
];

/** Compact peso for a narrow cell: ₱850, ₱1.2k, -₱300; a dash for zero. */
export function cellPeso(c: number) {
  if (!c) return "–";
  const v = Math.abs(c) / 100;
  const s = v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(Math.round(v));
  return `${c < 0 ? "-" : ""}₱${s}`;
}

/** Week calendar like a staff week table: Mon–Sun columns + Total, rows Sales / Expenses / Profit. */
export function WeekTable({ week, today, only }: { week: FinanceWeek; today: string; only?: Key }) {
  const rows = only ? ROWS.filter((r) => r.key === only) : ROWS;
  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card">
      <table className="w-full min-w-[360px] border-collapse text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="sticky left-0 bg-surface px-3 py-2.5 text-left font-bold text-muted">Week</th>
            {week.days.map((d) => (
              <th key={d.date} scope="col" className={cn("px-1 py-2.5 text-center font-bold", d.date === today ? "text-ink" : "text-muted")}>
                <span className={cn("inline-block rounded-pill px-1.5 py-0.5", d.date === today && "bg-ink text-on-ink")}>{d.dow}</span>
              </th>
            ))}
            <th scope="col" className="px-2 py-2.5 text-right font-extrabold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const total = week.totals[r.key];
            return (
              <tr key={r.key}>
                <th scope="row" className="sticky left-0 bg-surface px-3 py-3 text-left text-[12.5px] font-bold">{r.label}</th>
                {week.days.map((d) => {
                  const v = d[r.key];
                  return (
                    <td key={d.date} className={cn("px-1 py-3 text-center font-semibold", !v && "text-subtle", r.key === "profitCentavos" && v < 0 && "text-[#C62828]", r.key === "expensesCentavos" && v > 0 && "text-[#C62828]")}>
                      {cellPeso(v)}
                    </td>
                  );
                })}
                <td className={cn("px-2 py-3 text-right font-extrabold", r.key === "profitCentavos" && (total < 0 ? "text-[#C62828]" : total > 0 && "text-[#0B7A3E]"))}>{cellPeso(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
