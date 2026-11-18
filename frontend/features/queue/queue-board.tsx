"use client";

import { OrderDetails, type OrderRef } from "@/features/orders/order-details";
import { Art, RiverIcon, type CarwashIcon } from "@/components/river-icon";
import { ChevronRight, Clock, Plus } from "lucide-react";
import { Button, Card, EmptyState, Input, SearchInput, cn } from "@river-apps/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageBack } from "@/components/shop/page-back";
import { peso } from "@/lib/format";
import { useShop } from "@/lib/shop-context";
import { useWalkInAllowance } from "@/lib/walkin-limit";
import { WalkInLimitCard } from "./walkin-limit-card";
import { acceptJob, declineJob, doneJob, figures, payJob, startJob, useToday, type Job } from "@/lib/today";


const STATUS: Record<Job["status"], string> = {
  requested: "New", accepted: "Waiting", in_bay: "In bay", done: "Done", paid: "Paid", declined: "Declined",
};

function matches(row: Job, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [row.ref, row.who, row.serviceName].some((v) => v.toLowerCase().includes(t));
}

function Actions({ row, freeBay, noBays, onAct, onPay }: { row: Job; freeBay: { id: string; name: string } | null; noBays?: boolean; onAct: (fn: (shopId: string) => Promise<void>, full?: string) => void; onPay: (row: Job) => void; onOpen: (row: Job) => void }) {
  const line = "mt-3 flex gap-2 border-t border-dashed border-[#E8E8EC] pt-3";
  if (row.status === "requested") {
    return (
      <div className={line}>
        <Button size="sm" variant="secondary" className="flex-1" data-auth="action" onClick={() => onAct((id) => declineJob(id, row))}>Decline</Button>
        <Button size="sm" className="flex-1" data-auth="action" onClick={() => onAct((id) => acceptJob(id, row))}>Accept</Button>
      </div>
    );
  }
  if (row.status === "accepted" && row.kind === "booking") {
    return <div className={line}><Button size="sm" fullWidth href="/scan">Scan when they arrive</Button></div>;
  }
  if (row.status === "accepted" && row.kind === "queue") {
    return (
      <div className={line}>
        <Button size="sm" fullWidth data-auth="action" onClick={() => freeBay ? onAct((id) => startJob(id, row, freeBay.id)) : noBays ? onAct((id) => startJob(id, row, null)) : onAct(async () => undefined, "Every bay is taken, or none have been added yet.")}>
          {freeBay ? `Start in ${freeBay.name}` : "Start"}
        </Button>
      </div>
    );
  }
  if (row.status === "in_bay") {
    return <div className={line}><Button size="sm" fullWidth data-auth="action" onClick={() => onAct((id) => doneJob(id, row))}>Done</Button></div>;
  }
  if (row.status === "done" && row.kind === "queue" && !row.paid) {
    return <div className={line}><Button size="sm" fullWidth data-auth="action" onClick={() => onPay(row)}>Record pay</Button></div>;
  }
  return null;
}

function Row({ row, onOpen, ...rest }: { row: Job; freeBay: { id: string; name: string } | null; noBays?: boolean; onAct: (fn: (shopId: string) => Promise<void>, full?: string) => void; onPay: (row: Job) => void; onOpen: (row: Job) => void }) {
  const where = row.status === "in_bay" && row.bayName ? row.bayName : row.slotLabel;
  const pay = row.paid ? "Paid" : row.kind === "booking" ? (row.booking?.source === "online_link" ? "Booked from your QR" : "Booked on River Mobile") : "Pay at the shop";
  return (
    <li className="rounded-card bg-surface py-3 pl-3 pr-3.5 shadow-card">
      <div className="flex items-center gap-3">
        <Art name={row.channel === "online" ? "ticket" : "carwash"} size={40} />
        <div className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <b className="truncate text-[15.5px] tracking-[-0.01em]">{row.who}</b>
          <span className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {where}</span>
          <span className="mt-0.5 truncate text-[12.5px] font-semibold text-muted">{row.ref} · {pay}</span>
        </div>
        <b className="text-[14px]">{row.price ? peso(row.price) : STATUS[row.status]}</b>
      </div>
      <Actions row={row} onOpen={onOpen} {...rest} />
      <button type="button" onClick={() => onOpen(row)} className="mt-2 min-h-9 text-[13px] font-bold underline decoration-grey-300 underline-offset-[3px]">View details</button>
    </li>
  );
}

