import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../deps.js";
import { requireMembership } from "../middleware/business-middleware.js";
import { getBusiness, getUser } from "../middleware/context.js";
import { validateBody } from "../middleware/validate.js";
import { forbidden, HttpError, notFound } from "../lib/errors.js";
import { listMyBusinesses } from "../services/businesses-service.js";
import { detectAlerts } from "../services/companion/alerts.js";
import { askCompanion, listMessages, messageView, quotaFor } from "../services/companion/chat-service.js";
import { seedDemoData } from "../services/companion/dev-seed.js";
import { deleteGoal, goalProgressFor, saveGoal } from "../services/companion/goals.js";
import { tierOf } from "../services/companion/store.js";
import { generateWeeklyTips, listInsights, type Insight } from "../services/companion/tips-service.js";
import type { Doc } from "../store/doc-store.js";

const askSchema = z.object({ text: z.string().trim().min(1).max(500) });
const goalSchema = z.object({ metric: z.enum(["revenue", "cars"]), period: z.enum(["month", "week"]), target: z.number().positive().max(100_000_000) });

/** Server-side tier gating of a weekly insight: Partner gets the first tip only, no metrics. */
export function insightView(i: Doc<Insight>, tier: "full" | "partner") {
  const base = { id: i.id, weekId: i.weekId, createdAt: i.createdAt, summary: i.summary, language: i.language };
  return tier === "full"
    ? { ...base, tips: i.tips, lockedCount: 0, metrics: i.metrics }
    : { ...base, tips: i.tips.slice(0, 1), lockedCount: Math.max(0, i.tips.length - 1), metrics: null };
}

function requireAi(deps: Deps) {
  if (!deps.config.companionEnabled || !deps.ai) throw new HttpError(503, "companion_disabled", "AI Companion is coming soon for your shop.");
  return deps.ai;
}

/** /businesses/:businessId/companion* (owners only). */
export function companionRoutes(deps: Deps) {
  const { store } = deps;
  const r = Router({ mergeParams: true });
  const owner = requireMembership(store, ["owner"]);
  const env = () => deps.config.envName ?? "unknown";

  r.get("/companion", owner, async (_req, res) => {
    const b = getBusiness(res);
    const tier = tierOf(b);
    const now = deps.now();
    const [messages, insights, quota] = await Promise.all([listMessages(store, b.id, 60), listInsights(store, b.id, 1), quotaFor(store, b, now)]);
    res.json({
      data: {
        enabled: !!deps.config.companionEnabled,
        tier,
        quota,
        latest: insights[0] ? insightView(insights[0], tier) : null,
        messages: messages.map((m) => messageView(m, tier)),
        goals: tier === "full" ? await goalProgressFor(store, b.id, now) : null,
      },
    });
  });

  r.post("/companion/messages", owner, validateBody(askSchema), async (req, res) => {
    const ai = requireAi(deps);
    const out = await askCompanion(store, ai, { business: getBusiness(res), uid: getUser(res).uid, text: req.body.text, now: deps.now(), env: env() });
    res.status(201).json({ data: out });
  });

  r.get("/companion/insights", owner, async (_req, res) => {
    const b = getBusiness(res);
    res.json({ data: (await listInsights(store, b.id, 26)).map((i) => insightView(i, tierOf(b))) });
  });

  r.put("/companion/goals", owner, validateBody(goalSchema), async (req, res) => {
    const b = getBusiness(res);
    if (tierOf(b) !== "full") throw new HttpError(402, "plan_required", "Goals come with Pro or Lifetime.");
    await saveGoal(store, b.id, req.body, deps.now());
    res.json({ data: await goalProgressFor(store, b.id, deps.now()) });
  });
  r.delete("/companion/goals/:goalId", owner, async (req, res) => {
    await deleteGoal(store, getBusiness(res).id, String(req.params.goalId).slice(0, 40), deps.now());
    res.status(204).end();
  });

  // Manual run of the Monday job for this shop: River Apps admins anywhere, shop owners only in dev.
  r.post("/companion/tips/run", owner, async (_req, res) => {
    if (!getUser(res).platformAdmin && !deps.config.devTools) throw forbidden("Weekly tips run automatically on Mondays.");
    const ai = requireAi(deps);
    const b = getBusiness(res);
    const out = await generateWeeklyTips(store, ai, b, { now: deps.now(), env: env(), trigger: "manual" });
    const alerts = await detectAlerts(store, b, deps.now());
    if (out.status === "skipped") throw new HttpError(422, "not_enough_data", "Not enough cars yet. Record a few days of walk-ins and sales first.");
    res.status(201).json({ data: { insight: insightView(out.insight, tierOf(b)), alerts: alerts.length } });
  });

  // DEV DATABASE ONLY: seed demo walk-ins/bookings/sales into your own shop (and optionally set its plan).
  r.post("/dev/seed-companion-demo", owner, validateBody(z.object({ plan: z.enum(["partner", "paid"]).optional() })), async (req, res) => {
    if (!deps.config.devTools) throw notFound();
    res.status(201).json({ data: await seedDemoData(store, getBusiness(res), { now: deps.now(), plan: req.body.plan }) });
  });

  return r;
}

/** /me/companion/combined: multi-shop owners, latest tips per shop + combined totals (Pro/Lifetime shops). */
export function meCompanionRoutes(deps: Deps) {
  const r = Router();
  r.get("/me/companion/combined", async (_req, res) => {
    const owned = (await listMyBusinesses(deps.store, getUser(res).uid)).filter((x) => x.role === "owner");
    const shops = [];
    const totals = { revenue7: 0, cars7: 0, revenue28: 0, cars28: 0 };
    for (const { business } of owned) {
      const tier = tierOf(business);
      const latest = (await listInsights(deps.store, business.id, 1))[0];
      if (latest && tier === "full") {
        totals.revenue7 += latest.metrics.last7.revenuePesos;
        totals.cars7 += latest.metrics.last7.carsServed;
        totals.revenue28 += latest.metrics.last28.revenuePesos;
        totals.cars28 += latest.metrics.last28.carsServed;
      }
      shops.push({ businessId: business.id, name: business.name, tier, latest: latest ? insightView(latest, tier) : null });
    }
    res.json({ data: { shops, totals: shops.some((s) => s.tier === "full") ? totals : null } });
  });
  return r;
}
