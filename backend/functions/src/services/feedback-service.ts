import type { DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";

/**
 * App ratings (Install page, ported from Barbers.ph, Oct 23, 2026).
 * businesses/{id}/app_feedback/{uid}: one rating per person per shop; a later rating replaces the earlier one.
 * app_stats/feedback keeps count + sum so the Install page never scans ratings. Server only.
 */
export interface FeedbackSummary { count: number; sum: number }
export interface AppFeedback { uid: string; rating: number; comment: string; createdAt: string; updatedAt: string }

export async function feedbackSummary(store: DocStore): Promise<FeedbackSummary> {
  const s = await store.get<Partial<FeedbackSummary>>(paths.feedbackSummary());
  return { count: Number(s?.count) || 0, sum: Number(s?.sum) || 0 };
}

export async function myFeedback(store: DocStore, businessId: string, uid: string) {
  const d = await store.get<AppFeedback>(paths.appFeedback(businessId, uid));
  return d ? { rating: d.rating, comment: d.comment || "" } : null;
}

export async function saveFeedback(store: DocStore, businessId: string, uid: string, f: { rating: number; comment: string }, now: Date) {
  const at = now.toISOString();
  const ref = paths.appFeedback(businessId, uid);
  await store.runTransaction(async (tx) => {
    const prev = await tx.get<AppFeedback>(ref);
    const sum = await tx.get<Partial<FeedbackSummary>>(paths.feedbackSummary());
    tx.set(ref, { uid, rating: f.rating, comment: f.comment, createdAt: prev?.createdAt ?? at, updatedAt: at });
    tx.set(paths.feedbackSummary(), {
      count: (Number(sum?.count) || 0) + (prev ? 0 : 1),
      sum: (Number(sum?.sum) || 0) + f.rating - (prev?.rating ?? 0),
      updatedAt: at,
    });
    await writeAudit(store, businessId, { actor: { type: "user", id: uid }, action: "feedback.save", target: ref, meta: { rating: f.rating } }, now, tx);
  });
  return feedbackSummary(store);
}
