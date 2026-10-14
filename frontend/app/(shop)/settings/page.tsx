"use client";

import { Icon3D, type IconName } from "@river-apps/icons";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shop/page";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { useShop } from "@/lib/shop-context";

function Row({ href, icon, title, note }: { href: string; icon: IconName; title: string; note: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-grey-50">
        <Icon3D name={icon} size={36} />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px]">{title}</b>
          <small className="block truncate text-[12.5px] font-semibold text-muted">{note}</small>
        </span>
        <ChevronRight size={18} strokeWidth={2} className="text-muted" />
      </Link>
    </li>
  );
}

export default function SettingsPage() {
  const { shop } = useShop();
  return (
    <ShopPageFrame narrow>
      <PageHeader title="Settings" subtitle={shop?.name} back="/home" />
      <ul className="mt-6 divide-y divide-grey-200 overflow-hidden rounded-card bg-surface shadow-raised">
        <Row href="/settings/edit" icon="car" title={shop ? "Edit shop" : "Set up your shop"} note="Name, phone, hours, address and map pin, logo, photos" />
        <Row href="/settings/services" icon="bubbles" title="Services" note="What you offer and prices by vehicle size" />
        <Row href="/settings/billing" icon="coin" title="Billing" note="Partner and Paid plans" />
        {shop?.plan === "paid" ? <Row href="/queue/bays" icon="drop" title="Bays" note="Your wash bays" /> : null}
        {shop?.plan === "paid" ? <Row href="/qr" icon="check" title="Shop QR code" note="Print it for your counter" /> : null}
        <Row href="/account" icon="shield" title="Account" note="Your sign-in and shops" />
      </ul>
    </ShopPageFrame>
  );
}
