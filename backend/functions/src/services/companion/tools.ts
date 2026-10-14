import type { Business, Sale } from "../../models/types.js";
import type { Doc, DocStore } from "../../store/doc-store.js";
import { listMyBusinesses } from "../businesses-service.js";
import { goalProgress, listGoals, saveGoal } from "./goals.js";
import { computeMetrics, type InsightsInput } from "./metrics.js";
import type { ToolDecl } from "./model.js";
import { asPeriod, PERIODS, rangeFor, type Period } from "./periods.js";
import { loadShopData, tierOf } from "./store.js";

/**
 * Companion tools. All READ-ONLY over the owner's own shop (the business id is
 * bound server-side, never taken from the model), except setGoal, which writes
 * only companion/goals. Customer PII (names, phones, plates) is returned only by
 * inactiveCustomers/getBookings when includeDetails=true, which the prompt allows
 * only when the owner explicitly asks.
 */
const periodParam = { type: "string", enum: [...PERIODS], description: "Manila calendar period. Default last_7_days." };

export const TOOL_DECLS: ToolDecl[] = [
  { name: "getSales", description: "Revenue, cars served, average ticket, payment mix and daily breakdown for a period, plus the previous equal period for comparison.", parameters: { type: "object", properties: { period: periodParam } } },
  { name: "getBookings", description: "Bookings for a period: counts by status (completed, no_show, cancelled...) and source (River Mobile, online link, staff). includeDetails=true lists each booking with customer name ONLY if the owner explicitly asked for names/details.", parameters: { type: "object", properties: { period: periodParam, includeDetails: { type: "boolean" } } } },
  { name: "topServices", description: "Best-selling services/packages by cars and revenue for a period.", parameters: { type: "object", properties: { period: periodParam } } },
  { name: "serviceMix", description: "Service/package mix and vehicle size mix (shares in percent) for a period, useful for upsell and pricing advice.", parameters: { type: "object", properties: { period: periodParam } } },
  { name: "staffPerformance", description: "Per-bay (washer station) performance: cars, revenue, average service minutes for a period.", parameters: { type: "object", properties: { period: periodParam } } },
  { name: "carsPerHour", description: "Throughput: average cars per active hour, the peak hour, busiest days and hours for a period.", parameters: { type: "object", properties: { period: periodParam } } },
  { name: "queuePeaks", description: "Queue: peak number of cars waiting at once and when, average wait minutes and average service minutes for a period.", parameters: { type: "object", properties: { period: periodParam } } },
  { name: "branchComparison", description: "Compares all shops (branches) this owner owns: revenue and cars for the period. Use for multi-shop questions.", parameters: { type: "object", properties: { period: periodParam } } },
  { name: "inactiveCustomers", description: "Returning customers (by plate) who have not come back in N days (default 30). Returns counts; includeDetails=true lists plates and last visit ONLY if the owner explicitly asked to see who.", parameters: { type: "object", properties: { days: { type: "integer" }, includeDetails: { type: "boolean" } } } },
  { name: "goalProgress", description: "The owner's saved goals (e.g. ₱50,000 per month) and progress, projection and needed daily pace.", parameters: { type: "object", properties: {} } },
  { name: "setGoal", description: "Saves or replaces an owner goal when the owner clearly states one (e.g. 'goal ko 50k a month'). metric revenue (target in pesos) or cars; period month or week.", parameters: { type: "object", properties: { metric: { type: "string", enum: ["revenue", "cars"] }, period: { type: "string", enum: ["month", "week"] }, target: { type: "number" } }, required: ["metric", "period", "target"] } },
];

const pesos = (c: number) => Math.round(c / 100);
const inRange = (iso: string, from: Date, to: Date) => {
  const t = Date.parse(iso);
  return t >= from.getTime() && t < to.getTime();
};

function slice(data: InsightsInput, from: Date, to: Date): InsightsInput {
  return {
    ...data,
    now: to,
    sales: data.sales.filter((s) => inRange(s.paidAt, from, to)),
    queue: data.queue.filter((q) => inRange(q.createdAt, from, to)),
    bookings: data.bookings.filter((b) => inRange(b.scheduledStart, from, to)),
  };
}

function spanDays(from: Date, to: Date) {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
}

function salesSummary(sales: Doc<Sale>[]) {
  const rec = sales.filter((s) => s.status === "recorded");
  const total = rec.reduce((a, s) => a + s.amountCentavos, 0);
  return { revenuePesos: pesos(total), cars: rec.length, avgTicketPesos: rec.length ? pesos(total / rec.length) : 0 };
}

export interface ToolContext {
  store: DocStore;
  business: Doc<Business>;
  uid: string;
  now: Date;
  /** Goals are a Pro/Lifetime feature. */
  canSetGoals: boolean;
}

