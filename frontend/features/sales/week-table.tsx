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
export function cellPeso(c: number, sign = "₱") {
  if (!c) return "–";
  const v = Math.abs(c) / 100;
  const s = v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(Math.round(v));
  return `${c < 0 ? "-" : ""}${sign}${s}`;
}

/** Week calendar like a staff week table: Mon–Sun columns + Total, rows Sales / Expenses / Profit. */
export function WeekTable({ week, today, only }: { week: FinanceWeek; today: string; only?: Key }) {
  const rows = only ? ROWS.filter((r) => r.key === only) : ROWS;
  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card">
      <table className="w-full table-fixed border-collapse whitespace-nowrap text-[11.5px] tabular-nums">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="sticky left-0 w-[66px] bg-surface py-2.5 pl-3 text-left font-bold text-muted">₱ / day</th>
            {week.days.map((d) => (
              <th key={d.date} scope="col" className={cn("px-0 py-2.5 text-center font-bold", d.date === today ? "text-ink" : "text-muted")}>
                <span className={cn("inline-block rounded-pill px-1 py-0.5", d.date === today && "bg-ink text-on-ink")}>{d.dow.slice(0, 2)}</span>
              </th>
            ))}
            <th scope="col" className="w-[52px] py-2.5 pr-3 text-right font-extrabold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const total = week.totals[r.key];
            return (
              <tr key={r.key}>
                <th scope="row" className="sticky left-0 bg-surface py-3 pl-3 text-left text-[12px] font-bold">{r.label}</th>
                {week.days.map((d) => {
                  const v = d[r.key];
                  return (
                    <td key={d.date} className={cn("px-0 py-3 text-center font-semibold", !v && "text-subtle", r.key === "profitCentavos" && v < 0 && "text-[#C62828]", r.key === "expensesCentavos" && v > 0 && "text-[#C62828]")}>
                      {cellPeso(v, "")}
                    </td>
                  );
                })}
                <td className={cn("py-3 pr-3 text-right font-extrabold", r.key === "profitCentavos" && (total < 0 ? "text-[#C62828]" : total > 0 && "text-[#0B7A3E]"))}>{cellPeso(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
