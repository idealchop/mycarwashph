import { logger } from "firebase-functions/logger";
import type { Business } from "../../models/types.js";
import type { Doc, DocStore } from "../../store/doc-store.js";
import type { CompanionMessage } from "./chat-service.js";
import { companionSystemPrompt, TIPS_PROMPT, TIPS_SCHEMA } from "./companion-prompt.js";
import { goalProgress, listGoals } from "./goals.js";
import type { CompanionModel } from "./model.js";
import { companionPaths, recordAiCost, tierOf, weekIdFor } from "./store.js";
import { getBookings, getSales, inactiveCustomers, loadShopData, staffPerformance, topServices } from "./tools.js";

/** Partner sees the first tip of the week; Pro and Lifetime see all tips and alerts (Barbers.ph). */
export const PARTNER_WEEKLY_TIPS = 1;

/**
 * Monday tips for one shop, same flow as Barbers.ph weeklyTips: the tool numbers go to Gemini
 * as JSON, the tips are posted as ONE plain message in the shop's single thread (role tip),
 * Pro/Lifetime alerts as their own messages, and insights/{weekId} keeps a record of the run.
 * Idempotent per week unless force.
 */
export async function weeklyTips(store: DocStore, model: CompanionModel, business: Doc<Business>, opts: { now: Date; env: string; force?: boolean }) {
  const weekId = weekIdFor(opts.now);
  if (!opts.force && (await store.get(companionPaths.insight(business.id, weekId)))) return { skipped: "already sent", weekId };
  const tier = tierOf(business);
  const paid = tier === "full";
  const data = await loadShopData(store, business.id, opts.now);
  const goals = paid ? await listGoals(store, business.id) : [];
  const facts = {
    last7: getSales(data, { period: "last_7_days" }), last28: getSales(data, { period: "last_28_days" }),
    carsLast7: getBookings(data, { period: "last_7_days" }), services: topServices(data, { period: "last_28_days", limit: 5 }),
    bays: staffPerformance(data, { period: "last_28_days" }), inactive: inactiveCustomers(data, { days: 30 }, false),
    goals: paid ? goalProgress(goals, data) : undefined,
  };
  const todayLabel = opts.now.toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const result = await model.generateJson({
    system: `${companionSystemPrompt({ shopName: business.name, todayLabel, tier })}\n\n${TIPS_PROMPT}`,
    user: `Shop numbers (JSON):\n${JSON.stringify(facts)}`,
    schema: TIPS_SCHEMA,
  });
  const cost = await recordAiCost(store, business.id, { now: opts.now, env: opts.env, operation: "weekly_tips", model: result.model, location: result.location, usage: result.usage, extra: { weekId, tier } });
  let parsed: { tips?: unknown[]; alerts?: unknown[] } = {};
  try { parsed = JSON.parse(result.text); } catch { parsed = { tips: [] }; }
  const clean = (xs: unknown[] | undefined, n: number) => (xs ?? []).filter((t): t is string => typeof t === "string" && !!t.trim()).slice(0, n);
  const tips = clean(parsed.tips, 5);
  const alerts = paid ? clean(parsed.alerts, 3) : [];
  const shown = paid ? tips : tips.slice(0, PARTNER_WEEKLY_TIPS);
  const hidden = tips.length - shown.length;
  const text = `Magandang umaga! Your Monday tips for this week:\n\n${shown.map((t, i) => `${i + 1}. ${t}`).join("\n")}${hidden > 0 ? `\n\n${hidden} more tips are waiting for you on Pro or Lifetime.` : ""}`;
  const at = opts.now.toISOString();
  const tipMsg: CompanionMessage = { role: "companion", kind: "tip", text, weekId, locked: hidden > 0, model: result.model, usage: result.usage, costUsd: cost.costUsd, createdAt: at };
  await store.set(companionPaths.message(business.id, `tips_${weekId}`), { ...tipMsg });
  for (const [i, a] of alerts.entries()) {
    const alert: CompanionMessage = { role: "companion", kind: "alert", text: a, weekId, createdAt: new Date(opts.now.getTime() + i + 1).toISOString() };
    await store.set(companionPaths.message(business.id, `alert_${weekId}_${i}`), { ...alert });
  }
  await store.set(companionPaths.insight(business.id, weekId), {
    weekId, createdAt: at, tier, tips: shown, hiddenTips: hidden, alerts, messageId: `tips_${weekId}`,
    model: result.model, usage: result.usage, costUsd: cost.costUsd, costPhp: cost.costPhp,
  });
  return { weekId, tips: shown.length, hiddenTips: hidden, alerts: alerts.length, messageId: `tips_${weekId}`, costUsd: cost.costUsd };
}

/** Monday job over every shop in this environment's database (Barbers runs the same loop from Cloud Scheduler). */
export async function runWeeklyCompanion(store: DocStore, model: CompanionModel, opts: { now: Date; env: string }) {
  const businesses = await store.list<Business>("businesses");
  const summary = { total: businesses.length, sent: 0, skipped: 0, failed: 0, alerts: 0, costUsd: 0 };
  for (const b of businesses) {
    if (b.planStatus === "suspended" || !b.name?.trim()) { summary.skipped++; continue; }
    try {
      const out = await weeklyTips(store, model, b, opts);
      if ("skipped" in out) summary.skipped++;
      else { summary.sent++; summary.alerts += out.alerts; summary.costUsd += out.costUsd; }
    } catch (err) {
      summary.failed++;
      logger.error("companion_weekly_failed", { env: opts.env, businessId: b.id, error: (err as Error).message });
    }
  }
  summary.costUsd = Math.round(summary.costUsd * 1_000_000) / 1_000_000;
  logger.info("companion_weekly_done", { env: opts.env, ...summary });
  return summary;
}
