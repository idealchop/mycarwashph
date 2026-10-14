"use client";

import { Avatar, IconButton, Topbar } from "@river-apps/ui";
import { Bell, LogOut } from "lucide-react";
import { NavIcon3D } from "@/components/nav-icon";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { greeting } from "@/lib/format";


// Only Home and Scan are wired in Phase 0; the other tabs land in Phase 1/2.
export const PARTNER_TABS = [
  { key: "home", label: "Home", icon: <NavIcon3D name="house" />, href: "/home" },
  { key: "bookings", label: "Bookings", icon: <NavIcon3D name="calendar" />, href: "/bookings" },
  { key: "history", label: "History", icon: <NavIcon3D name="receipt" />, href: "/bookings" },
  { key: "shop", label: "Shop", icon: <NavIcon3D name="car" />, href: "/settings" },
];

export const PAID_TABS = [
  { key: "home", label: "Home", icon: <NavIcon3D name="house" />, href: "/home" },
  { key: "queue", label: "Queue", icon: <NavIcon3D name="ticket" />, href: "/queue" },
  { key: "sales", label: "Sales", icon: <NavIcon3D name="cash" />, href: "/sales" },
  { key: "more", label: "More", icon: <NavIcon3D name="sliders" />, href: "/settings" },
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
