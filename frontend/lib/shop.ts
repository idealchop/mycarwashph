"use client";

import type { IconName } from "@river-apps/icons";
import type { Service } from "./api";

const KEY = "mcw.businessId";

/** Remembers which shop the user is working in (for multi-shop owners). */
export const currentShop = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(KEY)),
  set: (id: string) => window.localStorage.setItem(KEY, id),
};

/** Picks a 3D icon for a service name. */
export function serviceIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes("detail") || n.includes("wax")) return "sparkle";
  if (n.includes("vacuum") || n.includes("interior")) return "vacuum";
  if (n.includes("tire") || n.includes("tyre")) return "tyre";
  return "bubbles";
}

export function serviceNames(ids: string[], services: Service[]) {
  return ids.map((id) => services.find((s) => s.id === id)?.name ?? "Service").join(" + ");
}

export function bookingPrice(ids: string[], size: string, services: Service[]) {
  let total = 0;
  for (const id of ids) {
    const p = services.find((s) => s.id === id)?.pricesBySize?.[size];
    if (p == null) return null;
    total += p;
  }
  return total;
}
