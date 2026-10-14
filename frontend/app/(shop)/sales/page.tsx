"use client";

import { Button, EmptyState, StatCard } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { ShopContentCard } from "@/components/shop/content-card";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { api, type Sale, type SalesSummary } from "@/lib/api";
import { peso, timePHT } from "@/lib/format";
import { useLoad } from "@/lib/use-load";

export default function SalesPage() {
  return (
    <ShopPage
      title="Sales"
      back="/home"
      icon="coin"
      empty={{ title: "No sales yet", description: "Payments you record in the queue add up here." }}
    >
      {(s) =>
        s.plan === "paid" ? (
          <SalesList shopId={s.id} />
        ) : (
          <div className="mt-6 rounded-card bg-grey-100 p-5">
            <b className="text-[15px]">Sales comes with Pro or Lifetime</b>
            <p className="mt-1 text-[13.5px] font-medium text-muted">Pro and Lifetime shops record payments from the queue and see daily totals.</p>
            <Button className="mt-3" size="sm" href="/settings/billing">See plans</Button>
          </div>
        )
      }
    </ShopPage>
  );
}

function SalesList({ shopId }: { shopId: string }) {
  const { data, error } = useLoad(async () => {
    const [summary, list] = await Promise.all([
      api<{ data: SalesSummary }>(`/businesses/${shopId}/sales/summary`),
      api<{ data: Sale[] }>(`/businesses/${shopId}/sales`),
    ]);
    return { summary: summary.data, list: list.data };
  }, `sales-${shopId}`);
  if (error) return <p role="alert" className="mt-4 font-semibold">{error}</p>;
  if (!data) return <LoadingBlock />;
  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Today" value={peso(data.summary.totalCentavos) || "₱0"} />
        <StatCard label="Cars today" value={String(data.summary.cars)} />
      </div>
      {data.list.length === 0 ? (
        <EmptyState className="mt-8" illustration={<Icon3D name="coin" size={64} />} title="No sales recorded yet" description="Record a payment on a finished car in the queue." />
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
  );
}
