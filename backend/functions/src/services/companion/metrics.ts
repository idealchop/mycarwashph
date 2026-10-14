import { brand } from "../../config/brand.js";
import type { Bay, Booking, QueueItem, Sale, Service } from "../../models/types.js";
import type { Doc } from "../../store/doc-store.js";
import { manilaDayKey } from "../../lib/time.js";

/**
 * Pure aggregation for AI Insights. Input is the shop's raw docs; output is
 * aggregates ONLY: no customer names, phones, plates or ids ever leave this
 * module. Plates are used in memory to tell repeat from new customers and are
 * dropped before the snapshot is built.
 */

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface InsightsInput {
  now: Date;
  sales: Doc<Sale>[];
  queue: Doc<QueueItem>[];
  bookings: Doc<Booking>[];
  services: Doc<Service>[];
  bays: Doc<Bay>[];
}

export interface WindowMetrics {
  days: number;
  revenuePesos: number;
  /** Change vs the window before it, percent (null when there is no prior data). */
  revenueChangePct: number | null;
  carsServed: number;
  avgTicketPesos: number;
  walkIns: number;
  bookings: number;
  bookingsFromRiverMobile: number;
  noShows: number;
  cancelledOrDeclined: number;
  noShowRatePct: number | null;
  repeatCustomers: number;
  newCustomers: number;
  repeatSharePct: number | null;
}

export interface MetricsSnapshot {
  generatedFor: { from: string; to: string; timeZone: string };
  last7: WindowMetrics;
  last28: WindowMetrics;
  busiestDays: { day: string; cars: number }[];
  busiestHours: { hour: string; cars: number }[];
  topServices: { name: string; cars: number; revenuePesos: number; sharePct: number }[];
  vehicleSizeMix: { size: string; sharePct: number }[];
  carsPerHour: { average: number; peak: number; peakSlot: string | null };
  queue: { peakWaiting: number; peakSlot: string | null; avgWaitMins: number | null; avgServiceMins: number | null };
  bays: { name: string; cars: number; revenuePesos: number; avgServiceMins: number | null }[];
  paymentMix: { method: string; sharePct: number }[];
  dataDays: number;
}

const manila = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: brand.timeZone, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return { weekday, hour };
};

export const manilaClock = manila;
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const pesos = (centavos: number) => Math.round(centavos / 100);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

const NO_SHOW = new Set(["no_show"]);
const CANCELLED = new Set(["cancelled", "declined"]);

function windowMetrics(input: InsightsInput, days: number, firstSeen: Map<string, number>): WindowMetrics {
  const end = input.now.getTime();
  const start = end - days * DAY;
  const prevStart = start - days * DAY;
  const inWin = (ms: number, a: number, b: number) => ms >= a && ms < b;
  const recorded = input.sales.filter((s) => s.status === "recorded");
  const sales = recorded.filter((s) => inWin(t(s.paidAt), start, end));
  const prevSales = recorded.filter((s) => inWin(t(s.paidAt), prevStart, start));
  const revenue = sales.reduce((a, s) => a + s.amountCentavos, 0);
  const prevRevenue = prevSales.reduce((a, s) => a + s.amountCentavos, 0);
  const queue = input.queue.filter((q) => q.status !== "cancelled" && inWin(t(q.createdAt), start, end));
  const bookings = input.bookings.filter((b) => inWin(t(b.scheduledStart), start, end));
  const noShows = bookings.filter((b) => NO_SHOW.has(b.status)).length;
  const cancelled = bookings.filter((b) => CANCELLED.has(b.status)).length;
  const closedBookings = bookings.filter((b) => !["requested", "accepted"].includes(b.status)).length;

  const visitsByPlate = new Map<string, number>();
  for (const v of sales.length ? sales.map((s) => s.plate) : queue.map((q) => q.plate)) {
    if (!v) continue;
    visitsByPlate.set(v, (visitsByPlate.get(v) ?? 0) + 1);
  }
  let repeat = 0;
  let fresh = 0;
  for (const [plate, visits] of visitsByPlate) {
    const first = firstSeen.get(plate) ?? start;
    if (visits > 1 || first < start) repeat++;
    else fresh++;
  }
  const cars = sales.length || queue.filter((q) => ["done", "paid", "closed"].includes(q.status)).length;
  return {
    days,
    revenuePesos: pesos(revenue),
    revenueChangePct: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null,
    carsServed: cars,
    avgTicketPesos: sales.length ? pesos(revenue / sales.length) : 0,
    walkIns: queue.filter((q) => q.source !== "booking").length,
    bookings: bookings.length,
    bookingsFromRiverMobile: bookings.filter((b) => b.source === "river_mobile_api").length,
    noShows,
    cancelledOrDeclined: cancelled,
    noShowRatePct: pct(noShows, closedBookings),
    repeatCustomers: repeat,
    newCustomers: fresh,
    repeatSharePct: pct(repeat, repeat + fresh),
  };
}

