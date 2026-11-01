"use client";

import { Art } from "@/components/river-icon";
import { InstallPanel } from "@/components/pwa/install-panel";
import { PageBack } from "@/components/shop/page-back";

const FEATURES = [
  { art: <Art name="carwash" size={30} />, text: "Run your carwash from your phone" },
  { art: <Art name="queue" size={30} />, text: "Take walk-ins and River Mobile bookings" },
  { art: <Art name="coin" size={30} />, text: "Track sales, Cash and GCash, and your bays" },
];

/** Settings › Install app: Mycarwash on the owner's home screen (opens /home). Same layout as Barbers.ph. */
export function InstallScreen() {
  return (
    <main className="mx-auto w-full max-w-[460px] px-4 pb-10 pt-4">
      <PageBack fallback="/account" />
      <InstallPanel features={FEATURES} />
    </main>
  );
}
