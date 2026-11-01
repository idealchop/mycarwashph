import type { Metadata } from "next";
import { PageBack } from "@/components/shop/page-back";

export const metadata: Metadata = { title: "Map credits" };

/** Map attribution (Barbers.ph Settings › Map credits). */
export default function MapCreditsPage() {
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-10 pt-4 lg:max-w-[720px]">
      <div className="flex items-center gap-1">
        <PageBack fallback="/account" />
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Map credits</h1>
      </div>
      <div className="mt-4 space-y-3 rounded-card bg-surface px-4 py-4 text-[14px] font-medium leading-relaxed shadow-card">
        <p><b>River Maps</b> by River Apps: self-hosted Philippine map tiles (PMTiles) rendered with MapLibre GL.</p>
        <p>Map data © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, available under the Open Database License (ODbL).</p>
        <p>Tiles built with Protomaps / Planetiler. Address search by River Maps geocoding.</p>
      </div>
    </div>
  );
}
