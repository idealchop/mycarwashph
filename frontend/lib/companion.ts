"use client";

import { api } from "./api";

/** One message of the shop's single Companion thread. Plain text, same as Barbers.ph. */
export interface CompanionMessage {
  id: string;
  role: "owner" | "companion";
  /** chat = Q&A, tip = Monday tips, alert = Pro/Lifetime heads-up. */
  kind: "chat" | "tip" | "alert";
  text: string;
  /** Partner tip message with more tips waiting on Pro or Lifetime. */
  locked?: boolean;
  weekId?: string;
  createdAt: string;
}

export interface CompanionState {
  enabled: boolean;
  tier: "full" | "partner";
  quota: { limit: number | null; used: number | null; remaining: number | null };
  goals: { id: string; label: string }[];
  messages: CompanionMessage[];
  /** Older messages exist above the first one (load with getOlderMessages). */
  hasMore: boolean;
}

export const getCompanion = (shopId: string) => api<{ data: CompanionState }>(`/businesses/${shopId}/companion`).then((r) => r.data);
/** The page of the single thread before `before` (an ISO createdAt), oldest first. */
export const getOlderMessages = (shopId: string, before: string, limit = 30) =>
  api<{ data: CompanionMessage[]; hasMore: boolean }>(`/businesses/${shopId}/companion/messages?limit=${limit}&before=${encodeURIComponent(before)}`);
export const askCompanion = (shopId: string, text: string) =>
  api<{ data: { question: CompanionMessage; answer: CompanionMessage; remaining: number | null } }>(`/businesses/${shopId}/companion/messages`, { method: "POST", body: { text } }).then((r) => r.data);
