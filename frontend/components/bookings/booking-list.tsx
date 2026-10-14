"use client";

import { Button, EmptyState } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { useState } from "react";
import { LoadingBlock } from "@/components/shop/page";
import { ShopContentCard } from "@/components/shop/content-card";
import { api, type Booking, type Service } from "@/lib/api";
import { timePHT } from "@/lib/format";
import { serviceNames } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";
import { OrderDetails, type OrderRef } from "@/features/orders/order-details";

const LABEL: Record<string, string> = {
  requested: "New request",
  accepted: "Accepted",
  checked_in: "Checked in",
  completed: "Served",
  declined: "Declined",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** River Mobile bookings for a shop, with accept / decline / served actions. */
export function BookingList({
  shopId,
  plan,
  status,
  filter,
  emptyTitle,
  emptyDescription,
  onChanged,
}: {
  shopId: string;
  plan: "partner" | "paid";
  status?: string;
  filter?: (b: Booking) => boolean;
  emptyTitle: string;
  emptyDescription: string;
  onChanged?: () => void;
}) {
  const { data, error, reload } = useLoad(async () => {
    const [bookings, services] = await Promise.all([
      api<{ data: Booking[] }>(`/businesses/${shopId}/bookings${status ? `?status=${status}` : ""}`),
      api<{ data: Service[] }>(`/businesses/${shopId}/services`),
    ]);
    return { bookings: bookings.data, services: services.data };
  }, `bookings-${shopId}-${status ?? "all"}`);
  const [busy, setBusy] = useState<string | null>(null);

  const [details, setDetails] = useState<OrderRef | null>(null);
  async function act(id: string, action: "accept" | "decline" | "complete") {
    setBusy(id);
    try {
      await api(`/businesses/${shopId}/bookings/${id}/${action}`, { method: "POST" });
      reload();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p role="alert" className="mt-4 text-[14px] font-semibold">{error}</p>;
  if (!data) return <LoadingBlock />;
  const rows = filter ? data.bookings.filter(filter) : data.bookings;
  if (rows.length === 0) {
    return <EmptyState className="mt-6" illustration={<Icon3D name="car" size={56} />} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <ShopContentCard>
      <ul className="divide-y divide-grey-200">
        {rows.map((b) => (
          <li key={b.id} className="py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <b className="text-[15.5px]">{serviceNames(b.serviceIds, data.services) || "Car wash"}</b>
                <p className="text-[13px] font-medium text-muted">{b.customerSnapshot.name} · {timePHT(b.scheduledStart)} · {LABEL[b.status] ?? b.status}</p>
                <p className="text-[12px] font-semibold text-muted">{b.reference} · <button type="button" onClick={() => setDetails({ kind: "booking", id: b.id })} className="font-bold text-ink underline decoration-grey-300 underline-offset-[3px]">View details</button></p>
              </div>
              <div className="flex gap-1.5">
                {b.status === "requested" ? (
                  <>
                    <Button size="sm" variant="secondary" disabled={busy === b.id} onClick={() => void act(b.id, "decline")}>Decline</Button>
                    <Button size="sm" disabled={busy === b.id} onClick={() => void act(b.id, "accept")}>Accept</Button>
                  </>
                ) : null}
                {b.status === "accepted" ? <Button size="sm" variant="secondary" href="/scan">Scan</Button> : null}
                {b.status === "checked_in" && plan === "partner" ? (
                  <Button size="sm" disabled={busy === b.id} onClick={() => void act(b.id, "complete")}>Mark served</Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {details ? <OrderDetails shopId={shopId} order={details} onClose={() => setDetails(null)} onChanged={() => { reload(); onChanged?.(); }} /> : null}
    </ShopContentCard>
  );
}
