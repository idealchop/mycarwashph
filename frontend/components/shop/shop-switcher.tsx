"use client";

import { LocationSwitcher } from "@/components/shop/location-switcher";
import { currentShop } from "@/lib/shop";
import { useShop } from "@/lib/shop-context";

const area = (b: { location?: { formattedAddress: string | null } | null; address?: string | null }) =>
  (b.location?.formattedAddress || b.address || "").split(",").slice(-2).join(",").trim() || undefined;

/** Header location dropdown (Barbers.ph LocationSwitcher) wired to Mycarwash's shop switching (currentShop + reload). */
export function ShopSwitcher({ className = "", fallback = null }: { className?: string; fallback?: React.ReactNode }) {
  const { me, shop, reload } = useShop();
  const shops = me?.businesses ?? [];
  if (!shop || !shops.length) return <>{fallback}</>;
  return (
    <LocationSwitcher
      value={shop.id}
      label={shop.name}
      options={shops.map((b) => ({ id: b.id, name: b.name, sub: area(b) }))}
      onChange={(id) => { if (id !== shop.id) { currentShop.set(id); reload(); } }}
      className={className}
    />
  );
}
