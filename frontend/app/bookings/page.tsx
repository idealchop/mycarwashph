"use client";

import { Button, EmptyState, SectionHeader } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { RequireAuth } from "@/components/require-auth";
import { Spinner } from "@/components/screen";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type Booking, type Service } from "@/lib/api";
import { timePHT } from "@/lib/format";
import { serviceNames } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function BookingsPage() {
  return <RequireAuth><Inner /></RequireAuth>;
}

function Inner() {
  const { shop, newBookings, waiting, error: meError } = useShopPage();
  const { data, error, reload } = useLoad(async () => {
    if (!shop) return null;
    const [bookings, services] = await Promise.all([
      api<{ data: Booking[] }>(`/businesses/${shop.id}/bookings`),
      api<{ data: Service[] }>(`/businesses/${shop.id}/services`),
    ]);
    return { bookings: bookings.data, services: services.data };
  }, shop?.id ?? "none");

  if (meError) return <p className="p-6">{meError}</p>;
  if (!shop) return <Spinner />;

  async function act(id: string, action: "accept" | "decline" | "complete") {
    await api(`/businesses/${shop!.id}/bookings/${id}/${action}`, { method: "POST" });
    reload();
  }

  return (
    <ShopShell newBookings={newBookings} waiting={waiting} mobileTab="home">
      <div className="mx-auto max-w-[720px] px-4 pb-24 pt-4 lg:px-0">
        <SectionHeader title="Bookings" aside={`${data?.bookings.length ?? 0} total`} />
        {error ? <p role="alert" className="mt-3 font-semibold">{error}</p> : null}
        {!data ? <Spinner label="Loading bookings" /> : null}
        {data && data.bookings.length === 0 ? (
          <EmptyState className="mt-8" illustration={<Icon3D name="car" size={64} />} title="No bookings yet" description="River Mobile bookings show up here when customers book your shop." />
        ) : null}
        <ul className="mt-4 flex flex-col gap-2.5">
          {data?.bookings.map((b) => (
            <li key={b.id} className="rounded-2xl border border-grey-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <b className="text-[16px]">{serviceNames(b.serviceIds, data.services)}</b>
                  <p className="text-[13px] font-medium text-muted">{b.customerSnapshot.name} · {timePHT(b.scheduledStart)} · {b.status}</p>
                  <p className="text-[12px] font-semibold text-muted">{b.reference}{b.plate ? ` · ${b.plate}` : ""}</p>
                </div>
                <div className="flex gap-1.5">
                  {b.status === "requested" ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => act(b.id, "decline")}>Decline</Button>
                      <Button size="sm" onClick={() => act(b.id, "accept")}>Accept</Button>
                    </>
                  ) : null}
                  {b.status === "checked_in" && shop.plan === "partner" ? (
                    <Button size="sm" onClick={() => act(b.id, "complete")}>Mark served</Button>
                  ) : null}
                  {b.status === "accepted" ? <Button size="sm" href="/scan">Scan</Button> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ShopShell>
  );
}
