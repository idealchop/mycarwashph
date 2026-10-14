import type { Bay, Booking, Business, QueueItem, Sale, Service } from "../../models/types.js";
import type { Doc, DocStore } from "../../store/doc-store.js";
import { paths } from "../paths.js";
import { listMyBusinesses } from "../businesses-service.js";
import { goalProgress, listGoals, saveGoal } from "./goals.js";
import type { ToolDecl } from "./model.js";
import { asPeriod, PERIODS, rangeFor } from "./periods.js";

/**
 * Read-only view of one shop for the Companion (same approach as Barbers.ph data.ts): the raw
 * docs are loaded once per question and the tools count over them. Nothing here writes
 * business data; the only write is setGoal (companion/goals). Money is returned in pesos.
 */
export interface ShopData {
  now: Date;
  sales: Doc<Sale>[];
  queue: Doc<QueueItem>[];
  bookings: Doc<Booking>[];
  services: Doc<Service>[];
  bays: Doc<Bay>[];
}

export async function loadShopData(store: DocStore, businessId: string, now: Date): Promise<ShopData> {
  const [sales, queue, bookings, services, bays] = await Promise.all([
    store.list<Sale>(paths.sales(businessId), { orderBy: { field: "paidAt", direction: "desc" }, limit: 5000 }),
    store.list<QueueItem>(paths.queue(businessId), { orderBy: { field: "createdAt", direction: "desc" }, limit: 5000 }),
    store.list<Booking>(paths.bookings(businessId), { orderBy: { field: "scheduledStart", direction: "desc" }, limit: 3000 }),
    store.list<Service>(paths.services(businessId)),
    store.list<Bay>(paths.bays(businessId)),
  ]);
  return { now, sales, queue, bookings, services, bays };
}

const pesos = (c: number) => Math.round(c) / 100;
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const within = (iso: string | null | undefined, from: Date, to: Date) => {
  const t = ms(iso);
  // End is inclusive so a car added at this very moment counts in "today".
  return t >= from.getTime() && t <= to.getTime();
};
const tally = <T>(rows: T[], key: (r: T) => string) => rows.reduce<Record<string, number>>((m, r) => ((m[key(r)] = (m[key(r)] ?? 0) + 1), m), {});
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", ...opts }).format(new Date(iso));
const weekday = (iso: string) => fmt(iso, { weekday: "short" });
const hour = (iso: string) => fmt(iso, { hour: "numeric" });
const day = (iso: string) => fmt(iso, { weekday: "short", month: "short", day: "numeric" });

/** Every queue status, shown separately. A walk-in is any queue item not created from a booking. */
const QUEUE_KEYS = ["queued", "in_bay", "done", "paid", "closed", "cancelled"] as const;
const queueCounts = (rows: QueueItem[]) => {
  const out: Record<string, number> = Object.fromEntries(QUEUE_KEYS.map((k) => [k, 0]));
  for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
};
const SERVED_QUEUE = new Set(["done", "paid", "closed"]);
const SERVED_BOOKING = new Set(["completed", "done", "paid", "closed"]);

function priceOf(d: ShopData, ids: string[], size: string | null | undefined) {
  return ids.reduce((t, id) => {
    const s = d.services.find((x) => x.id === id);
    return t + (s?.pricesBySize?.[(size ?? "medium") as "medium"] ?? s?.pricesBySize?.medium ?? 0);
  }, 0);
}

/** A car that was actually washed: queue items done/paid/closed, completed bookings not in the queue, and sales without a queue item. */
interface Visit { at: string; serviceIds: string[]; size: string | null; who: string | null; bayId: string | null; startedAt: string | null; doneAt: string | null; centavos: number; paid: boolean }

