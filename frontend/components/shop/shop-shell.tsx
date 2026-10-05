"use client";

import { CarIllustration } from "@river-apps/icons";
import { AppShell, Button, MobileTabBar, Sidebar } from "@river-apps/ui";
import {
  Calendar, ChartColumn, CircleHelp, LayoutGrid, List, MessageSquare, Settings, TrendingUp, Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MycarwashBrand } from "@/components/brand";
import { PAID_TABS } from "@/components/home/common";

const ic = { size: 20, strokeWidth: 1.75 } as const;

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutGrid {...ic} />, href: "/home", match: ["/home"] },
  { key: "queue", label: "Queue", icon: <List {...ic} />, href: "/queue", match: ["/queue"] },
  { key: "bookings", label: "Bookings", icon: <Calendar {...ic} />, href: "/bookings", match: ["/bookings"] },
  { key: "sales", label: "Sales", icon: <ChartColumn {...ic} />, href: "/sales", match: ["/sales"] },
  { key: "customers", label: "Customers", icon: <Users {...ic} />, href: "/customers", match: ["/customers"] },
  { key: "messages", label: "Messages", icon: <MessageSquare {...ic} />, href: "/messages", match: ["/messages"] },
  { key: "growth", label: "Growth", icon: <TrendingUp {...ic} />, href: "/growth", match: ["/growth"] },
  { key: "settings", label: "Settings", icon: <Settings {...ic} />, href: "/settings", match: ["/settings"] },
] as const;

export function ShopShell({
  children,
  newBookings = 0,
  waiting = 0,
  mobileTab = "home",
}: {
  children: ReactNode;
  newBookings?: number;
  waiting?: number;
  mobileTab?: string;
}) {
  const path = usePathname();
  const active = NAV.find((n) => n.match.some((m) => path === m || path.startsWith(m + "/")))?.key ?? "dashboard";
  const items = NAV.map((n) => ({
    ...n,
    badge: n.key === "queue" ? waiting || undefined : n.key === "bookings" ? newBookings || undefined : undefined,
  }));
  const tabs = PAID_TABS.map((t) => {
    const href = t.key === "home" ? "/home" : t.key === "queue" ? "/queue" : t.key === "sales" ? "/sales" : t.key === "more" ? "/settings" : undefined;
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
            <div className="relative rounded-[22px] bg-grey-100 px-4 pb-4 pt-[66px]">
              <div className="absolute inset-x-1 -top-7 flex justify-center"><CarIllustration size={200} /></div>
              <b className="block text-[14.5px]">River Mobile bookings</b>
              <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">{newBookings} new to review</small>
              <Button size="sm" fullWidth href="/bookings">View bookings</Button>
            </div>
          }
        />
      }
      mobileTabBar={<MobileTabBar items={tabs} activeKey={mobileTab} />}
      mainClassName="lg:px-[30px] lg:pt-6"
    >
      {children}
    </AppShell>
  );
}
