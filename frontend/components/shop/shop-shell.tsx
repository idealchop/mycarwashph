"use client";

import { CarIllustration } from "@river-apps/icons";
import { AppShell, Button, MobileTabBar, Sidebar } from "@river-apps/ui";
import {
  Calendar, ChartColumn, CircleHelp, LayoutGrid, List, MessageSquare, Settings, TrendingUp, Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MycarwashBrand } from "@/components/brand";
import { PAID_TABS, PARTNER_TABS } from "@/components/home/common";

const ic = { size: 20, strokeWidth: 1.75 } as const;

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutGrid {...ic} />, href: "/home", match: ["/home"], plans: ["partner", "paid"] as const },
  { key: "queue", label: "Queue", icon: <List {...ic} />, href: "/queue", match: ["/queue"], plans: ["paid"] as const },
  { key: "bookings", label: "Bookings", icon: <Calendar {...ic} />, href: "/bookings", match: ["/bookings"], plans: ["partner", "paid"] as const },
  { key: "sales", label: "Sales", icon: <ChartColumn {...ic} />, href: "/sales", match: ["/sales"], plans: ["paid"] as const },
  { key: "customers", label: "Customers", icon: <Users {...ic} />, href: "/customers", match: ["/customers"], plans: ["paid"] as const },
  { key: "messages", label: "Messages", icon: <MessageSquare {...ic} />, href: "/messages", match: ["/messages"], plans: ["partner", "paid"] as const },
  { key: "growth", label: "Growth", icon: <TrendingUp {...ic} />, href: "/growth", match: ["/growth"], plans: ["partner", "paid"] as const },
  { key: "settings", label: "Settings", icon: <Settings {...ic} />, href: "/settings", match: ["/settings"], plans: ["partner", "paid"] as const },
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
          secondaryItems={[{ key: "help", label: "Help", icon: <CircleHelp {...ic} /> }]}
          footer={
            <div className="relative rounded-[22px] bg-grey-100 px-4 pb-5 pt-[78px]">
              <div className="absolute inset-x-0 -top-9 flex justify-center"><CarIllustration size={180} /></div>
              <b className="block text-[14.5px]">River Mobile bookings</b>
              <small className="mb-3.5 mt-1 block text-[12.5px] font-semibold text-ink/55">{newBookings} new to review</small>
              <Button size="sm" fullWidth href="/bookings">View bookings</Button>
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
