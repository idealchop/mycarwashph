import { HttpError } from "../../lib/errors.js";
import type { Business } from "../../models/types.js";
import type { Doc, DocStore } from "../../store/doc-store.js";
import type { CompanionModel, ModelUsage } from "./model.js";
import { companionSystemPrompt } from "./companion-prompt.js";
import { makeToolRunner, TOOL_DECLS } from "./tools.js";
import { claimQuestion, companionPaths, PARTNER_MONTHLY_QUESTIONS, questionsUsed, recordAiCost, releaseQuestion, tierOf, type Tier } from "./store.js";
import type { InsightTip } from "./prompt.js";

/** businesses/{id}/companion/threads/messages/{id} */
export interface CompanionMessage {
  role: "owner" | "companion";
  kind: "chat" | "tip" | "alert";
  text: string;
  tips?: InsightTip[];
  weekId?: string;
  uid?: string;
  model?: string;
  usage?: ModelUsage;
  costUsd?: number;
  toolsUsed?: string[];
  createdAt: string;
}

const HISTORY = 12;

export async function listMessages(store: DocStore, businessId: string, limit = 50) {
  const rows = await store.list<CompanionMessage>(companionPaths.messages(businessId), { orderBy: { field: "createdAt", direction: "desc" }, limit });
  return rows.reverse();
}

/** Server-side gating of a message for the shop's tier: Partner sees 1 tip of the weekly set, no alerts. */
export function messageView(m: CompanionMessage & { id: string }, tier: Tier) {
  const base = { id: m.id, role: m.role, kind: m.kind, text: m.text, weekId: m.weekId, createdAt: m.createdAt };
  if (m.kind === "tip") {
    const tips = m.tips ?? [];
    return tier === "full" ? { ...base, tips, lockedCount: 0 } : { ...base, tips: tips.slice(0, 1), lockedCount: Math.max(0, tips.length - 1) };
  }
  if (m.kind === "alert" && tier !== "full") return { ...base, text: "", locked: true };
  return base;
}

export async function quotaFor(store: DocStore, business: Doc<Business>, now: Date) {
  const tier = tierOf(business);
  if (tier === "full") return { tier, limit: null, used: null, remaining: null };
  const used = await questionsUsed(store, business.id, now);
  return { tier, limit: PARTNER_MONTHLY_QUESTIONS, used, remaining: Math.max(0, PARTNER_MONTHLY_QUESTIONS - used) };
}

/**
 * One owner question -> companion answer. Quota is claimed before the model call
 * (and released on failure). Saves both messages and logs the cost.
 */
export async function askCompanion(
  store: DocStore,
  model: CompanionModel,
  input: { business: Doc<Business>; uid: string; text: string; now: Date; env: string },
) {
  const { business, now } = input;
  const tier = tierOf(business);
  const claim = await claimQuestion(store, business.id, tier, now);
  if (!claim.ok) {
    throw new HttpError(402, "companion_quota", `You've used your ${PARTNER_MONTHLY_QUESTIONS} free questions this month. Upgrade to Pro for unlimited chat.`);
  }
  const history = await listMessages(store, business.id, HISTORY);
  const ownerMsg: CompanionMessage = { role: "owner", kind: "chat", text: input.text, uid: input.uid, createdAt: now.toISOString() };
  const ownerId = store.newId();
  await store.set(companionPaths.message(business.id, ownerId), { ...ownerMsg });

  const tools = makeToolRunner({ store, business, uid: input.uid, now, canSetGoals: tier === "full" });
  const turns = history
    .filter((m) => m.kind === "chat" || (tier === "full" && m.text))
    .map((m) => ({ role: m.role === "owner" ? ("user" as const) : ("model" as const), text: m.kind === "tip" ? `${m.text}\n${(m.tips ?? []).map((t) => `- ${t.title}: ${t.body}`).join("\n")}` : m.text }));
  turns.push({ role: "user", text: input.text });
  // Gemini needs the conversation to start with a user turn.
  while (turns.length && turns[0]!.role !== "user") turns.shift();

  let result;
  try {
    result = await model.chat({
      system: companionSystemPrompt({
        shopName: business.name,
        todayLabel: now.toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        tier,
      }),
      turns,
      tools: tier === "full" ? TOOL_DECLS : TOOL_DECLS.filter((t) => t.name !== "setGoal"),
      callTool: (name, args) => tools.run(name, args),
    });
  } catch (err) {
    await releaseQuestion(store, business.id, now);
    await store.delete(companionPaths.message(business.id, ownerId));
    throw new HttpError(502, "companion_failed", "River couldn't answer right now. Please try again in a bit.", { reason: (err as Error).message.slice(0, 200) });
  }
  const at = new Date(now.getTime() + 1).toISOString();
  const cost = await recordAiCost(store, business.id, {
    now, env: input.env, operation: "chat", model: result.model, location: result.location, usage: result.usage,
    extra: { tier, toolsUsed: result.toolsUsed },
  });
  const reply: CompanionMessage = {
    role: "companion",
    kind: "chat",
    text: result.text || "Pasensya, wala akong maisagot diyan ngayon. Pwede mo bang ulitin?",
    model: result.model,
    usage: result.usage,
    costUsd: cost.costUsd,
    toolsUsed: result.toolsUsed,
    createdAt: at,
  };
  const replyId = store.newId();
  await store.set(companionPaths.message(business.id, replyId), { ...reply });
  return {
    question: messageView({ ...ownerMsg, id: ownerId }, tier),
    answer: messageView({ ...reply, id: replyId }, tier),
    remaining: claim.remaining,
  };
}
