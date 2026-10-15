"use client";

import { hasPaidFeatures } from "@/lib/plan-gating";

import Link from "next/link";
import { CarIllustration } from "@river-apps/icons";
import { AppShell, Button, MobileTabBar, Sidebar } from "@river-apps/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MycarwashBrand } from "@/components/brand";
import { useShop } from "@/lib/shop-context";
import { activeKeyFor, appNav } from "./nav";

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

  return (
    <AppShell
      sidebar={
        <Sidebar
          className="sticky top-0 h-dvh"
          brand={<Link href="/home" aria-label="Mycarwash.ph home"><MycarwashBrand /></Link>}
          items={appNav(26)}
          activeKey={active}
          footer={<div>{paid ? <ShopQrPromo /> : <PartnerPlanCard />}<LegalLinks /></div>}
        />
      }
      mobileTabBar={focus ? undefined : <MobileTabBar items={appNav(28)} activeKey={active ?? ""} />}
      mainClassName={focus ? "w-full min-w-0 pb-0" : "w-full min-w-0"}
    >
      {children}
    </AppShell>
  );
}
