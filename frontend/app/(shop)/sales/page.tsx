"use client";

import { CoinIcon } from "@river-apps/icons";
import { Button, Input, cn } from "@river-apps/ui";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomSheet } from "@/components/shop/bottom-sheet";
import { WeekTable } from "@/features/sales/week-table";
import { useMemo, useState } from "react";
import { RiverIcon } from "@/components/river-icon";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { api, type FinanceWeek, type Sale } from "@/lib/api";
import { peso, timePHT } from "@/lib/format";
import { useLoad } from "@/lib/use-load";

type Range = "today" | "d7" | "d30" | "month";
const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" }, { value: "d7", label: "7 days" }, { value: "d30", label: "30 days" }, { value: "month", label: "Month" },
];
const dayKey = (iso: string | number) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const METHOD: Record<string, string> = { cash: "Cash", gcash: "GCash", maya: "Maya", other: "Other" };

/** Sales (Barbers.ph SalesDataScreen look): Sales week calendar (sales / expenses / profit) and a Performance tab. */
export default function SalesPage() {
  return (
    <ShopPage title={<><CoinIcon size={28} /> Sales</>} back="/home" icon="coin" empty={{ title: "No sales yet", description: "Payments you record in the queue add up here." }}>
      {(s) => <SalesTabs shopId={s.id} />}
    </ShopPage>
  );
}


const toKey = (d: string) => d.replaceAll("-", "");
const fromKey = (k: string) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`;
const shortDate = (k: string) => new Date(`${fromKey(k)}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

function SalesTabs({ shopId }: { shopId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "performance" ? "performance" : "sales";
  const go = (t: "sales" | "performance") => router.replace(t === "sales" ? "/sales" : "/sales?tab=performance", { scroll: false });
  return (
    <>
      <div className="mt-3 grid grid-cols-2 rounded-pill bg-grey-100 p-1" role="tablist" aria-label="Sales views">
        {(["sales", "performance"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => go(t)}
            className={cn("h-10 rounded-pill text-[14px] font-bold", tab === t ? "bg-surface text-ink shadow-card" : "text-muted")}>{t === "sales" ? "Sales" : "Performance"}</button>
        ))}
      </div>
      {tab === "sales" ? <WeekView shopId={shopId} onPerformance={() => go("performance")} /> : <Performance shopId={shopId} />}
    </>
  );
}

type View = "all" | "salesCentavos" | "expensesCentavos" | "profitCentavos";
const VIEWS: { value: View; label: string }[] = [
  { value: "all", label: "All" }, { value: "salesCentavos", label: "Sales" }, { value: "expensesCentavos", label: "Expenses" }, { value: "profitCentavos", label: "Profit" },
];

