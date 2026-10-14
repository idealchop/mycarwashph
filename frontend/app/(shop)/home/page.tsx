"use client";

import { Icon3D, type IconName } from "@river-apps/icons";
import { Avatar, Button, SectionHeader, StatCard } from "@river-apps/ui";
import { QrCode } from "lucide-react";
import Link from "next/link";
import { BookingList } from "@/components/bookings/booking-list";
import { LoadingBlock, SetUpShop } from "@/components/shop/page";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { api, type SalesSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { greeting, peso } from "@/lib/format";
import { useShop } from "@/lib/shop-context";
import { useLoad } from "@/lib/use-load";

type Shop = NonNullable<ReturnType<typeof useShop>["shop"]>;

function Action({ href, icon, label, note, auth }: { href: string; icon: IconName; label: string; note: string; auth?: boolean }) {
  return (
    <Link
      href={href}
      data-auth={auth ? "action" : undefined}
      className="flex items-center gap-3 rounded-card bg-surface p-3.5 shadow-raised transition hover:bg-grey-50"
    >
      <Icon3D name={icon} size={40} />
      <span className="min-w-0">
        <b className="block text-[15px]">{label}</b>
        <small className="block truncate text-[12.5px] font-semibold text-muted">{note}</small>
      </span>
    </Link>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { loading, shop, error, reload } = useShop();
  const name = user?.displayName ?? user?.phoneNumber ?? "Guest";

  return (
    <ShopPageFrame>
      <header className="flex items-center justify-between gap-3">
        <Link href="/account" className="flex min-w-0 items-center gap-3" aria-label="Account">
          <Avatar name={name} preset="sky" size={44} />
          <span className="flex min-w-0 flex-col leading-[1.2]">
            <span className="text-[12.5px] font-semibold text-muted">{greeting()}</span>
            <b className="truncate text-[19px] font-extrabold tracking-[-0.01em]">{shop?.name ?? (user ? name : "Welcome to Mycarwash")}</b>
          </span>
        </Link>
        {shop?.plan === "paid" ? (
          <Button size="sm" variant="secondary" href="/qr" leadingIcon={<QrCode size={18} strokeWidth={2} />}>Shop QR</Button>
        ) : null}
      </header>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <Action href="/scan" icon="check" label="Scan a booking" note="Verify a River Mobile QR" auth />
        {shop?.plan === "paid" ? <Action href="/queue/new" icon="car" label="Add walk-in" note="Put a car in the queue" auth /> : null}
        <Action href="/history" icon="shield" label="History" note="All River Mobile bookings" />
        {shop?.plan === "paid" ? <Action href="/sales" icon="coin" label="Sales" note="Today’s takings" /> : null}
        <Action href="/settings" icon="sparkle" label="Settings" note="Shop, services, billing" />
      </div>

      {error ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p role="alert" className="text-[14px] font-semibold">We couldn’t load your shop: {error}</p>
          <Button size="sm" variant="secondary" onClick={() => reload()}>Try again</Button>
        </div>
      ) : loading ? (
        <LoadingBlock />
      ) : shop ? (
        <ShopHome shop={shop} />
      ) : (
        <SetUpShop
          title="Your car wash, on River Mobile"
          description="Add your shop name, hours and map pin. Saving publishes a Basic Wash service so customers can book you."
        />
      )}
    </ShopPageFrame>
  );
}

function ShopHome({ shop }: { shop: Shop }) {
  const { data: summary } = useLoad(
    () => (shop.plan === "paid" ? api<{ data: SalesSummary }>(`/businesses/${shop.id}/sales/summary`).then((r) => r.data) : Promise.resolve(null)),
    `home-sales-${shop.id}-${shop.plan}`,
  );
  return (
    <>
      {shop.plan === "paid" ? (
        summary ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <StatCard label="Sales today" value={peso(summary.totalCentavos) || "₱0"} />
            <StatCard label="Cars today" value={String(summary.cars)} />
          </div>
        ) : null
      ) : null}
      <SectionHeader className="mt-7" title="Booking requests" aside={<Link href="/history" className="hover:text-ink">See all</Link>} />
      <BookingList
        shopId={shop.id}
        plan={shop.plan}
        status="requested"
        emptyTitle="No new requests"
        emptyDescription="River Mobile bookings show up here for you to accept."
      />
    </>
  );
}
