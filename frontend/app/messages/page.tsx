"use client";

import { Button, EmptyState, SectionHeader } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { BrowseGate } from "@/components/browse-gate";
import { GuestPage } from "@/components/shop/guest-page";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/screen";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type AlertItem } from "@/lib/api";
import { timePHT } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function MessagesPage() {
  return (
    <BrowseGate>
      <MessagesEntry />
    </BrowseGate>
  );
}

function MessagesEntry() {
  const { user } = useAuth();
  if (!user) {
    return <GuestPage title="Messages" description="In-app alerts for your shop only." actionLabel="Sign in to read alerts" mobileTab="home" />;
  }
  return <Inner />;
}

function Inner() {
  const { shop, newBookings, waiting } = useShopPage();
  const { data, error, reload } = useLoad(async () => {
    if (!shop) return [];
    return (await api<{ data: AlertItem[] }>(`/businesses/${shop.id}/alerts`)).data;
  }, shop ? `alerts-${shop.id}` : "none");

  if (!shop) return <Spinner />;

  async function markRead(id: string) {
    await api(`/businesses/${shop!.id}/alerts/${id}/read`, { method: "POST" });
    reload();
  }

  return (
    <ShopShell plan={shop.plan} newBookings={newBookings} waiting={waiting}>
      <ShopPageFrame>
        <SectionHeader title="Messages" aside="In-app alerts" />
        <p className="mt-1 text-[13.5px] font-medium text-muted">Email/SMS delivery logs until a provider is attached (see docs/api.md).</p>
        {error ? <p role="alert" className="mt-3 font-semibold">{error}</p> : null}
        {!data && !error ? <div className="mt-8"><Spinner label="Loading messages" /></div> : null}
        {data && data.length === 0 ? (
          <EmptyState className="mt-8" illustration={<Icon3D name="chat" size={64} />} title="No alerts yet" description="New River Mobile bookings and status changes show up here." />
        ) : (
          <ul className="mt-4 grid gap-2 lg:grid-cols-2">
            {data?.map((a) => (
              <li key={a.id} className={`rounded-2xl border px-4 py-3 ${a.read ? "border-grey-200 bg-white" : "border-ink/20 bg-grey-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b className="text-[15px]">{a.title}</b>
                    <p className="text-[13px] font-medium text-muted">{a.body}</p>
                    <p className="text-[12px] text-muted">{timePHT(a.createdAt)} · {a.type}</p>
                  </div>
                  {!a.read ? <Button size="sm" variant="secondary" onClick={() => markRead(a.id)}>Mark read</Button> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ShopPageFrame>
    </ShopShell>
  );
}