export function makeToolRunner(ctx: ToolContext) {
  let cached: Promise<InsightsInput> | null = null;
  const data = () => (cached ??= loadShopData(ctx.store, ctx.business.id, ctx.now));
  const periodOf = (args: Record<string, unknown>): { p: Period; from: Date; to: Date; label: string } => {
    const r = rangeFor(asPeriod(args.period), ctx.now);
    return { p: r.period, from: r.from, to: r.to, label: r.label };
  };
  const metricsFor = async (args: Record<string, unknown>) => {
    const { p, from, to, label } = periodOf(args);
    const d = await data();
    return { period: p, label, m: computeMetrics(slice(d, from, to), spanDays(from, to)) };
  };

  const run = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    switch (name) {
      case "getSales": {
        const { p, from, to, label } = periodOf(args);
        const d = await data();
        const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
        const cur = d.sales.filter((s) => inRange(s.paidAt, from, to));
        const prev = salesSummary(d.sales.filter((s) => inRange(s.paidAt, prevFrom, from)));
        const byDay = new Map<string, { revenue: number; cars: number }>();
        for (const s of cur.filter((x) => x.status === "recorded")) {
          const day = new Date(s.paidAt).toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });
          const row = byDay.get(day) ?? { revenue: 0, cars: 0 };
          row.revenue += s.amountCentavos;
          row.cars++;
          byDay.set(day, row);
        }
        const methods = new Map<string, number>();
        for (const s of cur) if (s.status === "recorded") methods.set(s.method, (methods.get(s.method) ?? 0) + pesos(s.amountCentavos));
        const now = salesSummary(cur);
        return {
          period: p, label, ...now,
          previousPeriod: prev,
          changePct: prev.revenuePesos ? Math.round(((now.revenuePesos - prev.revenuePesos) / prev.revenuePesos) * 1000) / 10 : null,
          paymentMixPesos: Object.fromEntries(methods),
          byDay: [...byDay.entries()].map(([day, r]) => ({ day, revenuePesos: pesos(r.revenue), cars: r.cars })),
        };
      }
      case "getBookings": {
        const { p, from, to, label } = periodOf(args);
        const rows = (await data()).bookings.filter((b) => inRange(b.scheduledStart, from, to));
        const count = (key: (b: (typeof rows)[number]) => string) => rows.reduce<Record<string, number>>((a, b) => ((a[key(b)] = (a[key(b)] ?? 0) + 1), a), {});
        return {
          period: p, label, total: rows.length, byStatus: count((b) => b.status), bySource: count((b) => b.source),
          ...(args.includeDetails === true
            ? { details: rows.slice(0, 30).map((b) => ({ reference: b.reference, when: b.scheduledStart, status: b.status, customer: b.customerSnapshot?.name ?? null, plate: b.plate })) }
            : {}),
        };
      }
      case "topServices": {
        const { period, label, m } = await metricsFor(args);
        return { period, label, topServices: m.topServices };
      }
      case "serviceMix": {
        const { period, label, m } = await metricsFor(args);
        return { period, label, serviceMix: m.topServices.map((s) => ({ name: s.name, sharePct: s.sharePct })), vehicleSizeMix: m.vehicleSizeMix, avgTicketPesos: m.last28.avgTicketPesos };
      }
      case "staffPerformance": {
        const { period, label, m } = await metricsFor(args);
        return { period, label, bays: m.bays, note: "Per bay; staff are not tracked per car yet." };
      }
      case "carsPerHour": {
        const { period, label, m } = await metricsFor(args);
        return { period, label, carsPerHour: m.carsPerHour, busiestDays: m.busiestDays, busiestHours: m.busiestHours };
      }
      case "queuePeaks": {
        const { period, label, m } = await metricsFor(args);
        return { period, label, queue: m.queue, walkIns: m.last28.walkIns, bookings: m.last28.bookings };
      }
      case "branchComparison": {
        const { p, from, to, label } = periodOf(args);
        const owned = (await listMyBusinesses(ctx.store, ctx.uid)).filter((x) => x.role === "owner");
        const shops = [];
        for (const { business } of owned) {
          const d = business.id === ctx.business.id ? await data() : await loadShopData(ctx.store, business.id, ctx.now);
          shops.push({ shop: business.name, current: business.id === ctx.business.id, ...salesSummary(d.sales.filter((s) => inRange(s.paidAt, from, to))) });
        }
        return { period: p, label, shops, combined: { revenuePesos: shops.reduce((a, s) => a + s.revenuePesos, 0), cars: shops.reduce((a, s) => a + s.cars, 0) } };
      }
      case "inactiveCustomers": {
        const days = Math.min(180, Math.max(7, Number(args.days) || 30));
        const d = await data();
        const last = new Map<string, { at: number; visits: number }>();
        for (const s of d.sales) {
          if (!s.plate || s.status !== "recorded") continue;
          const t = Date.parse(s.paidAt);
          const row = last.get(s.plate) ?? { at: 0, visits: 0 };
          last.set(s.plate, { at: Math.max(row.at, t), visits: row.visits + 1 });
        }
        const cutoff = ctx.now.getTime() - days * 86_400_000;
        const lapsed = [...last.entries()].filter(([, r]) => r.visits >= 2 && r.at < cutoff).sort((a, b) => b[1].visits - a[1].visits);
        return {
          days,
          returningCustomers: [...last.values()].filter((r) => r.visits >= 2).length,
          inactiveReturningCustomers: lapsed.length,
          ...(args.includeDetails === true
            ? { details: lapsed.slice(0, 20).map(([plate, r]) => ({ plate, visits: r.visits, lastVisit: new Date(r.at).toISOString().slice(0, 10) })) }
            : {}),
        };
      }
      case "goalProgress": {
        const goals = await listGoals(ctx.store, ctx.business.id);
        if (!goals.length) return { goals: [], note: "No goals saved yet." };
        return { goals: goalProgress(goals, await data()) };
      }
      case "setGoal": {
        if (!ctx.canSetGoals) return { error: "Goals are a Pro and Lifetime feature. Tell the owner they can upgrade in Settings > Plans." };
        const goal = await saveGoal(ctx.store, ctx.business.id, { metric: args.metric as "revenue" | "cars", period: args.period as "month" | "week", target: Number(args.target) }, ctx.now);
        return { saved: goal, progress: goalProgress([goal], await data())[0] };
      }
      default:
        return { error: `Unknown tool ${name}` };
    }
  };
  return { run, tier: tierOf(ctx.business) };
}

