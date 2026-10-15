import { planGatingEnabled } from "../../config/plan-gating.js";
import { logger } from "firebase-functions/logger";
import type { Business } from "../../models/types.js";
import type { DocStore } from "../../store/doc-store.js";
import { estimateCostUsd, USD_TO_PHP, type ModelUsage } from "./model.js";

/**
 * AI Companion storage, all under businesses/{id}/:
 *   insights/{weekId}                      record of that week's Monday tips run (tips, alerts, cost)
 *   companion/threads/messages/{msgId}     chat (owner, companion, tip, alert)
 *   companion/goals                        { goals: Goal[] }
 *   companion/usage                        per-month / per-week question counts and Gemini cost
 * Only the server writes these; the model never writes business data.
 */
export const companionPaths = {
  insights: (b: string) => `businesses/${b}/insights`,
  insight: (b: string, weekId: string) => `businesses/${b}/insights/${weekId}`,
  messages: (b: string) => `businesses/${b}/companion/threads/messages`,
  message: (b: string, id: string) => `businesses/${b}/companion/threads/messages/${id}`,
  goals: (b: string) => `businesses/${b}/companion/goals`,
  usage: (b: string) => `businesses/${b}/companion/usage`,
};

export type Tier = "full" | "partner";

/** Pro (monthly) and Lifetime shops are on the "paid" plan; everything else is Partner. */
export function tierOf(business: Pick<Business, "plan" | "planStatus">): Tier {
  if (!planGatingEnabled()) return "full";
  return business.plan === "paid" && business.planStatus === "active" ? "full" : "partner";
}

export const PARTNER_MONTHLY_QUESTIONS = 10;
const DAY = 86_400_000;

function manilaParts(now: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number) as [number, number, number];
  return { y, m, d };
}

/** ISO week of the Manila calendar date, e.g. "2026-W42". */
export function weekIdFor(now: Date): string {
  const { y, m, d } = manilaParts(now);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / DAY + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthKeyFor(now: Date): string {
  const { y, m } = manilaParts(now);
  return `${y}-${String(m).padStart(2, "0")}`;
}

export interface UsageBucket {
  questions: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface CompanionUsage {
  months: Record<string, UsageBucket>;
  weeks: Record<string, UsageBucket>;
  updatedAt: string;
}

const empty = (): UsageBucket => ({ questions: 0, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
const r6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

/**
 * Records one Gemini call: structured `ai_usage` log line (Cloud Logging) plus
 * running per-week and per-month totals in companion/usage.
 */
export async function recordAiCost(
  store: DocStore,
  businessId: string,
  input: { now: Date; env: string; operation: "chat" | "weekly_tips"; model: string; location: string; usage: ModelUsage; extra?: Record<string, unknown> },
): Promise<{ costUsd: number; costPhp: number }> {
  const costUsd = estimateCostUsd(input.usage);
  const month = monthKeyFor(input.now);
  const week = weekIdFor(input.now);
  const totals = await store.runTransaction(async (tx) => {
    const cur = (await tx.get<CompanionUsage>(companionPaths.usage(businessId))) ?? ({ months: {}, weeks: {}, updatedAt: "" } as CompanionUsage);
    const add = (b: UsageBucket | undefined): UsageBucket => {
      const x = b ?? empty();
      return { ...x, calls: x.calls + 1, inputTokens: x.inputTokens + input.usage.inputTokens, outputTokens: x.outputTokens + input.usage.outputTokens, costUsd: r6(x.costUsd + costUsd) };
    };
    const months = { ...cur.months, [month]: add(cur.months?.[month]) };
    const weeks = { ...cur.weeks, [week]: add(cur.weeks?.[week]) };
    tx.set(companionPaths.usage(businessId), { months, weeks, updatedAt: input.now.toISOString() });
    return { monthCostUsd: months[month]!.costUsd, weekCostUsd: weeks[week]!.costUsd };
  });
  logger.info("ai_usage", {
    app: "mycarwash",
    feature: "companion",
    provider: "vertex-gemini",
    operation: input.operation,
    env: input.env,
    businessId,
    week,
    month,
    model: input.model,
    location: input.location,
    ...input.usage,
    costUsd,
    weekCostUsd: totals.weekCostUsd,
    monthCostUsd: totals.monthCostUsd,
    ...(input.extra ?? {}),
  });
  return { costUsd, costPhp: Math.round(costUsd * USD_TO_PHP * 10_000) / 10_000 };
}

/**
 * Partner quota: claims one question for this month before calling the model
 * (server-side, transactional). Returns remaining after the claim, or null if full tier.
 */
export async function claimQuestion(store: DocStore, businessId: string, tier: Tier, now: Date): Promise<{ ok: boolean; remaining: number | null }> {
  const month = monthKeyFor(now);
  const week = weekIdFor(now);
  return store.runTransaction(async (tx) => {
    const cur = (await tx.get<CompanionUsage>(companionPaths.usage(businessId))) ?? ({ months: {}, weeks: {}, updatedAt: "" } as CompanionUsage);
    const m = cur.months?.[month] ?? empty();
    if (tier === "partner" && m.questions >= PARTNER_MONTHLY_QUESTIONS) return { ok: false, remaining: 0 };
    const w = cur.weeks?.[week] ?? empty();
    tx.set(companionPaths.usage(businessId), {
      months: { ...cur.months, [month]: { ...m, questions: m.questions + 1 } },
      weeks: { ...cur.weeks, [week]: { ...w, questions: w.questions + 1 } },
      updatedAt: now.toISOString(),
    });
    return { ok: true, remaining: tier === "partner" ? PARTNER_MONTHLY_QUESTIONS - m.questions - 1 : null };
  });
}

export async function releaseQuestion(store: DocStore, businessId: string, now: Date) {
  const month = monthKeyFor(now);
  const week = weekIdFor(now);
  await store.runTransaction(async (tx) => {
    const cur = await tx.get<CompanionUsage>(companionPaths.usage(businessId));
    if (!cur) return;
    const m = cur.months?.[month] ?? empty();
    const w = cur.weeks?.[week] ?? empty();
    tx.set(companionPaths.usage(businessId), {
      months: { ...cur.months, [month]: { ...m, questions: Math.max(0, m.questions - 1) } },
      weeks: { ...cur.weeks, [week]: { ...w, questions: Math.max(0, w.questions - 1) } },
      updatedAt: now.toISOString(),
    });
  });
}

export async function questionsUsed(store: DocStore, businessId: string, now: Date): Promise<number> {
  const cur = await store.get<CompanionUsage>(companionPaths.usage(businessId));
  return cur?.months?.[monthKeyFor(now)]?.questions ?? 0;
}
