"use client";

import Link from "next/link";
import { CarIllustration } from "@river-apps/icons";
import { AppShell, Button, MobileTabBar, Sidebar } from "@river-apps/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MycarwashBrand } from "@/components/brand";
import { NavIcon3D } from "@/components/nav-icon";
import { PAID_TABS, PARTNER_TABS } from "@/components/home/common";


const NAV = [
  { key: "dashboard", label: "Dashboard", icon: <NavIcon3D name="house" />, href: "/home", match: ["/home"], plans: ["partner", "paid"] as const },
  { key: "queue", label: "Queue", icon: <NavIcon3D name="ticket" />, href: "/queue", match: ["/queue"], plans: ["paid"] as const },
  { key: "bookings", label: "Bookings", icon: <NavIcon3D name="calendar" />, href: "/bookings", match: ["/bookings"], plans: ["partner", "paid"] as const },
  { key: "sales", label: "Sales", icon: <NavIcon3D name="cash" />, href: "/sales", match: ["/sales"], plans: ["paid"] as const },
  { key: "customers", label: "Customers", icon: <NavIcon3D name="people" />, href: "/customers", match: ["/customers"], plans: ["paid"] as const },
  { key: "messages", label: "Messages", icon: <NavIcon3D name="chat" />, href: "/messages", match: ["/messages"], plans: ["partner", "paid"] as const },
  { key: "growth", label: "Growth", icon: <NavIcon3D name="sparkle" />, href: "/growth", match: ["/growth"], plans: ["partner", "paid"] as const },
  { key: "settings", label: "Settings", icon: <NavIcon3D name="sliders" />, href: "/settings", match: ["/settings"], plans: ["partner", "paid"] as const },
] as const;

export function ShopShell({
  children,
  newBookings = 0,
  waiting = 0,
  mobileTab = "home",
  plan = "paid",
}: {
  children: ReactNode;
  newBookings?: number;
  waiting?: number;
  mobileTab?: string;
  plan?: "partner" | "paid";
}) {
  const path = usePathname();
  const nav = NAV.filter((n) => (n.plans as readonly string[]).includes(plan));
  const active = nav.find((n) => n.match.some((m) => path === m || path.startsWith(m + "/")))?.key ?? "dashboard";
  const items = nav.map((n) => ({
    key: n.key,
    label: n.label,
    icon: n.icon,
    href: n.href,
    badge: n.key === "queue" ? waiting || undefined : n.key === "bookings" ? newBookings || undefined : undefined,
  }));
  const tabs = (plan === "partner" ? PARTNER_TABS : PAID_TABS).map((t) => {
    const href =
      t.key === "home" ? "/home"
        : t.key === "queue" ? "/queue"
          : t.key === "sales" ? "/sales"
            : t.key === "bookings" || t.key === "history" ? "/bookings"
              : t.key === "shop" || t.key === "more" ? "/settings"
                : undefined;
    return { ...t, href };
  });

  return (
    <AppShell
      sidebar={
        <Sidebar
          className="sticky top-0 h-dvh"
          brand={<MycarwashBrand />}
          items={[...items]}
          activeKey={active}
          secondaryItems={[{ key: "help", label: "Help", icon: <NavIcon3D name="document" /> }]}
          footer={
            <div className="relative rounded-[22px] bg-grey-100 px-4 pb-5 pt-[78px]">
              <div className="absolute inset-x-0 -top-9 flex justify-center"><CarIllustration size={180} /></div>
              <b className="block text-[14.5px]">River Mobile bookings</b>
              <small className="mb-3.5 mt-1 block text-[12.5px] font-semibold text-ink/55">{newBookings} new to review</small>
              <Button size="sm" fullWidth href="/bookings">View bookings</Button>
              <div className="mt-3 flex justify-center gap-3 text-[11.5px] font-semibold text-ink/55">
                <Link href="/terms" className="hover:text-ink hover:underline">Terms</Link>
                <Link href="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
              </div>
            </div>
          }
        />
      }
      mobileTabBar={<MobileTabBar items={tabs} activeKey={mobileTab} />}
      mainClassName="w-full min-w-0"
    >
      {children}
    </AppShell>
  );
}
