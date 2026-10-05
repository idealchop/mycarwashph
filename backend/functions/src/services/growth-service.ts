import { manilaDayKey } from "../lib/time.js";
import type { Booking, QueueItem, Sale } from "../models/types.js";
import type { DocStore } from "../store/doc-store.js";
import { paths } from "./paths.js";

/** Simple, grounded growth metrics from live shop data (no invented AI). */
export async function growthMetrics(store: DocStore, businessId: string, now: Date) {
  const dayKey = manilaDayKey(now);
  const [bookings, queue, sales] = await Promise.all([
    store.list<Booking>(paths.bookings(businessId), { orderBy: { field: "createdAt", direction: "desc" }, limit: 200 }),
    store.list<QueueItem>(paths.queue(businessId), { where: [["queueDate", "==", dayKey]] }),
    store.list<Sale>(paths.sales(businessId), { orderBy: { field: "paidAt", direction: "desc" }, limit: 200 }),
  ]);
  const recorded = sales.filter((s) => s.status === "recorded");
  const todaySales = recorded.filter((s) => manilaDayKey(new Date(s.paidAt)) === dayKey);
  const requested = bookings.filter((b) => b.status === "requested").length;
  const acceptedToday = bookings.filter(
    (b) => b.status === "accepted" || ["checked_in", "queued", "in_bay", "done", "paid", "closed", "completed"].includes(b.status),
  ).length;
  return {
    date: dayKey,
    bookingsRequestedOpen: requested,
    bookingsAcceptedOrBeyond: acceptedToday,
    queueToday: queue.length,
    carsWashedToday: todaySales.length,
    salesTodayCentavos: todaySales.reduce((t, s) => t + s.amountCentavos, 0),
    salesLast200Centavos: recorded.reduce((t, s) => t + s.amountCentavos, 0),
    comingSoon: ["AI tips grounded in your shop data", "Campaigns to past customers"],
  };
}
