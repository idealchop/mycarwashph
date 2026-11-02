import type { NavItem } from "@river-apps/ui";
import { NavIcon3D, type Nav3DName } from "@/components/nav-icon";

const BASE: { key: string; label: string; href: string; icon: Nav3DName }[] = [
  { key: "home", label: "Home", href: "/home", icon: "home" },
  { key: "queue", label: "Queue", href: "/queue", icon: "queue" },
  { key: "moments", label: "Moments", href: "/moments", icon: "moments" },
];

/** Partner and Paid share the same three places, with the River 3D icons. */
export function appNav(activeKey: string | undefined, size: number, staff = false): NavItem[] {
  // Staff (Barbers.ph staff view): only Home and Queue.
  return BASE.filter((it) => !staff || it.key !== "moments").map((it) => ({ key: it.key, label: it.label, href: it.href, icon: <NavIcon3D name={it.icon} size={size} active={it.key === activeKey} /> }));
}

/** Owner-only areas: staff see an "Owner only" note instead (queue + walk-ins only for staff). */
const STAFF_OK = ["/home", "/queue", "/scan", "/account", "/settings/install", "/join"];
export const staffBlocked = (pathname: string) =>
  pathname !== "/" && !STAFF_OK.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function activeKeyFor(pathname: string): string | undefined {
  if (pathname === "/queue" || pathname.startsWith("/queue/")) return "queue";
  if (pathname === "/moments" || pathname.startsWith("/moments/")) return "moments";
  if (pathname === "/home" || pathname === "/") return "home";
  return undefined;
}
