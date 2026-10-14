import { badRequest } from "../../lib/errors.js";
import type { DocStore } from "../../store/doc-store.js";
import { rangeFor } from "./periods.js";
import { companionPaths, loadShopData } from "./store.js";
import type { InsightsInput } from "./metrics.js";

export interface Goal {
  id: string;
  metric: "revenue" | "cars";
  period: "month" | "week";
  /** Pesos for revenue, cars for cars. */
  target: number;
  label: string;
  createdAt: string;
}

export async function listGoals(store: DocStore, businessId: string): Promise<Goal[]> {
  return (await store.get<{ goals: Goal[] }>(companionPaths.goals(businessId)))?.goals ?? [];
}

/** Server-side goal write (the only business-adjacent write besides chat messages). One goal per metric+period. */
export async function saveGoal(store: DocStore, businessId: string, input: { metric: Goal["metric"]; period: Goal["period"]; target: number }, now: Date): Promise<Goal> {
  if (!["revenue", "cars"].includes(input.metric) || !["month", "week"].includes(input.period)) throw badRequest("Unknown goal type.");
  const target = Math.round(Number(input.target));
  if (!Number.isFinite(target) || target <= 0 || target > 100_000_000) throw badRequest("Goal target must be a positive number.");
  const goals = (await listGoals(store, businessId)).filter((g) => !(g.metric === input.metric && g.period === input.period));
  const goal: Goal = {
    id: `${input.metric}_${input.period}`,
    metric: input.metric,
    period: input.period,
    target,
    label: input.metric === "revenue" ? `₱${target.toLocaleString("en-US")} per ${input.period}` : `${target} cars per ${input.period}`,
    createdAt: now.toISOString(),
  };
  await store.set(companionPaths.goals(businessId), { goals: [...goals, goal].slice(-6), updatedAt: now.toISOString() });
  return goal;
}

export async function deleteGoal(store: DocStore, businessId: string, id: string, now: Date) {
  const goals = (await listGoals(store, businessId)).filter((g) => g.id !== id);
  await store.set(companionPaths.goals(businessId), { goals, updatedAt: now.toISOString() });
}

/** Progress of each goal in the current Manila week/month, with the pace needed to hit it. */
export function goalProgress(goals: Goal[], data: InsightsInput) {
  const now = data.now;
  return goals.map((g) => {
    const range = rangeFor(g.period === "month" ? "this_month" : "this_week", now);
    const sales = data.sales.filter((s) => s.status === "recorded" && Date.parse(s.paidAt) >= range.from.getTime() && Date.parse(s.paidAt) < range.to.getTime());
    const actual = g.metric === "revenue" ? Math.round(sales.reduce((a, s) => a + s.amountCentavos, 0) / 100) : sales.length;
    const spanDays = g.period === "month"
      ? new Date(Date.UTC(new Date(range.from.getTime() + 8 * 3_600_000).getUTCFullYear(), new Date(range.from.getTime() + 8 * 3_600_000).getUTCMonth() + 1, 0)).getUTCDate()
      : 7;
    const elapsedDays = Math.max(1, Math.ceil((now.getTime() - range.from.getTime()) / 86_400_000));
    const daysLeft = Math.max(0, spanDays - elapsedDays);
    const projected = Math.round((actual / elapsedDays) * spanDays);
    return {
      goal: g.label,
      metric: g.metric,
      period: g.period,
      target: g.target,
      actual,
      percent: Math.round((actual / g.target) * 1000) / 10,
      periodLabel: range.label,
      daysElapsed: elapsedDays,
      daysLeft,
      projectedEndOfPeriod: projected,
      onTrack: projected >= g.target,
      neededPerDay: daysLeft > 0 ? Math.max(0, Math.ceil((g.target - actual) / daysLeft)) : 0,
    };
  });
}

export async function goalProgressFor(store: DocStore, businessId: string, now: Date) {
  const goals = await listGoals(store, businessId);
  if (!goals.length) return [];
  return goalProgress(goals, await loadShopData(store, businessId, now));
}