/** Builds the aggregates-only snapshot sent to Gemini and stored with the insight. */
export function computeMetrics(input: InsightsInput, spanDays = 28): MetricsSnapshot {
  const end = input.now.getTime();
  const start28 = end - spanDays * DAY;
  const recorded = input.sales.filter((s) => s.status === "recorded");
  const firstSeen = new Map<string, number>();
  const seen = [...recorded.map((s) => [s.plate, t(s.paidAt)] as const), ...input.queue.map((q) => [q.plate, t(q.createdAt)] as const)];
  for (const [plate, ms] of seen) {
    if (!plate || !Number.isFinite(ms)) continue;
    if (!firstSeen.has(plate) || ms < firstSeen.get(plate)!) firstSeen.set(plate, ms);
  }

  const sales28 = recorded.filter((s) => t(s.paidAt) >= start28 && t(s.paidAt) < end);
  const queue28 = input.queue.filter((q) => t(q.createdAt) >= start28 && t(q.createdAt) < end);
  const serviceName = new Map(input.services.map((s) => [s.id, s.name]));
  const bayName = new Map(input.bays.map((b) => [b.id, b.name]));

  // Busiest days / hours by cars served (sales), falling back to queue arrivals.
  const visits = sales28.length ? sales28.map((s) => t(s.paidAt)) : queue28.map((q) => t(q.createdAt));
  const byDay = new Map<string, number>();
  const byHour = new Map<number, number>();
  const bySlot = new Map<string, number>();
  for (const ms of visits) {
    const { weekday, hour } = manila(new Date(ms));
    byDay.set(weekday, (byDay.get(weekday) ?? 0) + 1);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    const slot = `${manilaDayKey(new Date(ms))}-${hour}|${weekday} ${hourLabel(hour)}`;
    bySlot.set(slot, (bySlot.get(slot) ?? 0) + 1);
  }
  const busiestDays = WEEKDAYS.map((day) => ({ day, cars: byDay.get(day) ?? 0 })).sort((a, b) => b.cars - a.cars);
  const busiestHours = [...byHour.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([h, cars]) => ({ hour: hourLabel(h), cars }));

  // Throughput: cars per active hour (hours with at least one car), and the peak hour.
  const slots = [...bySlot.entries()];
  const peak = slots.sort((a, b) => b[1] - a[1])[0];
  const carsPerHour = {
    average: slots.length ? round1(visits.length / slots.length) : 0,
    peak: peak ? peak[1] : 0,
    peakSlot: peak ? peak[0].split("|")[1]! : null,
  };

  // Service / package mix.
  const svc = new Map<string, { cars: number; revenue: number }>();
  for (const s of sales28) {
    const ids = s.serviceIds.length ? s.serviceIds : ["_other"];
    for (const id of ids) {
      const name = serviceName.get(id) ?? "Other";
      const row = svc.get(name) ?? { cars: 0, revenue: 0 };
      row.cars++;
      row.revenue += s.amountCentavos / ids.length;
      svc.set(name, row);
    }
  }
  const svcTotal = [...svc.values()].reduce((a, r) => a + r.cars, 0);
  const topServices = [...svc.entries()]
    .sort((a, b) => b[1].cars - a[1].cars)
    .slice(0, 6)
    .map(([name, r]) => ({ name, cars: r.cars, revenuePesos: pesos(r.revenue), sharePct: pct(r.cars, svcTotal) ?? 0 }));

  const sizeCount = new Map<string, number>();
  for (const s of sales28) if (s.vehicleSize) sizeCount.set(s.vehicleSize, (sizeCount.get(s.vehicleSize) ?? 0) + 1);
  const sizeTotal = [...sizeCount.values()].reduce((a, b) => a + b, 0);
  const vehicleSizeMix = [...sizeCount.entries()].sort((a, b) => b[1] - a[1]).map(([size, n]) => ({ size, sharePct: pct(n, sizeTotal) ?? 0 }));

  const payCount = new Map<string, number>();
  for (const s of sales28) payCount.set(s.method, (payCount.get(s.method) ?? 0) + 1);
  const paymentMix = [...payCount.entries()].sort((a, b) => b[1] - a[1]).map(([method, n]) => ({ method, sharePct: pct(n, sales28.length) ?? 0 }));

  // Queue: waiting = created -> started (in bay); peak concurrent waiting cars.
  const events: [number, number][] = [];
  const waits: number[] = [];
  const serviceMins: number[] = [];
  for (const q of queue28) {
    const created = t(q.createdAt);
    const started = t(q.startedAt);
    const done = t(q.doneAt);
    if (Number.isFinite(started) && started >= created) {
      waits.push((started - created) / 60_000);
      events.push([created, 1], [started, -1]);
    }
    if (Number.isFinite(started) && Number.isFinite(done) && done >= started) serviceMins.push((done - started) / 60_000);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peakWaiting = 0;
  let peakAt: number | null = null;
  for (const [ms, d] of events) {
    cur += d;
    if (cur > peakWaiting) {
      peakWaiting = cur;
      peakAt = ms;
    }
  }
  const peakM = peakAt !== null ? manila(new Date(peakAt)) : null;

  // Per bay.
  const saleByQueue = new Map(sales28.filter((s) => s.queueItemId).map((s) => [s.queueItemId!, s.amountCentavos]));
  const bayRows = new Map<string, { cars: number; revenue: number; mins: number[] }>();
  for (const q of queue28) {
    if (!q.bayId || q.status === "cancelled") continue;
    const name = bayName.get(q.bayId) ?? "Bay";
    const row = bayRows.get(name) ?? { cars: 0, revenue: 0, mins: [] };
    row.cars++;
    row.revenue += saleByQueue.get(q.id) ?? 0;
    const s = t(q.startedAt);
    const d = t(q.doneAt);
    if (Number.isFinite(s) && Number.isFinite(d) && d >= s) row.mins.push((d - s) / 60_000);
    bayRows.set(name, row);
  }
  const bays = [...bayRows.entries()]
    .sort((a, b) => b[1].cars - a[1].cars)
    .map(([name, r]) => ({ name, cars: r.cars, revenuePesos: pesos(r.revenue), avgServiceMins: avg(r.mins) }));

  const oldest = Math.min(...[...recorded.map((s) => t(s.paidAt)), ...input.queue.map((q) => t(q.createdAt))].filter(Number.isFinite), end);
  return {
    generatedFor: { from: new Date(start28).toISOString(), to: input.now.toISOString(), timeZone: brand.timeZone },
    last7: windowMetrics(input, 7, firstSeen),
    last28: windowMetrics(input, spanDays, firstSeen),
    busiestDays,
    busiestHours,
    topServices,
    vehicleSizeMix,
    carsPerHour,
    queue: {
      peakWaiting,
      peakSlot: peakM ? `${peakM.weekday} ${hourLabel(peakM.hour)}` : null,
      avgWaitMins: avg(waits),
      avgServiceMins: avg(serviceMins),
    },
    bays,
    paymentMix,
    dataDays: Math.min(spanDays, Math.max(0, Math.ceil((end - oldest) / DAY))),
  };
}

/** True when there is enough activity in the last 28 days to say anything useful. */
export function hasEnoughData(m: MetricsSnapshot): boolean {
  return m.last28.carsServed + m.last28.walkIns + m.last28.bookings >= 5;
}