/** Queue (Barbers.ph QueueBoard look): Current / Completed cards with 3D icons; Current keeps the carwash actions. */
export function QueueBoard() {
  const { shop } = useShop();
  const router = useRouter();
  const params = useSearchParams();
  const tab: "current" | "done" = params.get("tab") === "done" ? "done" : "current";
  const walk = useWalkInAllowance(shop?.id);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [payFor, setPayFor] = useState<Job | null>(null);
  const [details, setDetails] = useState<OrderRef | null>(null);
  const today = useToday(shop);
  const rows = today.jobs.filter((r) => r.status !== "declined");
  const fig = figures(today.jobs, today.summary);

  const isOpen = (r: Job) => r.status === "requested" || r.status === "accepted" || r.status === "in_bay" || (r.status === "done" && r.kind === "queue" && !r.paid);
  const dayOpen = useMemo(() => rows.filter(isOpen), [rows]);
  const dayDone = useMemo(() => rows.filter((r) => !isOpen(r) && (r.status === "done" || r.status === "paid")), [rows]);
  const current = dayOpen.filter((r) => matches(r, search));
  const done = dayDone.filter((r) => matches(r, search));
  const busyBays = new Set(rows.filter((r) => r.status === "in_bay").map((r) => r.queue?.bayId));
  const freeBay = today.bays.find((b) => b.active && !busyBays.has(b.id)) ?? null;
  const dayText = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

  const setTab = (next: "current" | "done") => router.replace(next === "done" ? "/queue?tab=done" : "/queue", { scroll: false });
  const onAct = (fn: (shopId: string) => Promise<void>, full?: string) => {
    setNote(full ?? "");
    if (!shop || full) return;
    fn(shop.id).then(() => today.reload(), (e: Error) => setNote(e.message));
  };
  const open = (r: Job) => setDetails({ kind: r.kind, id: r.id });

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <header className="flex items-center justify-between gap-3 border-b border-line px-1 pb-3">
        <div className="flex min-w-0 items-center gap-1">
          <PageBack fallback="/home" />
          <div className="min-w-0">
            <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Queue</h1>
            <p className="mt-0.5 text-[14px] font-semibold text-muted">{dayDone.length} completed · {fig.inBay} in bay</p>
          </div>
        </div>
      </header>

      <div className="mt-4 flex items-center justify-between gap-3 px-1">
        <p className="min-w-0 truncate text-[13px] font-bold text-muted">Today · {dayText}</p>
        <Link href="/queue/bays" className="inline-flex h-9 flex-none items-center rounded-pill bg-surface px-3.5 text-[13px] font-bold shadow-card">Bays</Link>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <SearchInput className="min-w-0 flex-1" label="Search the queue" placeholder="Ticket, customer or service" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button href="/queue/new" size="md" aria-label="New walk-in" data-auth="action" leadingIcon={<Plus size={18} strokeWidth={2.2} />} className="flex-none px-4">Walk-in</Button>
      </div>
      {walk.label ? <p className="mt-2 px-1 text-[13px] font-bold" data-testid="walkin-left">{walk.label}</p> : null}
      {walk.atLimit ? <WalkInLimitCard className="mt-3" /> : null}

      <div className="mt-3 grid grid-cols-2 gap-3" role="tablist" aria-label="Queue sections">
        {([["current", "Current", dayOpen.length, "Waiting, in a bay or to pay", "queue"], ["done", "Completed", dayDone.length, "Finished washes", "carwash"]] as const).map(([k, label, n, hint, icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`relative min-w-0 overflow-hidden rounded-card px-4 pb-3.5 pt-3 text-left shadow-card transition-colors active:scale-[0.99] ${tab === k ? "bg-ink text-on-ink" : "bg-surface"}`}>
            <RiverIcon name={icon} size={48} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 sm:right-3" />
            <span className={`block text-[12.5px] font-semibold ${tab === k ? "text-on-ink-muted" : "text-muted"}`}>{label}</span>
            <b className="relative mt-0.5 block text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{n}</b>
            <span className={`mt-1.5 hidden truncate pr-16 text-[12px] font-medium sm:block ${tab === k ? "text-on-ink-muted" : "text-muted"}`}>{hint}</span>
          </button>
        ))}
      </div>

      {note ? <p className="mt-3 px-1 text-[13.5px] font-semibold">{note}</p> : null}
      {!today.ready ? (
        <div role="status" aria-label="Loading the queue" className="mt-4 flex flex-col gap-2.5"><span className="skeleton h-[72px] rounded-card" /><span className="skeleton h-[72px] rounded-card" /></div>
      ) : tab === "current" ? (
        current.length === 0 ? (
          search && dayOpen.length ? <EmptyState className="mt-4" title="No matches" /> : (
            <QueueEmpty icon="empty-queue" title="The bays are clear" text="Walk-ins and online bookings in progress show up here." />
          )
        ) : (
          <Section title={`Current today · ${current.length}`} rows={current} freeBay={freeBay} noBays={today.bays.length === 0} onAct={onAct} onPay={setPayFor} onOpen={open} />
        )
      ) : done.length === 0 ? (
        search && dayDone.length ? <EmptyState className="mt-4" title="No matches" /> : (
          <QueueEmpty icon="ticket" title="No completed washes yet" text="Finished walk-ins and online bookings show up here." />
        )
      ) : (
        <div className="mt-5">
          <p className="px-1 text-[13px] font-bold text-muted">Completed today · {done.length}</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card" aria-label="Completed today">
            {done.map((row) => <DoneRow key={row.id} row={row} onOpen={open} />)}
          </ul>
        </div>
      )}
      {details && shop ? <OrderDetails shopId={shop.id} order={details} onClose={() => setDetails(null)} onChanged={() => today.reload()} /> : null}
      {payFor && shop ? <PaySheet row={payFor} onClose={() => setPayFor(null)} onPaid={() => { setPayFor(null); today.reload(); }} shopId={shop.id} /> : null}
    </div>
  );
}

