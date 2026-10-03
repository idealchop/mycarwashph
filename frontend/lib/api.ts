"use client";

import { firebaseAuth } from "./firebase";

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5001/demo-mycarwash/asia-southeast1/mycarwashApi";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Calls the mycarwashApi function with the signed-in user's Firebase ID token. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new ApiError(401, "unauthorized", "Please sign in.");
  const token = await user.getIdToken();
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.code ?? "error", json.title ?? "Something went wrong.");
  return json as T;
}

export type Plan = "partner" | "paid";
export interface MeResponse {
  user: { uid: string; phoneNumber: string | null; email: string | null; name: string | null };
  businesses: { id: string; name: string; plan: Plan; role: "owner" | "staff" }[];
}
export interface Booking {
  id: string;
  reference: string;
  status: string;
  serviceIds: string[];
  vehicleSize: string;
  plate: string | null;
  scheduledStart: string;
  customerSnapshot: { name: string; phoneE164: string | null };
  source: string;
  checkedInAt: string | null;
}
export interface Service {
  id: string;
  name: string;
  durationMins: number;
  pricesBySize: Partial<Record<string, number | null>>;
}
export interface Bay {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}
export interface QueueItem {
  id: string;
  queueNumber: number;
  status: string;
  bayId: string | null;
  serviceIds: string[];
  plate: string | null;
  source: string;
  startedAt: string | null;
  createdAt: string;
}
export interface VerifyResult {
  booking: Booking;
  queueItem: QueueItem | null;
}
