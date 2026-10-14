import { HttpError } from "../../lib/errors.js";
import type { Business } from "../../models/types.js";
import type { Doc, DocStore } from "../../store/doc-store.js";
import type { CompanionModel, ModelUsage } from "./model.js";
import { companionSystemPrompt } from "./companion-prompt.js";
import { makeToolRunner, TOOL_DECLS } from "./tools.js";
import { claimQuestion, companionPaths, PARTNER_MONTHLY_QUESTIONS, questionsUsed, recordAiCost, releaseQuestion, tierOf, type Tier } from "./store.js";

/** businesses/{id}/companion/threads/messages/{id} */
export interface CompanionMessage {
  role: "owner" | "companion";
  kind: "chat" | "tip" | "alert";
  text: string;
  /** Older weekly-tip messages stored the tips as a list; new ones keep everything in text. */
  tips?: { title: string; body: string }[];
  /** Partner tip message with more tips waiting on Pro or Lifetime. */
  locked?: boolean;
  weekId?: string;
  uid?: string;
  model?: string;
  usage?: ModelUsage;
  costUsd?: number;
  toolsUsed?: string[];
  createdAt: string;
}

const HISTORY = 12;

/** One continuous thread per shop, newest page first; `before` (an ISO createdAt) pages further back. */
export async function listMessages(store: DocStore, businessId: string, limit = 50, before?: string) {
  return listRaw(store, businessId, limit, before);
}

/** The page the owner sees (alerts hidden for Partner), oldest first, plus whether older messages exist. */
export async function messagePage(store: DocStore, businessId: string, tier: Tier, limit: number, before?: string) {
  const rows = await listRaw(store, businessId, limit + 1, before);
  const page = rows.slice(-limit);
  return { messages: page.filter((m) => visible(m, tier)).map((m) => messageView(m, tier)), hasMore: rows.length > limit };
}

async function listRaw(store: DocStore, businessId: string, limit: number, before?: string) {
  const rows = await store.list<CompanionMessage>(companionPaths.messages(businessId), {
    ...(before ? { where: [["createdAt", "<", before] as [string, "<", unknown]] } : {}),
    orderBy: { field: "createdAt", direction: "desc" },
    limit,
  });
  return rows.reverse();
}

/**
 * What the app shows: plain text bubbles, same as Barbers.ph (no cards, no blurred tips).
 * Older tip messages that stored a list are flattened to text; Partner shops see their first tip only.
 * Alerts are Pro/Lifetime (Partner shops never get new ones; old ones are hidden).
 */
export function messageView(m: CompanionMessage & { id: string }, tier: Tier) {
  const base = { id: m.id, role: m.role, kind: m.kind, text: m.text, weekId: m.weekId, createdAt: m.createdAt, locked: m.locked ?? false };
  if (m.kind === "tip" && m.tips?.length) {
    const shown = tier === "full" ? m.tips : m.tips.slice(0, 1);
    const hidden = m.tips.length - shown.length;
    const text = `${m.text ? `${m.text}\n\n` : ""}${shown.map((t, i) => `${i + 1}. ${t.title}: ${t.body}`).join("\n")}${hidden ? `\n\n${hidden} more tips are waiting for you on Pro or Lifetime.` : ""}`;
    return { ...base, text, locked: hidden > 0 };
  }
  return base;
}

const visible = (m: CompanionMessage, tier: Tier) => !(m.kind === "alert" && tier !== "full");

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
    throw new HttpError(402, "companion_quota", `You've used your ${PARTNER_MONTHLY_QUESTIONS} Partner questions this month. Upgrade to Pro or Lifetime for unlimited chat.`);
  }
  const history = await listMessages(store, business.id, HISTORY);
  const ownerMsg: CompanionMessage = { role: "owner", kind: "chat", text: input.text, uid: input.uid, createdAt: now.toISOString() };
  const ownerId = store.newId();
  await store.set(companionPaths.message(business.id, ownerId), { ...ownerMsg });

  const tools = makeToolRunner({ store, business, uid: input.uid, now, paid: tier === "full", lastUserText: input.text });
  const turns = history
    .filter((m) => visible(m, tier))
    .map((m) => ({ role: m.role === "owner" ? ("user" as const) : ("model" as const), text: `${m.kind === "tip" ? "[Weekly tip] " : m.kind === "alert" ? "[Alert] " : ""}${messageView({ ...m, id: "" }, tier).text}` }));
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
      tools: TOOL_DECLS,
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
