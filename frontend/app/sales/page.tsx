"use client";

import { EmptyState, SectionHeader, StatCard } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { RequireAuth } from "@/components/require-auth";
import { Spinner } from "@/components/screen";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type Sale, type SalesSummary } from "@/lib/api";
import { peso, timePHT } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function SalesPage() {
  return <RequireAuth><Inner /></RequireAuth>;
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
      <ShopShell newBookings={newBookings} waiting={waiting} mobileTab="sales">
        <div className="p-6 text-center"><h1 className="text-[22px] font-extrabold">Sales is a Paid feature</h1></div>
      </ShopShell>
    );
  }

  return (
    <ShopShell newBookings={newBookings} waiting={waiting} mobileTab="sales">
      <div className="mx-auto max-w-[720px] px-4 pb-24 pt-4 lg:px-0">
        <SectionHeader title="Sales" aside={data?.summary.date} />
        {error ? <p role="alert" className="mt-3 font-semibold">{error}</p> : null}
        {!data ? <Spinner label="Loading sales" /> : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <StatCard label="Today" value={peso(data.summary.totalCentavos)} />
              <StatCard label="Cars today" value={String(data.summary.cars)} />
            </div>
            {data.list.length === 0 ? (
              <EmptyState className="mt-8" illustration={<Icon3D name="coin" size={64} />} title="No sales recorded yet" description="Mark a queue item as paid to record a sale." />
            ) : (
              <ul className="mt-5 flex flex-col gap-2">
                {data.list.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-2xl border border-grey-200 bg-white px-4 py-3">
                    <div>
                      <b className="text-[15px]">{s.customerName ?? s.plate ?? "Sale"}</b>
                      <p className="text-[12.5px] font-medium text-muted">{s.method.toUpperCase()}{s.paymentRef ? ` · ${s.paymentRef}` : ""} · {timePHT(s.paidAt)}</p>
                    </div>
                    <b className="text-[16px]">{peso(s.amountCentavos)}</b>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </ShopShell>
  );
}
