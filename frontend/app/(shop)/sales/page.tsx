"use client";

import { CoinIcon } from "@river-apps/icons";
import { Button, cn } from "@river-apps/ui";
import { useMemo, useState } from "react";
import { RiverIcon } from "@/components/river-icon";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { SalesChartCard, type SalesRow } from "@/features/sales/sales-chart";
import { api, type Sale, type SalesSummary } from "@/lib/api";
import { peso, timePHT } from "@/lib/format";
import { useLoad } from "@/lib/use-load";

type Range = "today" | "d7" | "d30" | "month";
const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" }, { value: "d7", label: "7 days" }, { value: "d30", label: "30 days" }, { value: "month", label: "Month" },
];
const dayKey = (iso: string | number) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const METHOD: Record<string, string> = { cash: "Cash", gcash: "GCash", maya: "Maya", other: "Other" };

/** Sales (Barbers.ph SalesDataScreen look): coin title, range chips, totals + chart card, records, History link. */
export default function SalesPage() {
  return (
    <ShopPage title={<><CoinIcon size={28} /> Sales</>} back="/home" icon="coin" empty={{ title: "No sales yet", description: "Payments you record in the queue add up here." }}>
      {(s) => <SalesData shopId={s.id} />}
    </ShopPage>
  );
}

function SalesData({ shopId }: { shopId: string }) {
  const [range, setRange] = useState<Range>("today");
  const [now] = useState(() => Date.now());
  const { data, error } = useLoad(async () => {
    const [summary, list] = await Promise.all([
      api<{ data: SalesSummary }>(`/businesses/${shopId}/sales/summary`),
      api<{ data: Sale[] }>(`/businesses/${shopId}/sales?limit=200`),
    ]);
    return { summary: summary.data, list: list.data };
  }, `sales-${shopId}`);

  const view = useMemo(() => {
    if (!data) return null;
    const today = dayKey(now);
    const since = range === "today" ? today : range === "d7" ? dayKey(now - 6 * 86_400_000) : range === "d30" ? dayKey(now - 29 * 86_400_000) : `${today.slice(0, 8)}01`;
    const rows = data.list.filter((s) => s.status === "recorded" && dayKey(s.paidAt) >= since);
    const total = rows.reduce((t, s) => t + s.amountCentavos, 0);
    let series: SalesRow[];
    if (range === "today") series = data.summary.byHour.map((h) => ({ label: h.label, salesCentavos: h.centavos }));
    else {
      const days = new Map<string, number>();
      for (let t = Date.parse(`${since}T12:00:00+08:00`); dayKey(t) <= today; t += 86_400_000) days.set(dayKey(t), 0);
      for (const s of rows) days.set(dayKey(s.paidAt), (days.get(dayKey(s.paidAt)) ?? 0) + s.amountCentavos);
      series = [...days].map(([k, v]) => ({ label: range === "d7" ? new Date(`${k}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short" }) : String(Number(k.slice(8))), salesCentavos: v }));
    }
    const byMethod = Object.entries(rows.reduce<Record<string, number>>((m, s) => ({ ...m, [s.method]: (m[s.method] ?? 0) + s.amountCentavos }), {})).sort((a, b) => b[1] - a[1]);
    return { rows, total, series, byMethod };
  }, [data, range, now]);

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-1" role="radiogroup" aria-label="Date range">
        {RANGES.map((r) => (
          <button key={r.value} type="button" role="radio" aria-checked={range === r.value} onClick={() => setRange(r.value)}
            className={cn("h-8 rounded-pill px-3 text-[12.5px] font-bold", range === r.value ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{r.label}</button>
        ))}
      </div>
      {error && !data ? <p role="alert" className="mt-4 font-semibold">{error}</p> : null}
      {!view ? <LoadingBlock /> : view.rows.length === 0 ? (
        <div className="mt-4 rounded-card bg-surface px-5 py-8 text-center shadow-card">
          <RiverIcon name="carwash" size={64} className="mx-auto block" />
          <b className="mt-3 block text-[17px] tracking-[-0.01em]">No sales in this range yet</b>
          <p className="mx-auto mt-1 max-w-[300px] text-[13.5px] font-medium text-muted">Record payments on finished cars in the queue and your sales show up here: busiest hours, days and how customers pay.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[["Sales", peso(view.total) || "₱0"], ["Cars", String(view.rows.length)], ["Average", peso(Math.round(view.total / view.rows.length)) || "₱0"]].map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-card bg-surface px-3 pb-3 pt-3 shadow-card">
                <p className="text-[12.5px] font-semibold text-muted">{k}</p>
                <b className="mt-0.5 block truncate text-[19px] font-extrabold tracking-[-0.02em] tabular-nums">{v}</b>
              </div>
            ))}
          </div>
          <SalesChartCard className="mt-3" series={view.series} sales={view.total} />
          <div className="mt-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
            <b className="block text-[15px]">How customers paid</b>
            <ul className="mt-2 flex flex-col gap-1.5">
              {view.byMethod.map(([m, c]) => (
                <li key={m} className="flex items-center justify-between text-[13.5px] font-semibold"><span className="text-muted">{METHOD[m] ?? m}</span><b className="tabular-nums">{peso(c)}</b></li>
              ))}
            </ul>
          </div>
          <p className="mt-5 px-1 text-[13px] font-bold text-muted">Payments · {view.rows.length}</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
            {view.rows.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 leading-[1.3]">
                  <b className="block truncate text-[14.5px]">{s.customerName || "Walk-in"}</b>
                  <span className="block truncate text-[12.5px] font-semibold text-muted">{METHOD[s.method] ?? s.method}{s.paymentRef ? ` · ${s.paymentRef}` : ""} · {range === "today" ? timePHT(s.paidAt) : new Date(s.paidAt).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}</span>
                </span>
                <b className="flex-none text-[15px] tabular-nums">{peso(s.amountCentavos)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      <Button className="mt-6" variant="secondary" fullWidth href="/history">See each wash in History</Button>
    </>
  );
}