function WeekView({ shopId, onPerformance }: { shopId: string; onPerformance: () => void }) {
  const [now] = useState(() => Date.now());
  const today = toKey(dayKey(now));
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<View>("all");
  const [adding, setAdding] = useState(false);
  const anchor = toKey(dayKey(now + offset * 7 * 86_400_000));
  const { data, error, reload } = useLoad(async () => (await api<{ data: FinanceWeek }>(`/businesses/${shopId}/finance/week?date=${anchor}`)).data, `finance-week-${shopId}-${anchor}`);

  async function remove(id: string) {
    await api(`/businesses/${shopId}/expenses/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" aria-label="Previous week" onClick={() => setOffset((o) => o - 1)} className="inline-flex size-9 items-center justify-center rounded-full bg-surface shadow-card"><ChevronLeft size={18} aria-hidden /></button>
        <b className="text-[15px] tabular-nums">{data ? `${shortDate(data.from)} – ${shortDate(data.to)}` : "This week"}{offset === 0 ? <span className="ml-1.5 text-[12.5px] font-semibold text-muted">· This week</span> : null}</b>
        <button type="button" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))} className="inline-flex size-9 items-center justify-center rounded-full bg-surface shadow-card disabled:opacity-40"><ChevronRight size={18} aria-hidden /></button>
      </div>
      {error && !data ? <p role="alert" className="mt-4 font-semibold">{error}</p> : null}
      {!data ? <LoadingBlock /> : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {([["Sales", data.totals.salesCentavos, ""], ["Expenses", data.totals.expensesCentavos, data.totals.expensesCentavos ? "text-[#C62828]" : ""], ["Profit", data.totals.profitCentavos, data.totals.profitCentavos < 0 ? "text-[#C62828]" : data.totals.profitCentavos > 0 ? "text-[#0B7A3E]" : ""]] as const).map(([k, v, tone]) => (
              <div key={k} className="min-w-0 rounded-card bg-surface px-3 pb-3 pt-3 shadow-card">
                <p className="text-[12.5px] font-semibold text-muted">{k}</p>
                <b className={cn("mt-0.5 block truncate text-[19px] font-extrabold tracking-[-0.02em] tabular-nums", tone)}>{v < 0 ? "-" : ""}{peso(Math.abs(v)) || "₱0"}</b>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-1" role="radiogroup" aria-label="Week view">
            {VIEWS.map((v) => (
              <button key={v.value} type="button" role="radio" aria-checked={view === v.value} onClick={() => setView(v.value)}
                className={cn("h-8 rounded-pill px-3 text-[12.5px] font-bold", view === v.value ? "bg-ink text-on-ink" : "bg-surface text-ink ring-1 ring-line")}>{v.label}</button>
            ))}
          </div>
          <div className="mt-3"><WeekTable week={data} today={today} only={view === "all" ? undefined : view} /></div>
          <p className="mt-2 px-1 text-[12px] font-semibold text-muted">Profit = sales − expenses · {data.totals.cars} {data.totals.cars === 1 ? "car" : "cars"} this week</p>

          <div className="mt-5 flex items-center justify-between px-1">
            <b className="text-[15px]">Expenses · {data.expenses.length}</b>
            <Button size="md" pill leadingIcon={<Plus size={16} aria-hidden />} onClick={() => setAdding(true)}>Add expense</Button>
          </div>
          {data.expenses.length === 0 ? (
            <div className="mt-2 rounded-card bg-grey-50 px-5 py-6 text-center ring-1 ring-line">
              <span className="flex justify-center"><CoinIcon size={44} /></span>
              <b className="mt-2 block text-[15px]">No expenses this week</b>
              <p className="mx-auto mt-0.5 max-w-[280px] text-[13px] font-medium text-muted">Add soap, water, wages and other costs to see your real profit.</p>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
              {data.expenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 leading-[1.3]">
                    <b className="block truncate text-[14.5px]">{e.note}</b>
                    <span className="block text-[12.5px] font-semibold text-muted">{shortDate(e.date)}</span>
                  </span>
                  <b className="flex-none text-[15px] tabular-nums text-[#C62828]">-{peso(e.amountCentavos)}</b>
                  <button type="button" aria-label={`Delete ${e.note}`} onClick={() => void remove(e.id)} className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-grey-100"><Trash2 size={16} aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <button type="button" onClick={onPerformance} className="mx-auto mt-6 block py-2 text-[14px] font-bold underline underline-offset-4">See performance</button>
      {adding ? <AddExpenseSheet shopId={shopId} today={today} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} /> : null}
    </>
  );
}

function AddExpenseSheet({ shopId, today, onClose, onSaved }: { shopId: string; today: string; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(fromKey(today));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const centavos = Math.round(Number(amount.replace(/[^\d.]/g, "")) * 100);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!(centavos > 0) || !note.trim()) return setErr("Enter an amount and what it was for.");
    setBusy(true);
    try {
      await api(`/businesses/${shopId}/expenses`, { method: "POST", body: { amountCentavos: centavos, note: note.trim(), date: toKey(date) } });
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }
  return (
    <BottomSheet title="Add expense" subtitle="Counts against this week's profit" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4 pb-2">
        <Input label="Amount (₱)" inputMode="decimal" placeholder="500" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="What for" placeholder="Soap, water, wages…" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
        <Input label="Date" type="date" max={fromKey(today)} value={date} onChange={(e) => setDate(e.target.value)} />
        {err ? <p role="alert" className="text-[13.5px] font-semibold text-[#C62828]">{err}</p> : null}
        <Button type="submit" fullWidth disabled={busy}>{busy ? "Saving…" : "Save expense"}</Button>
      </form>
    </BottomSheet>
  );
}

function Performance({ shopId }: { shopId: string }) {
  const [range, setRange] = useState<Range>("today");
  const [now] = useState(() => Date.now());
  const { data, error } = useLoad(async () => {
    const list = await api<{ data: Sale[] }>(`/businesses/${shopId}/sales?limit=200`);
    return { list: list.data };
  }, `sales-${shopId}`);

  const view = useMemo(() => {
    if (!data) return null;
    const today = dayKey(now);
    const since = range === "today" ? today : range === "d7" ? dayKey(now - 6 * 86_400_000) : range === "d30" ? dayKey(now - 29 * 86_400_000) : `${today.slice(0, 8)}01`;
    const rows = data.list.filter((s) => s.status === "recorded" && dayKey(s.paidAt) >= since);
    const total = rows.reduce((t, s) => t + s.amountCentavos, 0);
    const byMethod = Object.entries(rows.reduce<Record<string, number>>((m, s) => ({ ...m, [s.method]: (m[s.method] ?? 0) + s.amountCentavos }), {})).sort((a, b) => b[1] - a[1]);
    return { rows, total, byMethod };
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
      <Link href="/history" className="mt-6 block py-2 text-center text-[14px] font-bold underline underline-offset-4">See each wash in History</Link>
    </>
  );
}