function visits(d: ShopData, from: Date, to: Date): Visit[] {
  const saleByQueue = new Map(d.sales.filter((s) => s.status === "recorded" && s.queueItemId).map((s) => [s.queueItemId!, s]));
  const queueIds = new Set(d.queue.map((q) => q.id));
  const bookingInQueue = new Set(d.queue.map((q) => q.bookingId).filter(Boolean));
  const out: Visit[] = [];
  for (const q of d.queue) {
    if (!SERVED_QUEUE.has(q.status)) continue;
    const at = q.doneAt ?? q.updatedAt ?? q.createdAt;
    if (!within(at, from, to)) continue;
    const sale = saleByQueue.get(q.id);
    out.push({ at, serviceIds: q.serviceIds, size: q.vehicleSize, who: q.customerName?.trim().toLowerCase() || null, bayId: q.bayId, startedAt: q.startedAt, doneAt: q.doneAt, centavos: sale?.amountCentavos ?? priceOf(d, q.serviceIds, q.vehicleSize), paid: q.status !== "done" });
  }
  for (const b of d.bookings) {
    if (!SERVED_BOOKING.has(b.status) || bookingInQueue.has(b.id) || !within(b.updatedAt, from, to)) continue;
    out.push({ at: b.updatedAt, serviceIds: b.serviceIds, size: b.vehicleSize, who: (b.customerSnapshot?.phoneE164 || b.customerSnapshot?.name || "").trim().toLowerCase() || null, bayId: null, startedAt: null, doneAt: b.updatedAt, centavos: priceOf(d, b.serviceIds, b.vehicleSize), paid: b.status !== "completed" && b.status !== "done" });
  }
  for (const s of d.sales) {
    if (s.status !== "recorded" || (s.queueItemId && queueIds.has(s.queueItemId)) || !within(s.paidAt, from, to)) continue;
    out.push({ at: s.paidAt, serviceIds: s.serviceIds, size: s.vehicleSize, who: s.customerName?.trim().toLowerCase() || null, bayId: null, startedAt: null, doneAt: s.paidAt, centavos: s.amountCentavos, paid: true });
  }
  return out;
}

const periodOf = (args: Record<string, unknown>, now: Date) => rangeFor(asPeriod(args.period), now);

export function getSales(d: ShopData, args: Record<string, unknown>) {
  const r = periodOf(args, d.now);
  const prevFrom = new Date(r.from.getTime() - (r.to.getTime() - r.from.getTime()));
  const paidIn = (from: Date, to: Date) => d.sales.filter((s) => s.status === "recorded" && within(s.paidAt, from, to));
  const cur = paidIn(r.from, r.to), prev = paidIn(prevFrom, r.from);
  const sum = (xs: Sale[]) => pesos(xs.reduce((a, s) => a + s.amountCentavos, 0));
  const served = visits(d, r.from, r.to);
  const unpaid = served.filter((v) => !v.paid);
  const byDay: Record<string, { salesPhp: number; cars: number }> = {};
  for (const s of cur) { const k = day(s.paidAt); byDay[k] ??= { salesPhp: 0, cars: 0 }; byDay[k].salesPhp += pesos(s.amountCentavos); byDay[k].cars++; }
  const salesPhp = sum(cur);
  return {
    period: r.period, label: r.label,
    salesPhp, paidCars: cur.length, carsServed: served.length, avgTicketPhp: cur.length ? Math.round(salesPhp / cur.length) : 0,
    unpaidCars: unpaid.length, unpaidPhp: pesos(unpaid.reduce((a, v) => a + v.centavos, 0)),
    previousPeriodSalesPhp: sum(prev), previousPeriodPaidCars: prev.length,
    paymentMixPhp: cur.reduce<Record<string, number>>((m, s) => ((m[s.method] = (m[s.method] ?? 0) + pesos(s.amountCentavos)), m), {}),
    byDay,
    note: "salesPhp = payments recorded. carsServed = cars finished (done, paid or closed), paid or not.",
  };
}

/** Walk-ins (queue) and River Mobile bookings in a period, every status counted separately. */
export function getBookings(d: ShopData, args: Record<string, unknown>) {
  const r = periodOf(args, d.now);
  const queue = d.queue.filter((q) => within(q.createdAt, r.from, r.to));
  const walkIns = queue.filter((q) => q.source !== "booking");
  const scanned = queue.filter((q) => q.source === "booking");
  const bookings = d.bookings.filter((b) => within(b.scheduledStart, r.from, r.to));
  const arrivals = [...queue.map((q) => q.createdAt), ...bookings.filter((b) => !b.queueItemId).map((b) => b.scheduledStart)];
  return {
    period: r.period, label: r.label,
    walkIns: { total: walkIns.length, active: walkIns.filter((q) => q.status !== "cancelled").length, byStatus: queueCounts(walkIns) },
    bookingsInQueue: { total: scanned.length, byStatus: queueCounts(scanned) },
    queueNow: d.queue.filter((q) => q.status === "queued" || q.status === "in_bay").reduce((m, q) => ((m[q.status] = (m[q.status] ?? 0) + 1), m), { queued: 0, in_bay: 0 } as Record<string, number>),
    bookings: { total: bookings.length, byStatus: tally(bookings, (b) => b.status), bySource: tally(bookings, (b) => b.source) },
    byHour: tally(arrivals, hour), byWeekday: tally(arrivals, weekday),
    walkInsByWeekday: tally(walkIns.map((q) => q.createdAt), weekday),
    ...(args.includeDetails === true
      ? { details: bookings.slice(0, 30).map((b) => ({ reference: b.reference, when: b.scheduledStart, status: b.status, customer: b.customerSnapshot?.name ?? null })) }
      : {}),
    note: "Walk-in statuses: queued = waiting, in_bay = being washed, done = finished not yet paid, paid/closed = paid, cancelled.",
  };
}

