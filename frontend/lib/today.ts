"use client";

import { hasPaidFeatures } from "@/lib/plan-gating";

import { publishWalkIns, type WalkInAllowance } from "./walkin-limit";
import { useMemo } from "react";
import { api, type Bay, type Booking, type MeResponse, type QueueItem, type SalesSummary, type Service } from "./api";
import { dayKeyPHT } from "./format";
import { useLoad } from "./use-load";

type Shop = MeResponse["businesses"][number];

/**
 * One car on today's board. Mirrors Barbers.ph `ChairRequest`: online rows are
 * River Mobile bookings, walk-in rows are queue items added at the counter.
 */
export type Job = {
  id: string;
  kind: "booking" | "queue";
  channel: "online" | "walk-in";
  /** requested → accepted → in_bay → done (→ paid) ; declined is hidden. */
  status: "requested" | "accepted" | "in_bay" | "done" | "paid" | "declined";
  ref: string;
  who: string;
  serviceName: string;
  slotLabel: string;
  bayName: string | null;
  price: number;
  paid: boolean;
  createdAt: string;
  booking?: Booking;
  queue?: QueueItem;
};

const priceOf = (ids: string[], size: string | null | undefined, services: Service[]) =>
  services.filter((s) => ids.includes(s.id)).reduce((t, s) => t + (s.pricesBySize?.[size ?? "medium"] ?? s.pricesBySize?.medium ?? 0), 0);
const namesOf = (ids: string[], services: Service[]) =>
  services.filter((s) => ids.includes(s.id)).map((s) => s.name).join(" · ") || "Car wash";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** Today's board for a shop: bookings + queue, bays, and sales, as Barbers.ph rows. */
export function useToday(shop: Shop | null) {
  const paid = hasPaidFeatures(shop);
  const { data, error, reload } = useLoad(async () => {
    if (!shop) return null;
    const [bookings, services, queueRes, bays, summary] = await Promise.all([
      api<{ data: Booking[] }>(`/businesses/${shop.id}/bookings`).then((r) => r.data),
      api<{ data: Service[] }>(`/businesses/${shop.id}/services`).then((r) => r.data),
      api<{ data: QueueItem[]; walkIns?: WalkInAllowance }>(`/businesses/${shop.id}/queue`),
      paid ? api<{ data: Bay[] }>(`/businesses/${shop.id}/bays`).then((r) => r.data) : Promise.resolve([] as Bay[]),
      paid ? api<{ data: SalesSummary }>(`/businesses/${shop.id}/sales/summary`).then((r) => r.data) : Promise.resolve(null),
    ]);
    if (queueRes.walkIns) publishWalkIns(shop.id, queueRes.walkIns);
    return { bookings, services, queue: queueRes.data, bays, summary };
  }, shop ? `today-${shop.id}-${shop.plan}` : "today-none");

  return useMemo(() => {
    if (!data) return { ready: !shop, error, reload, jobs: [] as Job[], bays: [] as Bay[], services: [] as Service[], summary: null as SalesSummary | null };
    const today = dayKeyPHT(new Date());
    const queuedBookingIds = new Set(data.queue.map((q) => q.bookingId).filter(Boolean));
    const bayName = (id: string | null) => data.bays.find((b) => b.id === id)?.name ?? null;
    const jobs: Job[] = [];
    for (const b of data.bookings) {
      if (queuedBookingIds.has(b.id)) continue;
      // Only open bookings belong on the queue. Terminal statuses (paid, no_show, cancelled, declined) stay in History / Sales.
      if (!["requested", "accepted", "queued", "checked_in", "in_bay", "done", "completed"].includes(b.status)) continue;
      const status: Job["status"] =
        b.status === "requested" ? "requested"
          : b.status === "accepted" || b.status === "queued" ? "accepted"
            : b.status === "checked_in" || b.status === "in_bay" ? "in_bay"
              : "done";
      if (status !== "requested" && status !== "accepted" && dayKeyPHT(new Date(b.scheduledStart)) !== today) continue;
      jobs.push({
        id: b.id, kind: "booking", channel: "online", status, ref: b.reference, who: b.customerSnapshot.name,
        serviceName: namesOf(b.serviceIds, data.services), slotLabel: time(b.scheduledStart), bayName: null,
        price: priceOf(b.serviceIds, b.vehicleSize, data.services), paid: false, createdAt: b.scheduledStart, booking: b,
      });
    }
    for (const q of data.queue) {
      const status: Job["status"] = q.status === "queued" ? "accepted" : q.status === "in_bay" ? "in_bay" : q.status === "done" ? "done" : q.status === "cancelled" ? "declined" : "paid";
      jobs.push({
        id: q.id, kind: "queue", channel: q.source === "booking" ? "online" : "walk-in", status,
        ref: `#${q.queueNumber}`, who: q.customerName?.trim() || "Walk-in",
        serviceName: q.lines?.length ? q.lines.map((l) => l.name).join(" · ") : namesOf(q.serviceIds, data.services),
        slotLabel: time(q.createdAt), bayName: bayName(q.bayId), price: q.totalCentavos ?? priceOf(q.serviceIds, q.vehicleSize, data.services),
        paid: q.status === "paid" || q.status === "closed", createdAt: q.createdAt, queue: q,
      });
    }
    jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ready: true, error, reload, jobs, bays: data.bays, services: data.services, summary: data.summary };
  }, [data, error, reload, shop]);
}

export function figures(jobs: Job[], summary: SalesSummary | null) {
  const live = jobs.filter((j) => j.status !== "declined");
  return {
    sales: summary?.totalCentavos ?? 0,
    cars: summary?.cars ?? live.filter((j) => j.status === "done" || j.status === "paid").length,
    toAccept: live.filter((j) => j.status === "requested" || (j.status === "accepted" && j.kind === "booking")).length,
    inBay: live.filter((j) => j.status === "in_bay").length,
    waiting: live.filter((j) => j.status === "accepted" && j.kind === "queue").length,
    done: live.filter((j) => j.status === "done" || j.status === "paid").length,
    unpaid: live.filter((j) => j.status === "done" && !j.paid).reduce((t, j) => t + j.price, 0),
  };
}

/** Actions shared by Home and Queue. */
export async function acceptJob(shopId: string, j: Job) {
  if (j.kind === "booking") await api(`/businesses/${shopId}/bookings/${j.id}/accept`, { method: "POST" });
}
export async function declineJob(shopId: string, j: Job) {
  if (j.kind === "booking") await api(`/businesses/${shopId}/bookings/${j.id}/decline`, { method: "POST" });
}
/** Starts a queued car, in a bay when there is one (Partner shops have no bays). */
export async function startJob(shopId: string, j: Job, bayId: string | null) {
  if (j.kind === "queue") await api(`/businesses/${shopId}/queue/${j.id}`, { method: "PATCH", body: { status: "in_bay", bayId } });
}
export async function doneJob(shopId: string, j: Job) {
  if (j.kind === "queue") await api(`/businesses/${shopId}/queue/${j.id}`, { method: "PATCH", body: { status: "done" } });
  else await api(`/businesses/${shopId}/bookings/${j.id}/complete`, { method: "POST" });
}
export async function payJob(shopId: string, j: Job, amountCentavos: number, method: string, paymentRef: string | null) {
  await api(`/businesses/${shopId}/queue/${j.id}`, { method: "PATCH", body: { status: "paid", sale: { amountCentavos, method, paymentRef } } });
}
