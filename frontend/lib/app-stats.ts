/**
 * App-store style stats on the Install page (Jimboy, 2026-10-20).
 *
 * No fake numbers (Jimboy, 2026-11-02): the stats row only shows once real ratings exist.
 * Once at least REAL_STATS_MIN ratings are saved (appFeedback, via /api/feedback), the page switches
 * automatically to the real average and rating count.
 */
export const REAL_STATS_MIN = 1;

export interface FeedbackSummary { count: number; sum: number }

/** What the stats row shows: real numbers once there are enough ratings, else the placeholders. */
export function displayStats(real?: FeedbackSummary | null) {
  if (real && real.count >= REAL_STATS_MIN) {
    const avg = Math.round((real.sum / real.count) * 10) / 10;
    return { rating: avg.toFixed(1), count: compact(real.count), countLabel: real.count === 1 ? "rating" : "ratings", real: true };
  }
  return { rating: "", count: "", countLabel: "", real: false };
}

export function compact(n: number) {
  return n >= 1000 ? `${(Math.floor(n / 100) / 10).toString()}k+` : String(n);
}
