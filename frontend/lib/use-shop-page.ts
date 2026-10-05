"use client";

import { useMemo } from "react";
import { api, type Booking, type MeResponse, type QueueItem } from "./api";
import { currentShop } from "./shop";
import { useLoad } from "./use-load";

/** Shared shop resolver + optional badge counts for sidebar. */
export function useShopPage() {
  const { data: me, error, reload } = useLoad(() => api<MeResponse>("/me"), "me");
  const saved = currentShop.get();
  const shop = me?.businesses.find((b) => b.id === saved) ?? me?.businesses[0] ?? null;
  const counts = useLoad(
    async () => {
      if (!shop) return { bookings: 0, waiting: 0 };
      const [bookings, queue] = await Promise.all([
        api<{ data: Booking[] }>(`/businesses/${shop.id}/bookings?status=requested`),
        shop.plan === "paid"
          ? api<{ data: QueueItem[] }>(`/businesses/${shop.id}/queue`)
          : Promise.resolve({ data: [] as QueueItem[] }),
      ]);
      return {
        bookings: bookings.data.length,
        waiting: queue.data.filter((q) => q.status === "queued").length,
      };
    },
    shop ? `counts-${shop.id}-${shop.plan}` : "counts-none",
  );
  return useMemo(
    () => ({ me, shop, error, reload, newBookings: counts.data?.bookings ?? 0, waiting: counts.data?.waiting ?? 0 }),
    [me, shop, error, reload, counts.data],
  );
}
