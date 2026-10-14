import type { MetricsSnapshot } from "./metrics.js";

/**
 * Prompt for the weekly owner tips. Structure follows Smart Refill's River AI
 * prompts (role, hard rules, grounded data block, strict JSON output), tuned for
 * a Philippine car wash.
 */
export const INSIGHTS_SYSTEM_PROMPT = [
  "You are River Insights for Mycarwash.ph, a friendly business coach for small car wash owners in the Philippines.",
  "Each week you read ONLY the aggregated numbers you are given and write 3 to 5 short, practical tips the owner can act on this week.",
  "",
  "Rules:",
  "- Ground every tip in a specific number from the data (peso amount, day, hour, percent, count). Never invent numbers, services, bays or events.",
  "- Car wash focus: staffing for busy days and hours, cars per hour and bay use, queue peaks and wait times, package/service mix and upsells (e.g. wax, interior, engine wash), repeat customers, bookings and no-shows, payment methods.",
  "- Plain language a busy owner reads in 10 seconds. Write in simple English or natural Taglish (mix Tagalog and English like a Manila shop owner would). Pick one and stay consistent.",
  "- Each tip: a short title (max 8 words) and a body of 1-2 sentences (max 240 characters).",
  "- Be encouraging and specific, never preachy. No emojis, no markdown, no hashtags.",
  "- If data is thin (few cars or few days), say so gently in the summary and keep tips modest.",
  "- Never mention customers by name or ask for personal data. You never receive it.",
  "",
  "Return JSON only, matching the schema: a one-sentence summary of the week, the language you used, and the tips.",
].join("\n");

export const INSIGHTS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    language: { type: "string", enum: ["en", "taglish"] },
    tips: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          category: { type: "string", enum: ["staffing", "throughput", "queue", "services", "customers", "bookings", "revenue", "payments"] },
        },
        required: ["title", "body", "category"],
      },
    },
  },
  required: ["summary", "language", "tips"],
} as const;

export function buildUserPrompt(input: { shopName: string; metrics: MetricsSnapshot }): string {
  return [
    `Shop: ${input.shopName} (car wash). Amounts are in Philippine pesos. Times are Asia/Manila.`,
    "Last 7 and 28 days of aggregated data:",
    JSON.stringify(input.metrics),
    "Write this week's tips.",
  ].join("\n");
}

export interface InsightTip {
  title: string;
  body: string;
  category: string;
}

export interface ParsedInsight {
  summary: string;
  language: "en" | "taglish";
  tips: InsightTip[];
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** Validates and clamps the model output; throws when unusable. */
export function parseInsight(text: string): ParsedInsight {
  const raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Record<string, unknown>;
  const tips = (Array.isArray(raw.tips) ? raw.tips : [])
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return { title: clip(o.title, 80), body: clip(o.body, 320), category: clip(o.category, 20) || "revenue" };
    })
    .filter((x) => x.title && x.body)
    .slice(0, 5);
  if (tips.length < 1) throw new Error("Model returned no usable tips.");
  return { summary: clip(raw.summary, 300), language: raw.language === "taglish" ? "taglish" : "en", tips };
}
