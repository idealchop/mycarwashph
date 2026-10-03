"use client";

import { api, type MeResponse } from "./api";
import { currentShop } from "./shop";
import { useLoad } from "./use-load";

/** Loads /me and resolves the current shop (remembered per device). */
export function useMe() {
  const { data: me, error, reload } = useLoad(() => api<MeResponse>("/me"), "me");
  const saved = currentShop.get();
  const shop = me?.businesses.find((b) => b.id === saved) ?? me?.businesses[0] ?? null;
  return { me, shop, error, reload };
}
