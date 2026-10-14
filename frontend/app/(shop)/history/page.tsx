"use client";

import { BookingList } from "@/components/bookings/booking-list";
import { ShopPage } from "@/components/shop/page";

/** Every River Mobile booking for the shop, newest first. */
export default function HistoryPage() {
  return (
    <ShopPage
      title="History"
      subtitle="River Mobile bookings"
      back="/home"
      icon="shield"
      empty={{ title: "No bookings yet", description: "Bookings from River Mobile show up here once your shop is set up and listed." }}
    >
      {(s) => (
        <BookingList
          shopId={s.id}
          plan={s.plan}
          emptyTitle="No bookings yet"
          emptyDescription="Turn on “List on River Mobile” in Account → Edit shop so customers can book you."
        />
      )}
    </ShopPage>
  );
}