export function topServices(d: ShopData, args: Record<string, unknown>) {
  const r = periodOf(args, d.now);
  const m = new Map<string, { service: string; cars: number; salesPhp: number }>();
  for (const v of visits(d, r.from, r.to)) {
    const ids = v.serviceIds.length ? v.serviceIds : ["_"];
    for (const id of ids) {
      const name = d.services.find((s) => s.id === id)?.name ?? "Other";
      const row = m.get(name) ?? { service: name, cars: 0, salesPhp: 0 };
      row.cars++; row.salesPhp += pesos(v.centavos / ids.length);
      m.set(name, row);
    }
  }
  const sizes = tally(visits(d, r.from, r.to).filter((v) => v.size), (v) => v.size!);
  return { period: r.period, label: r.label, services: [...m.values()].sort((a, b) => b.salesPhp - a.salesPhp).slice(0, Math.max(1, Math.min(20, Number(args.limit) || 10))), vehicleSizes: sizes };
}

/** Per bay (washer station): cars, sales, average wash minutes, average wait. */
export function staffPerformance(d: ShopData, args: Record<string, unknown>) {
  const r = periodOf(args, d.now);
  const m = new Map<string, { bay: string; cars: number; salesPhp: number; mins: number[] }>();
  for (const v of visits(d, r.from, r.to)) {
    const name = d.bays.find((b) => b.id === v.bayId)?.name ?? "No bay";
    const row = m.get(name) ?? { bay: name, cars: 0, salesPhp: 0, mins: [] };
    row.cars++; row.salesPhp += pesos(v.centavos);
    if (v.startedAt && v.doneAt && ms(v.doneAt) > ms(v.startedAt)) row.mins.push((ms(v.doneAt) - ms(v.startedAt)) / 60_000);
    m.set(name, row);
  }
  const waits = d.queue.filter((q) => within(q.createdAt, r.from, r.to) && q.startedAt).map((q) => (ms(q.startedAt) - ms(q.createdAt)) / 60_000).filter((x) => x >= 0);
  return {
    period: r.period, label: r.label,
    bays: [...m.values()].map((x) => ({ bay: x.bay, cars: x.cars, salesPhp: Math.round(x.salesPhp), avgWashMins: x.mins.length ? Math.round(x.mins.reduce((a, b) => a + b, 0) / x.mins.length) : null })).sort((a, b) => b.cars - a.cars),
    avgWaitMins: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null,
    note: "Per bay; washers are not tracked per car yet.",
  };
}

/** Returning customers (by name or River Mobile phone) who haven't come back in N days. Names only when the owner asked. */
export function inactiveCustomers(d: ShopData, args: Record<string, unknown>, allowDetails: boolean) {
  const days = Math.min(180, Math.max(7, Number(args.days) || 30));
  const last = new Map<string, { last: number; visits: number }>();
  for (const v of visits(d, new Date(0), d.now)) {
    if (!v.who) continue;
    const row = last.get(v.who) ?? { last: 0, visits: 0 };
    row.visits++; row.last = Math.max(row.last, ms(v.at));
    last.set(v.who, row);
  }
  const cutoff = d.now.getTime() - days * 86_400_000;
  const lapsed = [...last.entries()].filter(([, r]) => r.last < cutoff).sort((a, b) => b[1].visits - a[1].visits);
  const show = allowDetails && args.includeDetails === true;
  return {
    days, inactiveCount: lapsed.length, knownCustomers: last.size, regularsLapsed: lapsed.filter(([, r]) => r.visits >= 2).length,
    customers: show ? lapsed.slice(0, 25).map(([customer, r]) => ({ customer, visits: r.visits, lastVisit: new Date(r.last).toISOString().slice(0, 10) })) : undefined,
    detailsHidden: !show,
  };
}

const periodParam = { type: "string", enum: [...PERIODS], description: "Manila calendar period. 'today' for today. Default last_7_days." };
const withPeriod = (extra: Record<string, unknown> = {}) => ({ type: "object", properties: { period: periodParam, ...extra } });

