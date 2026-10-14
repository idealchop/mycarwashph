"use client";

import { Icon3D } from "@river-apps/icons";
import { Plus } from "lucide-react";
import { Button, Card, EmptyState, Input, SearchInput, StatCard, cn } from "@river-apps/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageBack } from "@/components/shop/page-back";
import { peso } from "@/lib/format";
import { useShop } from "@/lib/shop-context";
import { useWalkInAllowance } from "@/lib/walkin-limit";
import { WalkInLimitCard } from "./walkin-limit-card";
import { acceptJob, declineJob, doneJob, figures, payJob, startJob, useToday, type Job } from "@/lib/today";

type Channel = "walk-ins" | "online";

const STATUS: Record<Job["status"], string> = {
  requested: "New", accepted: "Waiting", in_bay: "In bay", done: "Done", paid: "Paid", declined: "Declined",
};

function matches(row: Job, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [row.ref, row.who, row.serviceName, row.plate ?? ""].some((v) => v.toLowerCase().includes(t));
}

function Actions({ row, freeBay, noBays, onAct, onPay }: { row: Job; freeBay: { id: string; name: string } | null; noBays?: boolean; onAct: (fn: (shopId: string) => Promise<void>, full?: string) => void; onPay: (row: Job) => void }) {
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

function Row({ row, ...rest }: { row: Job; freeBay: { id: string; name: string } | null; noBays?: boolean; onAct: (fn: (shopId: string) => Promise<void>, full?: string) => void; onPay: (row: Job) => void }) {
  const where = row.status === "in_bay" && row.bayName ? row.bayName : row.slotLabel;
  const pay = row.paid ? "Paid" : row.kind === "booking" ? "Booked on River Mobile" : "Pay at the shop";
  return (
    <li className="rounded-card bg-surface py-3 pl-3 pr-3.5 shadow-card">
      <div className="flex items-center gap-3">
        <Icon3D name={row.channel === "online" ? "car" : "bubbles"} size={40} />
        <div className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <b className="truncate text-[15.5px] tracking-[-0.01em]">{row.who}</b>
          <span className="mt-0.5 truncate text-[13px] font-medium text-muted">{row.serviceName} · {where}</span>
          <span className="mt-0.5 truncate text-[12.5px] font-semibold text-muted">{row.ref} · {pay}</span>
        </div>
        <b className="text-[14px]">{row.price ? peso(row.price) : STATUS[row.status]}</b>
      </div>
      <Actions row={row} {...rest} />
    </li>
  );
}

/** Queue: walk-ins and online, with today’s sales on the same screen (Barbers.ph QueueBoard). */
export function QueueBoard() {
  const { shop } = useShop();
  const router = useRouter();
  const channel: Channel = useSearchParams().get("channel") === "online" ? "online" : "walk-ins";
  const walk = useWalkInAllowance(shop?.id);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [payFor, setPayFor] = useState<Job | null>(null);
  const today = useToday(shop);
  const rows = today.jobs.filter((r) => r.status !== "declined");
  const fig = figures(today.jobs, today.summary);

  const walkIns = useMemo(() => rows.filter((r) => r.channel === "walk-in"), [rows]);
  const online = useMemo(() => rows.filter((r) => r.channel === "online"), [rows]);
  const list = (channel === "walk-ins" ? walkIns : online).filter((r) => matches(r, search));
  const open = list.filter((r) => r.status === "requested" || r.status === "accepted" || r.status === "in_bay" || (r.status === "done" && r.kind === "queue" && !r.paid));
  const done = list.filter((r) => !open.includes(r) && (r.status === "done" || r.status === "paid"));
  const busyBays = new Set(rows.filter((r) => r.status === "in_bay").map((r) => r.queue?.bayId));
  const freeBay = today.bays.find((b) => b.active && !busyBays.has(b.id)) ?? null;

  const setChannel = (next: Channel) => router.replace(next === "online" ? "/queue?channel=online" : "/queue", { scroll: false });
  const onAct = (fn: (shopId: string) => Promise<void>, full?: string) => {
    setNote(full ?? "");
    if (!shop || full) return;
    fn(shop.id).then(() => today.reload(), (e: Error) => setNote(e.message));
  };

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <header className="flex flex-wrap items-end gap-x-6 border-b border-line px-1">
        <div className="flex items-center gap-1 pb-3">
          <PageBack fallback="/home" />
          <div>
            <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Queue</h1>
            <p className="mt-0.5 text-[14px] font-semibold text-muted">{fig.inBay} in bay · {fig.toAccept} to accept</p>
          </div>
        </div>
        <div role="tablist" aria-label="Queue channel" className="flex items-end gap-6">
          {([
            ["walk-ins", "Walk-ins", walkIns.length],
            ["online", "Online", online.length],
          ] as const).map(([value, label, count]) => {
            const on = channel === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setChannel(value)}
                className={cn("-mb-px min-h-11 border-b-2 px-0.5 pb-2.5 pt-2 text-[15px]", on ? "border-ink font-bold text-ink" : "border-transparent font-semibold text-muted")}
              >
                {label}
                {count ? <span className="ml-1.5 tabular-nums">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </header>

      <p className="mt-4 px-1 text-[13px] font-bold text-muted">Today</p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard className="pb-3" label="Sales" value={peso(fig.sales) || "₱0"} caption={`${fig.cars} cars`} />
        <Link href="/queue/bays" aria-label="In bay" className="block rounded-card">
          <StatCard className="pb-3" label="In bay" value={String(fig.inBay)} />
        </Link>
        <StatCard className="pb-3" label="To accept" value={String(fig.toAccept)} />
        <StatCard className="pb-3" label="Done" value={String(fig.done)} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <SearchInput
          className="min-w-0 flex-1"
          label="Search the queue"
          placeholder={channel === "walk-ins" ? "Ticket, plate or customer" : "Customer or service"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {channel === "walk-ins" ? (
          <Button href="/queue/new" size="md" aria-label="New walk-in" data-auth="action" leadingIcon={<Plus size={18} strokeWidth={2.2} />} className="flex-none px-4">
            Walk-in
          </Button>
        ) : null}
      </div>
      {channel === "walk-ins" && walk.label ? <p className="mt-2 px-1 text-[13px] font-bold" data-testid="walkin-left">{walk.label}</p> : null}
      {channel === "walk-ins" && walk.atLimit ? <WalkInLimitCard className="mt-3" /> : null}

      {note ? <p className="mt-3 px-1 text-[13.5px] font-semibold">{note}</p> : null}
      {!today.ready ? (
        <p className="mt-4 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">Loading the queue…</p>
      ) : list.length === 0 ? (
        <EmptyState
          className="mt-4"
          title={search ? "No matches" : channel === "online" ? "No bookings yet" : "The bays are clear"}
          description={search ? undefined : channel === "online" ? "Customers who book you on River Mobile show up here." : "Walk-ins you add at the counter show up here."}
        />
      ) : null}

      <Section title="To accept" rows={open} freeBay={freeBay} noBays={today.bays.length === 0} onAct={onAct} onPay={setPayFor} />
      <Section title="Done today" rows={done} freeBay={freeBay} noBays={today.bays.length === 0} onAct={onAct} onPay={setPayFor} />
      {payFor && shop ? <PaySheet row={payFor} onClose={() => setPayFor(null)} onPaid={() => { setPayFor(null); today.reload(); }} shopId={shop.id} /> : null}
    </div>
  );
}

function Section({ title, rows, ...rest }: { title: string; rows: Job[]; freeBay: { id: string; name: string } | null; noBays?: boolean; onAct: (fn: (shopId: string) => Promise<void>, full?: string) => void; onPay: (row: Job) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="px-1 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">{title}</p>
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
