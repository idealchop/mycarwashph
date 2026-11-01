import type { NavItem } from "@river-apps/ui";
import { NavIcon3D, type Nav3DName } from "@/components/nav-icon";

const BASE: { key: string; label: string; href: string; icon: Nav3DName }[] = [
  { key: "home", label: "Home", href: "/home", icon: "home" },
  { key: "queue", label: "Queue", href: "/queue", icon: "queue" },
  { key: "moments", label: "Moments", href: "/moments", icon: "moments" },
];

/** Partner and Paid share the same three places, with the River 3D icons. */
export function appNav(size: number): NavItem[] {
  return BASE.map((it) => ({ key: it.key, label: it.label, href: it.href, icon: <NavIcon3D name={it.icon} size={size} /> }));
}

export function activeKeyFor(pathname: string): string | undefined {
  if (pathname === "/queue" || pathname.startsWith("/queue/")) return "queue";
  if (pathname === "/moments" || pathname.startsWith("/moments/")) return "moments";
  if (pathname === "/home" || pathname === "/") return "home";
  return undefined;
}
