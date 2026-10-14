"use client";

import { api } from "./api";

export interface Tip {
  title: string;
  body: string;
  category: string;
}

export interface CompanionMessage {
  id: string;
  role: "owner" | "companion";
  kind: "chat" | "tip" | "alert";
  text: string;
  tips?: Tip[];
  lockedCount?: number;
  locked?: boolean;
  weekId?: string;
  createdAt: string;
}

export interface InsightView {
  id: string;
  weekId: string;
  createdAt: string;
  summary: string;
  tips: Tip[];
  lockedCount: number;
}

export interface GoalProgress {
  goal: string;
  metric: "revenue" | "cars";
  period: "month" | "week";
  target: number;
  actual: number;
  percent: number;
  periodLabel: string;
  daysLeft: number;
  projectedEndOfPeriod: number;
  onTrack: boolean;
  neededPerDay: number;
}

export interface CompanionState {
  enabled: boolean;
  tier: "full" | "partner";
  quota: { limit: number | null; used: number | null; remaining: number | null };
  latest: InsightView | null;
  messages: CompanionMessage[];
  /** Older messages exist above the first one (load with getOlderMessages). */
  hasMore?: boolean;
  goals: GoalProgress[] | null;
}

export const getCompanion = (shopId: string) => api<{ data: CompanionState }>(`/businesses/${shopId}/companion`).then((r) => r.data);
/** The page of the single thread before `before` (an ISO createdAt), oldest first. */
export const getOlderMessages = (shopId: string, before: string, limit = 30) =>
  api<{ data: CompanionMessage[]; hasMore: boolean }>(`/businesses/${shopId}/companion/messages?limit=${limit}&before=${encodeURIComponent(before)}`);
export const askCompanion = (shopId: string, text: string) =>
  api<{ data: { question: CompanionMessage; answer: CompanionMessage; remaining: number | null } }>(`/businesses/${shopId}/companion/messages`, { method: "POST", body: { text } }).then((r) => r.data);
export const getInsights = (shopId: string) => api<{ data: InsightView[] }>(`/businesses/${shopId}/companion/insights`).then((r) => r.data);
export const saveGoal = (shopId: string, body: { metric: "revenue" | "cars"; period: "month" | "week"; target: number }) =>
  api<{ data: GoalProgress[] }>(`/businesses/${shopId}/companion/goals`, { method: "PUT", body }).then((r) => r.data);

/** Dev environment only (the API returns 404 elsewhere). */
