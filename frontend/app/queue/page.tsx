"use client";

import { Button, EmptyState, Input, SectionHeader } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { useMemo, useState } from "react";
import { BrowseGate } from "@/components/browse-gate";
import { Screen, Spinner } from "@/components/screen";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { GuestPage } from "@/components/shop/guest-page";
import { ShopShell } from "@/components/shop/shop-shell";
import { useAuth } from "@/lib/auth";
import { GUEST_QUEUE } from "@/lib/guest-fixtures";
import { api, type Bay, type QueueItem, type Service } from "@/lib/api";
import { peso } from "@/lib/format";
import { serviceNames } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function QueuePage() {
  return (
    <BrowseGate>
      <QueueInner />
    </BrowseGate>
  );
}

function QueueInner() {
  const { user } = useAuth();
  if (!user) {
    return (
      <GuestPage title="Queue" description="Preview of today’s queue. Assign bay and record pay require sign-in." actionLabel="Sign in to run the queue" mobileTab="queue">
        <ul className="mt-4 grid gap-2.5 lg:grid-cols-2">
          {GUEST_QUEUE.map((q) => (
            <li key={q.id} className="rounded-2xl border border-grey-200 bg-white px-4 py-3">
              <b className="text-[16px]">#{q.queueNumber} · {q.plate ?? "Walk-in"}</b>
              <p className="text-[13px] font-medium text-muted">{q.status.replace("_", " ")} · sample</p>
            </li>
          ))}
        </ul>
      </GuestPage>
    );
  }
  return <PaidQueueEntry />;
}

function PaidQueueEntry() {
  const { shop, error: meError, newBookings, waiting, reload: reloadMe } = useShopPage();
  if (meError) return <ErrorBox message={meError} />;
  if (!shop) return <Spinner label="Loading shop" />;
  if (shop.plan !== "paid") {
    return (
      <ShopShell plan={shop.plan} newBookings={newBookings} waiting={waiting} mobileTab="queue">
        <ShopPageFrame className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="text-[22px] font-extrabold">Queue is a Paid feature</h1>
          <p className="mt-2 max-w-md text-[15px] font-medium text-muted">Upgrade when plan prices are announced. Partner shops use Scan + Bookings.</p>
          <Button className="mt-4" href="/home">Back home</Button>
        </ShopPageFrame>
      </ShopShell>
    );
  }
  return <PaidQueue shopId={shop.id} newBookings={newBookings} waiting={waiting} onChanged={reloadMe} />;
}

function PaidQueue({ shopId, newBookings, waiting, onChanged }: { shopId: string; newBookings: number; waiting: number; onChanged: () => void }) {
  const { data, error, reload } = useLoad(async () => {
    const [queue, bays, services] = await Promise.all([
      api<{ data: QueueItem[]; date: string }>(`/businesses/${shopId}/queue`),
      api<{ data: Bay[] }>(`/businesses/${shopId}/bays`),
      api<{ data: Service[] }>(`/businesses/${shopId}/services`),
    ]);
    return { queue: queue.data, date: queue.date, bays: bays.data, services: services.data };
  }, shopId);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [payFor, setPayFor] = useState<QueueItem | null>(null);
  const [amount, setAmount] = useState("350");
  const [method, setMethod] = useState<"cash" | "gcash" | "maya" | "other">("cash");
  const [ref, setRef] = useState("");

  const freeBay = useMemo(() => data?.bays.find((b) => b.active && !data.queue.some((q) => q.status === "in_bay" && q.bayId === b.id)), [data]);

  async function walkIn() {
    setBusy(true);
    try {
      await api(`/businesses/${shopId}/queue`, { method: "POST", body: { plate: plate || null, serviceIds: [], vehicleSize: null } });
      setPlate("");
      reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/businesses/${shopId}/queue/${id}`, { method: "PATCH", body });
      setPayFor(null);
      reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShopShell plan="paid" newBookings={newBookings} waiting={data?.queue.filter((q) => q.status === "queued").length ?? waiting} mobileTab="queue">
      <ShopPageFrame>
        <SectionHeader title="Queue" aside={data?.date} />
        <div className="mt-3 flex gap-2">
          <Input label="Plate" hideLabel placeholder="Plate (optional)" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <Button onClick={walkIn} disabled={busy}>Add walk-in</Button>
        </div>
        {error ? <p role="alert" className="mt-3 text-[14px] font-semibold">{error}</p> : null}
        {!data ? <Spinner label="Loading queue" /> : null}
        {data && data.queue.length === 0 ? (
          <EmptyState className="mt-8" illustration={<Icon3D name="car" size={64} />} title="No cars in the queue" description="Add a walk-in or scan a River Mobile booking." />
        ) : null}
        <ul className="mt-4 grid gap-2.5 lg:grid-cols-2">
          {data?.queue.map((q) => (
            <li key={q.id} className="rounded-2xl border border-grey-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <b className="text-[16px]">#{q.queueNumber} · {serviceNames(q.serviceIds, data.services) || "Walk-in"}</b>
                  <p className="text-[13px] font-medium text-muted">{q.plate ?? "No plate"} · {q.status.replace("_", " ")} · {q.source}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {q.status === "queued" && freeBay ? (
                    <Button size="sm" disabled={busy} onClick={() => patch(q.id, { status: "in_bay", bayId: freeBay.id })}>Assign {freeBay.name}</Button>
                  ) : null}
                  {q.status === "in_bay" ? <Button size="sm" disabled={busy} onClick={() => patch(q.id, { status: "done" })}>Mark done</Button> : null}
                  {q.status === "done" ? <Button size="sm" disabled={busy} onClick={() => { setPayFor(q); setAmount("350"); }}>Record pay</Button> : null}
                  {q.status === "paid" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => patch(q.id, { status: "closed" })}>Close</Button> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {payFor ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-3xl bg-white p-5">
              <h2 className="text-[20px] font-extrabold">Record payment</h2>
              <p className="mt-1 text-[14px] text-muted">#{payFor.queueNumber} · {payFor.plate ?? "No plate"}</p>
              <div className="mt-4 flex flex-col gap-3">
                <Input label="Amount (₱)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                <label className="text-[13px] font-bold">Method
                  <select className="mt-1 w-full rounded-xl border border-grey-200 px-3 py-2.5 text-[15px]" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="maya">Maya</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <Input label="Payment reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="GCash/Maya ref" />
                <p className="text-[12.5px] font-medium text-muted">QR / PSP: staff confirm after the customer pays. Hook a PSP later — no secrets in the app.</p>
              </div>
              <div className="mt-5 flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => setPayFor(null)}>Cancel</Button>
                <Button fullWidth disabled={busy || !Number(amount)} onClick={() => patch(payFor.id, {
                  status: "paid",
                  sale: { amountCentavos: Math.round(Number(amount) * 100), method, paymentRef: ref || null },
                })}>Confirm {peso(Math.round(Number(amount || 0) * 100))}</Button>
              </div>
            </div>
          </div>
        ) : null}
      </ShopPageFrame>
    </ShopShell>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-[22px] font-extrabold">Something went wrong</h1>
        <p className="text-[15px] font-medium text-muted">{message}</p>
      </div>
    </Screen>
  );
}
