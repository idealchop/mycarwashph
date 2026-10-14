import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../deps.js";
import { requireMembership } from "../middleware/business-middleware.js";
import { getBusiness, getUser } from "../middleware/context.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../lib/errors.js";
import { askCompanion, messagePage, quotaFor } from "../services/companion/chat-service.js";
import { listGoals } from "../services/companion/goals.js";
import { tierOf } from "../services/companion/store.js";
import { weeklyTips } from "../services/companion/tips-service.js";

const askSchema = z.object({ text: z.string().trim().min(1).max(500) });
const PAGE = 30;

function requireAi(deps: Deps) {
  if (!deps.config.companionEnabled || !deps.ai) throw new HttpError(503, "companion_disabled", "AI Companion is coming soon for your shop.");
  return deps.ai;
}

/**
 * /businesses/:businessId/companion* (owners only). Same surface as Barbers.ph:
 * the single thread (newest page, older with ?before), ask, and the owner's weekly-tips run.
 */
export function companionRoutes(deps: Deps) {
  const { store } = deps;
  const r = Router({ mergeParams: true });
  const owner = requireMembership(store, ["owner"]);
  const env = () => deps.config.envName ?? "unknown";

  r.get("/companion", owner, async (_req, res) => {
    const b = getBusiness(res);
    const tier = tierOf(b);
    const [page, goals, quota] = await Promise.all([messagePage(store, b.id, tier, PAGE), listGoals(store, b.id), quotaFor(store, b, deps.now())]);
    res.json({ data: { enabled: !!deps.config.companionEnabled, tier, quota, goals: tier === "full" ? goals : [], ...page } });
  });

  // Older messages of the single thread, loaded as the owner scrolls up.
  r.get("/companion/messages", owner, async (req, res) => {
    const b = getBusiness(res);
    const before = typeof req.query.before === "string" ? req.query.before.slice(0, 40) : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || PAGE, 1), 50);
    const page = await messagePage(store, b.id, tierOf(b), limit, before);
    res.json({ data: page.messages, hasMore: page.hasMore });
  });

  r.post("/companion/messages", owner, validateBody(askSchema), async (req, res) => {
    const ai = requireAi(deps);
    const out = await askCompanion(store, ai, { business: getBusiness(res), uid: getUser(res).uid, text: req.body.text, now: deps.now(), env: env() });
    res.status(201).json({ data: out });
  });

  // This week's Monday tips for the owner's shop (Barbers /api/companion/weekly). Re-running a sent week is dev-only.
  r.post("/companion/weekly", owner, validateBody(z.object({ force: z.boolean().optional() })), async (req, res) => {
    const ai = requireAi(deps);
    try {
      res.status(201).json({ data: await weeklyTips(store, ai, getBusiness(res), { now: deps.now(), env: env(), force: !!req.body.force && !!deps.config.devTools }) });
    } catch (err) {
      throw new HttpError(502, "companion_failed", "Couldn't write tips right now.", { reason: (err as Error).message.slice(0, 200) });
    }
  });

  return r;
}
