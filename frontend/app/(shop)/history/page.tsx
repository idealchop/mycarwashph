"use client";

import { Topbar } from "@river-apps/ui";
import { BookingList } from "@/components/bookings/booking-list";
import { LoadingBlock } from "@/components/shop/page";
import { PageBack } from "@/components/shop/page-back";
import { api, type Sale } from "@/lib/api";
import { peso } from "@/lib/format";
import { useShop } from "@/lib/shop-context";
import { useLoad } from "@/lib/use-load";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Past visits, opened from Account (Barbers.ph HistoryScreen): every finished, paid wash, walk-ins and bookings. */
export default function HistoryPage() {
  const { shop, loading } = useShop();
  const paid = shop?.plan === "paid";
  const { data } = useLoad(
    () => (shop && paid ? api<{ data: Sale[] }>(`/businesses/${shop.id}/sales?limit=200`).then((r) => r.data) : Promise.resolve(null)),
    `history-${shop?.id ?? "none"}-${paid}`,
  );
  const rows = data ?? [];
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        leading={<PageBack fallback="/account" />}
        title="History"
        subtitle={!shop ? "Past washes and bookings" : paid ? (data ? `${rows.length} finished` : "Loading") : "River Mobile bookings"}
      />
      {loading ? <LoadingBlock /> : !shop ? (
        <p className="mt-6 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">Finished washes show up here once your shop is set up.</p>
      ) : paid ? (
        !data ? <LoadingBlock /> : rows.length ? (
          <ul className="mt-2 flex flex-col gap-2">
            {rows.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
                <span className="min-w-0">
                  <b className="block truncate">{s.customerName || s.plate || "Walk-in"}</b>
                  <small className="text-[12.5px] font-semibold text-muted">{s.plate && s.customerName ? `${s.plate} · ` : ""}{s.method.toUpperCase()} · {when(s.paidAt)}</small>
                </span>
                <b>{peso(s.amountCentavos)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No finished washes yet. Paid cars from the queue show up here.</p>
        )
      ) : (
        <BookingList
          shopId={shop.id}
          plan={shop.plan}
          emptyTitle="No bookings yet"
          emptyDescription="Turn on “List on River Mobile” in Account → Edit shop so customers can book you."
        />
      )}
    </div>
  );
}
