"use client";

import dynamic from "next/dynamic";

/** River Maps (MapLibre, ~1 MB) only loads on screens that show a map, and never on the server. */
export const ShopMap = dynamic(() => import("./shop-map-impl"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-grey-100" aria-label="Loading map" />,
});