/** Barbers.ph empty block: soft grey card, 3D icon, title and one line. */
function QueueEmpty({ icon, title, text }: { icon: CarwashIcon; title: string; text: string }) {
  return (
    <div className="mt-4 rounded-card bg-grey-50 px-5 py-6 text-center ring-1 ring-line">
      <RiverIcon name={icon} size={56} className="mx-auto block" />
      <b className="mt-3 block text-[16px] tracking-[-0.01em]">{title}</b>
      <p className="mt-1 text-[13px] font-medium text-muted">{text}</p>
    </div>
  );
}

const timeOf = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) : "");

/** One finished wash (Barbers.ph DoneRow): who, time, service · bay, amount and how it was paid. */
function DoneRow({ row, onOpen }: { row: Job; onOpen: (row: Job) => void }) {
  const method = row.queue?.paymentMethod;
  return (
    <li>
      <button type="button" onClick={() => onOpen(row)} aria-label={`Open ${row.ref}`} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1 leading-[1.3]">
          <span className="flex min-w-0 items-center gap-2">
            <b className="min-w-0 truncate text-[14.5px]">{row.who}</b>
            <span className="inline-flex flex-none items-center gap-1 text-[12px] font-semibold text-muted tabular-nums"><Clock size={12} strokeWidth={2.2} aria-hidden />{timeOf(row.queue?.doneAt ?? row.createdAt)}</span>
          </span>
          <span className="block truncate text-[12.5px] font-semibold text-muted">{[row.serviceName, row.bayName].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex-none text-right leading-tight">
          <b className="block text-[15px] tabular-nums">{peso(row.price || 0) || "₱0"}</b>
          <small className={`text-[11.5px] font-semibold ${row.paid ? "text-muted" : "text-[#B45309]"}`}>{row.paid ? (method ? method === "gcash" ? "GCash" : method === "maya" ? "Maya" : method[0]!.toUpperCase() + method.slice(1) : "Paid") : "Unpaid"}</small>
        </span>
        <ChevronRight size={16} strokeWidth={2} className="flex-none text-subtle" aria-hidden />
      </button>
    </li>
  );
}

function Section({ title, rows, ...rest }: { title: string; rows: Job[]; freeBay: { id: string; name: string } | null; noBays?: boolean; onAct: (fn: (shopId: string) => Promise<void>, full?: string) => void; onPay: (row: Job) => void; onOpen: (row: Job) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="px-1 text-[13px] font-bold text-muted">{title}</p>
      <ul className="mt-3 flex flex-col gap-3" aria-label={title}>
        {rows.map((row) => <Row key={row.id} row={row} {...rest} />)}
      </ul>
    </div>
  );
}

function PaySheet({ row, shopId, onClose, onPaid }: { row: Job; shopId: string; onClose: () => void; onPaid: () => void }) {
  const [amount, setAmount] = useState(row.price ? String(row.price / 100) : "");
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const centavos = Math.round(Number(amount || 0) * 100);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 sm:items-center" role="dialog" aria-modal="true" aria-label="Record payment">
      <Card className="w-full max-w-[440px] rounded-b-none p-5 sm:rounded-card">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Record payment</h2>
        <p className="mt-1 text-[14px] font-medium text-muted">{row.ref} · {row.who} · {row.serviceName}</p>
        <div className="mt-4 flex flex-col gap-3">
          <Input label="Amount (₱)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <div className="flex flex-wrap gap-2">
            {[["cash", "Cash"], ["gcash", "GCash"], ["maya", "Maya"], ["other", "Other"]].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={method === k} onClick={() => setMethod(k!)} className={cn("rounded-pill px-4 py-2 text-[14px] font-bold", method === k ? "bg-ink text-on-ink" : "bg-grey-100")}>{l}</button>
            ))}
          </div>
          {method !== "cash" ? <Input label="Reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="GCash / Maya ref" /> : null}
          {error ? <p role="alert" className="text-[13.5px] font-semibold">{error}</p> : null}
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth disabled={busy || !centavos} onClick={() => {
            setBusy(true);
            payJob(shopId, row, centavos, method, ref.trim() || null).then(onPaid, (e: Error) => { setError(e.message); setBusy(false); });
          }}>Paid {peso(centavos)}</Button>
        </div>
      </Card>
    </div>
  );
}
