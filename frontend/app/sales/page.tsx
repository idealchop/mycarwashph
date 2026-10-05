"use client";

import { EmptyState, SectionHeader, StatCard } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { BrowseGate } from "@/components/browse-gate";
import { GuestPage } from "@/components/shop/guest-page";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/screen";
import { ShopContentCard } from "@/components/shop/content-card";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type Sale, type SalesSummary } from "@/lib/api";
import { peso, timePHT } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function SalesPage() {
  return (
    <BrowseGate>
      <SalesEntry />
    </BrowseGate>
  );
}

function SalesEntry() {
  const { user } = useAuth();
  if (!user) {
    return <GuestPage title="Sales" description="Sample sales totals. Recording payments needs sign-in." actionLabel="Sign in to view real sales" mobileTab="sales" />;
  }
  return <Inner />;
}

function Inner() {
  const { shop, newBookings, waiting, error: meError } = useShopPage();
  const { data, error } = useLoad(async () => {
    if (!shop || shop.plan !== "paid") return null;
    const [summary, list] = await Promise.all([
      api<{ data: SalesSummary }>(`/businesses/${shop.id}/sales/summary`),
      api<{ data: Sale[] }>(`/businesses/${shop.id}/sales`),
    ]);
    return { summary: summary.data, list: list.data };
  }, shop ? `sales-${shop.id}` : "none");

  if (meError) return <p className="p-6">{meError}</p>;
  if (!shop) return <Spinner />;
  if (shop.plan !== "paid") {
    return (
      <ShopShell plan={shop.plan} newBookings={newBookings} waiting={waiting} mobileTab="sales">
        <ShopPageFrame className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="text-[22px] font-extrabold">Sales is a Paid feature</h1>
          <p className="mt-2 text-[15px] font-medium text-muted">Available on Paid shops once plan prices are announced.</p>
        </ShopPageFrame>
      </ShopShell>
    );
  }

  return (
    <ShopShell plan={shop.plan} newBookings={newBookings} waiting={waiting} mobileTab="sales">
      <ShopPageFrame>
        <SectionHeader title="Sales" aside={data?.summary.date} />
        {error ? <p role="alert" className="mt-3 font-semibold">{error}</p> : null}
        {!data ? <Spinner label="Loading sales" /> : (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Today" value={peso(data.summary.totalCentavos)} />
              <StatCard label="Cars today" value={String(data.summary.cars)} />
            </div>
            {data.list.length === 0 ? (
              <EmptyState className="mt-8" illustration={<Icon3D name="coin" size={64} />} title="No sales recorded yet" description="Mark a queue item as paid to record a sale." />
            ) : (
              <ShopContentCard>
                <ul className="divide-y divide-grey-200">
                  {data.list.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-3.5">
                      <div>
                        <b className="text-[15px]">{s.customerName ?? s.plate ?? "Sale"}</b>
                        <p className="text-[12.5px] font-medium text-muted">{s.method.toUpperCase()}{s.paymentRef ? ` · ${s.paymentRef}` : ""} · {timePHT(s.paidAt)}</p>
                      </div>
                      <b className="text-[16px]">{peso(s.amountCentavos)}</b>
                    </li>
                  ))}
                </ul>
              </ShopContentCard>
            )}
          </>
        )}
      </ShopPageFrame>
    </ShopShell>
  );
}
