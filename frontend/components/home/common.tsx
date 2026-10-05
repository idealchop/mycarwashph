"use client";

import { Avatar, IconButton, Topbar } from "@river-apps/ui";
import { Bell, Calendar, ChartColumn, Ellipsis, History, House, List, LogOut, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { greeting } from "@/lib/format";

const tab = { size: 22, strokeWidth: 1.75 } as const;

// Only Home and Scan are wired in Phase 0; the other tabs land in Phase 1/2.
export const PARTNER_TABS = [
  { key: "home", label: "Home", icon: <House {...tab} />, href: "/home" },
  { key: "bookings", label: "Bookings", icon: <Calendar {...tab} />, href: "/bookings" },
  { key: "history", label: "History", icon: <History {...tab} />, href: "/bookings" },
  { key: "shop", label: "Shop", icon: <Store {...tab} />, href: "/settings" },
];

export const PAID_TABS = [
  { key: "home", label: "Home", icon: <House {...tab} />, href: "/home" },
  { key: "queue", label: "Queue", icon: <List {...tab} />, href: "/queue" },
  { key: "sales", label: "Sales", icon: <ChartColumn {...tab} />, href: "/sales" },
  { key: "more", label: "More", icon: <Ellipsis {...tab} />, href: "/settings" },
];

export function Greeting({ title, name, alerts = 0 }: { title: string; name: string; alerts?: number }) {
  const router = useRouter();
  return (
    <Topbar
      variant="greeting"
      leading={<Avatar name={name} preset="sky" size={44} />}
      eyebrow={greeting()}
      title={title}
      actions={
        <span className="flex gap-2">
          <IconButton variant="surface" label="Notifications" count={alerts || undefined} onClick={() => router.push("/messages")} icon={<Bell size={22} strokeWidth={1.75} />} />
          <IconButton variant="surface" label="Sign out" icon={<LogOut size={20} strokeWidth={1.75} />} onClick={() => signOut()} />
        </span>
      }
    />
  );
}

export function firstName(name: string | null | undefined, fallback = "there") {
  return name?.trim().split(/\s+/)[0] || fallback;
}
