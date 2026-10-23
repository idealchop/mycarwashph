"use client";

import { useCallback, useEffect, useState } from "react";
import type { Service } from "@/lib/api";

export interface PublicShop {
  id: string;
  name: string;
  address: string | null;
  phoneE164: string | null;
  hours: string | null;
  photoUrls: string[];
  logoUrl: string | null;
  services: Service[];
  onlineCheckout: boolean;
}

export interface Ticket {
  bookingId: string;
  reference: string;
  status: string;
  stage: "sent" | "accepted" | "in_bay" | "done" | "closed";
  queueNumber: number | null;
  vehicleSize: string;
  scheduledStart: string;
  lines: { name: string; priceCentavos: number }[];
  totalCentavos: number;
  payPref: "shop" | "online";
  paid: boolean;
  createdAt: string;
}

/** What the customer keeps on the phone so they can always get back to the ticket. */
export interface SavedTicket { bookingId: string; token: string; qrPayload: string; code: string }
const key = (shopId: string) => `mcw.ticket.${shopId}`;
export const tickets = {
  get(shopId: string): SavedTicket | null { try { const v = localStorage.getItem(key(shopId)); return v ? (JSON.parse(v) as SavedTicket) : null; } catch { return null; } },
  set(shopId: string, t: SavedTicket) { try { localStorage.setItem(key(shopId), JSON.stringify(t)); } catch { /* private mode */ } },
  clear(shopId: string) { try { localStorage.removeItem(key(shopId)); } catch { /* ignore */ } },
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.title ?? "Something went wrong."), { status: res.status });
  return (json as { data: T }).data;
}

export const publicApi = {
  shop: (shopId: string) => call<PublicShop>(`/public/shops/${encodeURIComponent(shopId)}`),
  book: (shopId: string, body: unknown) => call<{ bookingId: string; reference: string; token: string; checkIn: { code: string; qrPayload: string }; ticket: Ticket }>(`/public/shops/${encodeURIComponent(shopId)}/bookings`, { method: "POST", body: JSON.stringify(body) }),
  ticket: (shopId: string, t: SavedTicket) => call<Ticket>(`/public/shops/${encodeURIComponent(shopId)}/bookings/${encodeURIComponent(t.bookingId)}?t=${encodeURIComponent(t.token)}`),
};

/** undefined = loading, null = not found. */
export function usePublicShop(shopId: string) {
  const [shop, setShop] = useState<PublicShop | null | undefined>(undefined);
  useEffect(() => {
    if (!shopId) return;
    let live = true;
    publicApi.shop(shopId).then((s) => live && setShop(s), () => live && setShop(null));
    return () => { live = false; };
  }, [shopId]);
  return shop;
}

/** Live ticket: polls every 5s while the request is open. */
export function useTicket(shopId: string, saved: SavedTicket | null) {
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const load = useCallback(() => {
    if (!saved) return Promise.resolve();
    return publicApi.ticket(shopId, saved).then(setTicket, (e: { status?: number }) => { if (e.status === 404) setTicket(null); });
  }, [shopId, saved]);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5000);
    return () => window.clearInterval(t);
  }, [load]);
  return ticket;
}
