import { logger } from "firebase-functions/logger";
import type { Business } from "../../models/types.js";
import type { Doc, DocStore } from "../../store/doc-store.js";
import type { CompanionMessage } from "./chat-service.js";
import { computeMetrics, hasEnoughData, type MetricsSnapshot } from "./metrics.js";
import type { CompanionModel, ModelUsage } from "./model.js";
import { buildUserPrompt, INSIGHTS_SCHEMA, INSIGHTS_SYSTEM_PROMPT, parseInsight, type InsightTip } from "./prompt.js";
import { detectAlerts } from "./alerts.js";
import { companionPaths, loadShopData, monthKeyFor, recordAiCost, tierOf, weekIdFor, type Tier } from "./store.js";

/** businesses/{id}/insights/{weekId} */
export interface Insight {
  weekId: string;
  monthKey: string;
  trigger: "schedule" | "manual";
  tier: Tier;
  summary: string;
  language: "en" | "taglish";
  tips: InsightTip[];
  metrics: MetricsSnapshot;
  model: string;
  location: string;
  usage: ModelUsage;
  costUsd: number;
  costPhp: number;
  createdAt: string;
}

export type TipsOutcome = { status: "created"; insight: Doc<Insight> } | { status: "skipped"; reason: "not_enough_data" };

/**
 * Monday tips: aggregate (no PII), ask Gemini for 3-5 tips, save
 * insights/{weekId}, post them as a chat message, log + store the cost.
 */
export async function generateWeeklyTips(
  store: DocStore,
  model: CompanionModel,
  business: Doc<Business>,
  opts: { now: Date; env: string; trigger: Insight["trigger"] },
): Promise<TipsOutcome> {
  const tier = tierOf(business);
  const metrics = computeMetrics(await loadShopData(store, business.id, opts.now));
  if (!hasEnoughData(metrics)) return { status: "skipped", reason: "not_enough_data" };
  const result = await model.generateJson({
    system: INSIGHTS_SYSTEM_PROMPT,
    user: buildUserPrompt({ shopName: business.name, metrics }),
    schema: INSIGHTS_SCHEMA as unknown as Record<string, unknown>,
  });
  const parsed = parseInsight(result.text);
  const weekId = weekIdFor(opts.now);
  const cost = await recordAiCost(store, business.id, {
    now: opts.now, env: opts.env, operation: "weekly_tips", model: result.model, location: result.location, usage: result.usage,
    extra: { weekId, trigger: opts.trigger, tier },
  });
  const insight: Insight = {
    weekId, monthKey: monthKeyFor(opts.now), trigger: opts.trigger, tier,
    summary: parsed.summary, language: parsed.language, tips: parsed.tips, metrics,
    model: result.model, location: result.location, usage: result.usage, costUsd: cost.costUsd, costPhp: cost.costPhp,
    createdAt: opts.now.toISOString(),
  };
  await store.set(companionPaths.insight(business.id, weekId), { ...insight });
  const msg: CompanionMessage = {
    role: "companion", kind: "tip", text: parsed.summary || "Your tips for this week", tips: parsed.tips, weekId,
    model: result.model, usage: result.usage, costUsd: cost.costUsd, createdAt: opts.now.toISOString(),
  };
  await store.set(companionPaths.message(business.id, `tips_${weekId}`), { ...msg });
  return { status: "created", insight: { ...insight, id: weekId } };
}

/** Weekly job over every shop in this environment's database. Push is not wired yet (no provider). */
export async function runWeeklyCompanion(store: DocStore, model: CompanionModel, opts: { now: Date; env: string; trigger?: Insight["trigger"] }) {
  const businesses = await store.list<Business>("businesses");
  const summary = { total: businesses.length, created: 0, skipped: 0, failed: 0, alerts: 0, costUsd: 0 };
  for (const b of businesses) {
    if (b.planStatus === "suspended") {
      summary.skipped++;
      continue;
    }
    try {
      const out = await generateWeeklyTips(store, model, b, { ...opts, trigger: opts.trigger ?? "schedule" });
      if (out.status === "created") {
        summary.created++;
        summary.costUsd += out.insight.costUsd;
        if (tierOf(b) === "full") summary.alerts += (await detectAlerts(store, b, opts.now)).length;
      } else summary.skipped++;
    } catch (err) {
      summary.failed++;
      logger.error("companion_weekly_failed", { env: opts.env, businessId: b.id, error: (err as Error).message });
    }
  }
  summary.costUsd = Math.round(summary.costUsd * 1_000_000) / 1_000_000;
  logger.info("companion_weekly_done", { env: opts.env, ...summary });
  return summary;
}

export async function listInsights(store: DocStore, businessId: string, limit = 12) {
  return store.list<Insight>(companionPaths.insights(businessId), { orderBy: { field: "createdAt", direction: "desc" }, limit });
}
