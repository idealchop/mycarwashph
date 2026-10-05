"use client";

import { SectionHeader, StatCard } from "@river-apps/ui";
import { RequireAuth } from "@/components/require-auth";
import { Spinner } from "@/components/screen";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type GrowthMetrics } from "@/lib/api";
import { peso } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function GrowthPage() {
  return <RequireAuth><Inner /></RequireAuth>;
}

function Inner() {
  const { shop, newBookings, waiting } = useShopPage();
  const { data, error } = useLoad(async () => {
    if (!shop) return null;
    return (await api<{ data: GrowthMetrics }>(`/businesses/${shop.id}/growth`)).data;
  }, shop ? `growth-${shop.id}` : "none");

  if (!shop) return <Spinner />;

  return (
    <ShopShell plan={shop.plan} newBookings={newBookings} waiting={waiting}>
      <ShopPageFrame>
        <SectionHeader title="Growth" aside="From your live data" />
        {error ? <p role="alert" className="mt-3 font-semibold">{error}</p> : null}
        {!data ? <Spinner /> : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Open booking requests" value={String(data.bookingsRequestedOpen)} />
              <StatCard label="Queue today" value={String(data.queueToday)} />
              <StatCard label="Cars washed today" value={String(data.carsWashedToday)} />
              <StatCard label="Sales today" value={peso(data.salesTodayCentavos)} />
            </div>
            <div className="mt-6 rounded-2xl border border-grey-200 bg-white p-4">
              <b className="text-[15px]">Coming soon</b>
              <ul className="mt-2 list-disc pl-5 text-[14px] font-medium text-muted">
                {data.comingSoon.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <p className="mt-3 text-[13px] font-medium text-muted">Partner → Paid upgrade UI will appear here when plan prices are set (TBD — not hardcoded).</p>
            </div>
          </>
        )}
      </ShopPageFrame>
    </ShopShell>
  );
}
