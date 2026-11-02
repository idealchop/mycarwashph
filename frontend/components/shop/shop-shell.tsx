"use client";

import { hasPaidFeatures } from "@/lib/plan-gating";

import Link from "next/link";
import { CarIllustration } from "@river-apps/icons";
import { AppShell, Button, Sidebar } from "@river-apps/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MycarwashBrand } from "@/components/brand";
import { useShop } from "@/lib/shop-context";
import { RiverIcon } from "@/components/river-icon";
import { activeKeyFor, appNav, staffBlocked } from "./nav";
import { ShopTabBar } from "./shop-tab-bar";

function ShopQrPromo() {
  return (
    <div className="relative rounded-card bg-grey-100 px-4 pb-4 pt-[78px]">
      <div className="absolute inset-x-0 -top-9 flex justify-center"><CarIllustration size={170} /></div>
      <b className="block text-[14.5px]">Shop QR code</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">Print it for your counter</small>
      <Button size="sm" fullWidth href="/qr">Get QR code</Button>
    </div>
  );
}

function PartnerPlanCard() {
  return (
    <div className="rounded-card bg-grey-100 p-4">
      <b className="block text-[14.5px]">You’re on Partner</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">Pro adds the queue, walk-ins, sales and the shop QR.</small>
      <Button size="sm" variant="secondary" fullWidth href="/settings/billing">See plans</Button>
    </div>
  );
}

function LegalLinks() {
  return (
    <div className="mt-3 flex justify-center gap-3 text-[11.5px] font-semibold text-ink/55">
      <Link href="/terms" className="hover:text-ink hover:underline">Terms</Link>
      <Link href="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
    </div>
  );
}

/** Focused screens hide the bottom nav (forms and the scanner). */
const FOCUS = ["/queue/new", "/settings/edit", "/scan"];

/** Home, Queue and Moments for every plan. Account and the shop QR sit outside the nav. */
export function ShopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { shop } = useShop();
  const paid = hasPaidFeatures(shop);
  const focus = FOCUS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const active = activeKeyFor(pathname);
  const staff = shop?.role === "staff";
  const blocked = staff && staffBlocked(pathname);

  return (
    <AppShell
      sidebar={
        <Sidebar
          className="sticky top-0 h-dvh"
          brand={<Link href="/home" aria-label="Mycarwash.ph home"><MycarwashBrand /></Link>}
          items={appNav(active, 26, staff)}
          activeKey={active}
          footer={<div>{paid ? <ShopQrPromo /> : <PartnerPlanCard />}<LegalLinks /></div>}
        />
      }
      mobileTabBar={focus ? undefined : <ShopTabBar items={appNav(active, 32, staff)} activeKey={active ?? ""} />}
      mainClassName={focus ? "w-full min-w-0 pb-0" : "w-full min-w-0"}
    >
      {blocked ? <OwnerOnly /> : children}
    </AppShell>
  );
}

/** What staff see on owner-only pages (sales, settings, billing, history, Moments). */
function OwnerOnly() {
  return (
    <main className="mx-auto flex w-full max-w-[402px] flex-col items-center px-5 pb-10 pt-16 text-center">
      <RiverIcon name="queue" size={88} className="block" />
      <h1 className="mt-5 text-[24px] font-extrabold tracking-[-0.03em]">Owner only</h1>
      <p className="mt-2 max-w-[300px] text-[14.5px] font-medium text-muted">Staff run the queue and walk-ins. Sales, settings and billing are for the shop owner.</p>
      <Button className="mt-6" fullWidth href="/queue">Go to Queue</Button>
    </main>
  );
}
