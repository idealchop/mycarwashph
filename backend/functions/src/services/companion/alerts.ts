import { logger } from "firebase-functions/logger";
import type { Business } from "../../models/types.js";
import type { Doc, DocStore } from "../../store/doc-store.js";
import type { CompanionMessage } from "./chat-service.js";
import { computeMetrics, type InsightsInput } from "./metrics.js";
import { companionPaths, loadShopData, tierOf, weekIdFor } from "./store.js";

const DAY = 86_400_000;

export interface AlertFinding {
  key: string;
  text: string;
}

/**
 * Deterministic "something stands out" checks: last 7 days vs the 28-day
 * baseline before it. No model call, no cost.
 */
export function findAlerts(data: InsightsInput): AlertFinding[] {
  const now = data.now.getTime();
  const cut = (from: number, to: number): InsightsInput => ({
    ...data,
    now: new Date(to),
    sales: data.sales.filter((s) => Date.parse(s.paidAt) >= from && Date.parse(s.paidAt) < to),
    queue: data.queue.filter((q) => Date.parse(q.createdAt) >= from && Date.parse(q.createdAt) < to),
    bookings: data.bookings.filter((b) => Date.parse(b.scheduledStart) >= from && Date.parse(b.scheduledStart) < to),
  });
  const recent = computeMetrics(cut(now - 7 * DAY, now), 7);
  const base = computeMetrics(cut(now - 35 * DAY, now - 7 * DAY), 28);
  const out: AlertFinding[] = [];
  const weeklyBase = base.last28.revenuePesos / 4;
  if (weeklyBase >= 2000) {
    const change = (recent.last28.revenuePesos - weeklyBase) / weeklyBase;
    const fmt = (n: number) => `₱${Math.round(n).toLocaleString("en-US")}`;
    if (change <= -0.2) out.push({ key: "revenue_drop", text: `Heads up: sales in the last 7 days were ${fmt(recent.last28.revenuePesos)}, ${Math.round(-change * 100)}% below your usual week (${fmt(weeklyBase)}). Want me to check which days and services dipped?` });
    if (change >= 0.3) out.push({ key: "revenue_jump", text: `Nice! Sales in the last 7 days hit ${fmt(recent.last28.revenuePesos)}, ${Math.round(change * 100)}% above your usual week (${fmt(weeklyBase)}). Let's see what worked so you can repeat it.` });
  }
  const bw = base.queue.avgWaitMins;
  const rw = recent.queue.avgWaitMins;
  if (bw && rw && rw >= bw * 1.5 && rw >= 15) {
    out.push({ key: "queue_spike", text: `Queue alert: average wait was ${Math.round(rw)} min this week vs ${Math.round(bw)} min usually (peak ${recent.queue.peakWaiting} cars waiting${recent.queue.peakSlot ? `, ${recent.queue.peakSlot}` : ""}). Consider an extra washer at that time.` });
  }
  const bn = base.last28.noShowRatePct;
  const rn = recent.last28.noShowRatePct;
  if (rn !== null && rn >= 20 && (bn === null || rn >= bn * 1.5)) {
    out.push({ key: "no_show_spike", text: `No-shows jumped to ${rn}% of bookings this week${bn !== null ? ` (usually ${bn}%)` : ""}. A reminder message the day before can help.` });
  }
  return out;
}

/** Posts new alerts as chat messages (Pro/Lifetime only), at most once per type per week. */
export async function detectAlerts(store: DocStore, business: Doc<Business>, now: Date) {
  if (tierOf(business) !== "full") return [];
  const findings = findAlerts(await loadShopData(store, business.id, now));
  const week = weekIdFor(now);
  const posted: AlertFinding[] = [];
  for (const f of findings) {
    const id = `alert_${week}_${f.key}`;
    if (await store.get(companionPaths.message(business.id, id))) continue;
    const msg: CompanionMessage = { role: "companion", kind: "alert", text: f.text, createdAt: new Date(now.getTime() + 2).toISOString() };
    await store.set(companionPaths.message(business.id, id), { ...msg });
    posted.push(f);
  }
  if (posted.length) logger.info("companion_alerts", { businessId: business.id, week, keys: posted.map((p) => p.key) });
  return posted;
}

/** Daily alert sweep (no Gemini). */
export async function runDailyAlerts(store: DocStore, opts: { now: Date; env: string }) {
  const businesses = await store.list<Business>("businesses");
  let posted = 0;
  for (const b of businesses) {
    try {
      posted += (await detectAlerts(store, b, opts.now)).length;
    } catch (err) {
      logger.error("companion_alerts_failed", { env: opts.env, businessId: b.id, error: (err as Error).message });
    }
  }
  logger.info("companion_alerts_done", { env: opts.env, shops: businesses.length, posted });
  return { shops: businesses.length, posted };
}