export const TOOL_DECLS: ToolDecl[] = [
  { name: "getSales", description: "Sales (PHP) from recorded payments, paid cars, cars served (finished, paid or not), unpaid cars and amount, average ticket, payment mix and day-by-day totals vs the previous equal period.", parameters: withPeriod() },
  { name: "getBookings", description: "Walk-ins and bookings: walk-in counts by every status (queued, in_bay, done, paid, closed, cancelled), cars in the queue right now, River Mobile bookings by status and source, arrivals by hour and weekday. Use for 'ilang walk-ins/kotse/booking'. includeDetails=true lists bookings with customer names ONLY if the owner explicitly asked for names.", parameters: withPeriod({ includeDetails: { type: "boolean" } }) },
  { name: "topServices", description: "Best-selling services/packages by revenue and cars, plus vehicle size mix, for a period.", parameters: withPeriod({ limit: { type: "integer" } }) },
  { name: "staffPerformance", description: "Per-bay cars, sales, average wash minutes, and the average wait before a car starts.", parameters: withPeriod() },
  { name: "branchComparison", description: "Sales and cars per shop (branch) this owner owns, side by side.", parameters: withPeriod() },
  { name: "inactiveCustomers", description: "Customers (by name or phone) who haven't come back in N days (default 30). includeDetails=true lists names ONLY when the owner explicitly asks who.", parameters: { type: "object", properties: { days: { type: "integer" }, includeDetails: { type: "boolean" } } } },
  { name: "goalProgress", description: "The owner's saved goals and progress (actual, projection, needed per day).", parameters: { type: "object", properties: {} } },
  { name: "setGoal", description: "Save a goal the owner states (e.g. 'goal ko 50k a month'). metric revenue (pesos) or cars; period month or week. Only Companion memory; never business data.", parameters: { type: "object", properties: { metric: { type: "string", enum: ["revenue", "cars"] }, period: { type: "string", enum: ["month", "week"] }, target: { type: "number" } }, required: ["metric", "period", "target"] } },
];
/** Same split as Barbers: multi-branch comparison and goals are Pro or Lifetime. */
export const PRO_ONLY = new Set(["branchComparison", "setGoal"]);
const DETAIL_ASK = /\b(name|names|who|list|sino|sinu|pangalan|contact|number|numero)\b/i;

export interface ToolContext { store: DocStore; business: Doc<Business>; uid: string; now: Date; paid: boolean; lastUserText: string }

export function makeToolRunner(ctx: ToolContext) {
  let cached: Promise<ShopData> | null = null;
  const data = () => (cached ??= loadShopData(ctx.store, ctx.business.id, ctx.now));
  const run = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    if (!ctx.paid && PRO_ONLY.has(name)) return { error: "This needs Pro or Lifetime. Tell the owner they can upgrade in Account > Plan & billing." };
    switch (name) {
      case "getSales": return getSales(await data(), args);
      case "getBookings": return getBookings(await data(), { ...args, includeDetails: args.includeDetails === true && DETAIL_ASK.test(ctx.lastUserText) });
      case "topServices": return topServices(await data(), args);
      case "staffPerformance": return staffPerformance(await data(), args);
      case "inactiveCustomers": return inactiveCustomers(await data(), args, DETAIL_ASK.test(ctx.lastUserText));
      case "branchComparison": {
        const owned = (await listMyBusinesses(ctx.store, ctx.uid)).filter((x) => x.role === "owner");
        const shops = [];
        for (const { business } of owned) {
          const d = business.id === ctx.business.id ? await data() : await loadShopData(ctx.store, business.id, ctx.now);
          const s = getSales(d, args);
          shops.push({ shop: business.name, current: business.id === ctx.business.id, salesPhp: s.salesPhp, carsServed: s.carsServed, avgTicketPhp: s.avgTicketPhp, previousPeriodSalesPhp: s.previousPeriodSalesPhp });
        }
        return { period: asPeriod(args.period), shops };
      }
      case "goalProgress": return { goals: goalProgress(await listGoals(ctx.store, ctx.business.id), await data()) };
      case "setGoal": {
        const goal = await saveGoal(ctx.store, ctx.business.id, { metric: args.metric as "revenue", period: args.period as "month", target: Number(args.target) }, ctx.now);
        return { saved: goal, progress: goalProgress([goal], await data()) };
      }
      default: return { error: `Unknown tool ${name}` };
    }
  };
  return { run };
}
