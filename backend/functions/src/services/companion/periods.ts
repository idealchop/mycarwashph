/** Manila calendar periods for companion tools. Manila is UTC+8 with no DST. */
const OFFSET = 8 * 3_600_000;
const DAY = 86_400_000;

export const PERIODS = ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_28_days", "this_month", "last_month"] as const;
export type Period = (typeof PERIODS)[number];

export interface Range {
  period: Period;
  from: Date;
  to: Date;
  label: string;
}

/** Midnight Manila of the Manila day containing `ms`, as a UTC instant. */
const manilaMidnight = (ms: number) => Math.floor((ms + OFFSET) / DAY) * DAY - OFFSET;
const fmt = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

export function rangeFor(period: Period, now: Date): Range {
  const n = now.getTime();
  const today = manilaMidnight(n);
  const local = new Date(n + OFFSET);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  const monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET;
  const lastMonthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) - OFFSET;
  const r = (from: number, to: number) => ({ period, from: new Date(from), to: new Date(to), label: `${fmt(new Date(from))} – ${fmt(new Date(to - 1))}` });
  switch (period) {
    case "today": return r(today, n);
    case "yesterday": return r(today - DAY, today);
    case "this_week": return r(today - dow * DAY, n);
    case "last_week": return r(today - (dow + 7) * DAY, today - dow * DAY);
    case "last_7_days": return r(n - 7 * DAY, n);
    case "last_28_days": return r(n - 28 * DAY, n);
    case "this_month": return r(monthStart, n);
    case "last_month": return r(lastMonthStart, monthStart);
  }
}

export function asPeriod(v: unknown, fallback: Period = "last_7_days"): Period {
  return (PERIODS as readonly string[]).includes(v as string) ? (v as Period) : fallback;
}

/** Days in the current Manila month and how many have fully or partly elapsed. */
export function monthProgress(now: Date) {
  const local = new Date(now.getTime() + OFFSET);
  const daysInMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  return { daysInMonth, dayOfMonth: local.getUTCDate() };
}
