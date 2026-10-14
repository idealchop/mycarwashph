"use client";

import { Button, EmptyState, Input } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { BookingList } from "@/components/bookings/booking-list";
import { ShopContentCard } from "@/components/shop/content-card";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { api, type Bay, type QueueItem, type Service } from "@/lib/api";
import { peso } from "@/lib/format";
import { serviceNames } from "@/lib/shop";
import { useShop } from "@/lib/shop-context";
import { useLoad } from "@/lib/use-load";

export default function QueuePage() {
  const { shop } = useShop();
  const paid = shop?.plan === "paid";
  return (
    <ShopPage
      title="Queue"
      subtitle={shop ? (paid ? "Cars waiting and in the bays" : "Today’s River Mobile bookings") : undefined}
      actions={
        paid || !shop ? (
          <>
            {paid ? <Button size="sm" variant="secondary" href="/queue/bays">Bays</Button> : null}
            <Button size="sm" href="/queue/new" data-auth="action" leadingIcon={<Plus size={18} strokeWidth={2.2} />}>Walk-in</Button>
          </>
        ) : null
      }
      icon="car"
      empty={{ title: "No cars in the queue", description: "Set up your shop to take walk-ins and River Mobile bookings." }}
    >
      {(s) =>
        s.plan === "paid" ? (
          <PaidQueue shopId={s.id} />
        ) : (
          <>
            <BookingList
              shopId={s.id}
              plan={s.plan}
              filter={(b) => b.status === "accepted" || b.status === "checked_in"}
              emptyTitle="No cars booked right now"
              emptyDescription="Accepted River Mobile bookings line up here. Scan the customer’s QR when they arrive."
            />
            <p className="mt-5 text-[13px] font-medium text-muted">Walk-ins and bays come with the Paid plan. <a className="font-semibold text-ink underline" href="/settings/billing">See plans</a></p>
          </>
        )
      }
    </ShopPage>
  );
}

function PaidQueue({ shopId }: { shopId: string }) {
  const { data, error, reload } = useLoad(async () => {
    const [queue, bays, services] = await Promise.all([
      api<{ data: QueueItem[]; date: string }>(`/businesses/${shopId}/queue`),
      api<{ data: Bay[] }>(`/businesses/${shopId}/bays`),
      api<{ data: Service[] }>(`/businesses/${shopId}/services`),
    ]);
    return { queue: queue.data, date: queue.date, bays: bays.data, services: services.data };
  }, `queue-${shopId}`);
  const [busy, setBusy] = useState(false);
  const [payFor, setPayFor] = useState<QueueItem | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "gcash" | "maya" | "other">("cash");
  const [ref, setRef] = useState("");

  const freeBay = useMemo(() => data?.bays.find((b) => b.active && !data.queue.some((q) => q.status === "in_bay" && q.bayId === b.id)), [data]);
  const activeBays = data?.bays.filter((b) => b.active).length ?? 0;

  function priceFor(q: QueueItem) {
    const svc = data?.services.filter((s) => q.serviceIds.includes(s.id)) ?? [];
    const size = q.vehicleSize ?? "medium";
    const total = svc.reduce((t, s) => t + (s.pricesBySize?.[size] ?? 0), 0);
    return total ? String(total / 100) : "";
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/businesses/${shopId}/queue/${id}`, { method: "PATCH", body });
      setPayFor(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p role="alert" className="mt-4 text-[14px] font-semibold">{error}</p>;
  if (!data) return <LoadingBlock />;
  return (
    <>
      {activeBays === 0 ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-card bg-grey-100 p-4">
          <p className="text-[13.5px] font-semibold">Add a bay so cars can move from the queue into service.</p>
          <Button size="sm" href="/queue/bays">Add bay</Button>
        </div>
      ) : null}
      {data.queue.length === 0 ? (
        <EmptyState className="mt-8" illustration={<Icon3D name="car" size={64} />} title="No cars in the queue" description="Add a walk-in or scan a River Mobile booking." />
      ) : (
        <ShopContentCard>
          <ul className="divide-y divide-grey-200">
            {data.queue.map((q) => (
              <li key={q.id} className="py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <b className="text-[16px]">#{q.queueNumber} · {serviceNames(q.serviceIds, data.services) || "Walk-in"}</b>
                    <p className="text-[13px] font-medium text-muted">
                      {q.plate ?? "No plate"} · {q.status.replace("_", " ")}
                      {q.bayId ? ` · ${data.bays.find((b) => b.id === q.bayId)?.name ?? "Bay"}` : ""} · {q.source}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {q.status === "queued" && freeBay ? (
                      <Button size="sm" disabled={busy} onClick={() => void patch(q.id, { status: "in_bay", bayId: freeBay.id })}>Start in {freeBay.name}</Button>
                    ) : null}
                    {q.status === "in_bay" ? <Button size="sm" disabled={busy} onClick={() => void patch(q.id, { status: "done" })}>Mark done</Button> : null}
                    {q.status === "done" ? <Button size="sm" disabled={busy} onClick={() => { setPayFor(q); setAmount(priceFor(q)); }}>Record pay</Button> : null}
                    {q.status === "paid" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => void patch(q.id, { status: "closed" })}>Close</Button> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ShopContentCard>
      )}
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
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setPayFor(null)}>Cancel</Button>
              <Button fullWidth disabled={busy || !Number(amount)} onClick={() => void patch(payFor.id, {
                status: "paid",
                sale: { amountCentavos: Math.round(Number(amount) * 100), method, paymentRef: ref || null },
              })}>Confirm {peso(Math.round(Number(amount || 0) * 100))}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
