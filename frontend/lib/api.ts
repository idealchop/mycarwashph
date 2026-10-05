"use client";

import { firebaseAuth } from "./firebase";

/**
 * Same-origin proxy (app/api/[...path]/route.ts) to the private shop API function
 * of this environment. NEXT_PUBLIC_API_BASE_URL can point elsewhere if needed.
 */
const apiBase = () => process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Calls the shop API (via /api) with the signed-in user's Firebase ID token. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new ApiError(401, "unauthorized", "Please sign in.");
  const token = await user.getIdToken();
  const res = await fetch(`${apiBase()}${path}`, {
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
export type PartnerBillingOption = "monthly" | "lifetime";
export type BillingStatus = "trial" | "unpaid" | "pending" | "active" | "suspended";
export type BillingPaymentMethod = "gcash" | "maya" | "bank" | "other";

export interface ShopLocation {
  lat: number;
  lng: number;
  formattedAddress: string | null;
  placeId: string | null;
}

export interface BusinessBilling {
  partnerOption: PartnerBillingOption | null;
  status: BillingStatus;
  lastPayment: {
    amountCentavos: number;
    method: BillingPaymentMethod;
    paymentRef: string | null;
    recordedAt: string;
    recordedBy: string;
  } | null;
  activatedAt: string | null;
  expiresAt: string | null;
  checkoutProvider: "manual" | "stub" | null;
}

export interface BusinessProfile {
  id: string;
  name: string;
  plan: Plan;
  planStatus?: "active" | "suspended";
  phoneE164?: string | null;
  address?: string | null;
  location?: ShopLocation | null;
  riverMobile?: { listed: boolean; listedAt: string | null };
  bookingCapacity?: { slotMins: number; maxBookingsPerSlot: number };
  settings?: { dailyTargetCentavos: number | null };
  billing?: BusinessBilling | null;
}

export interface MeResponse {
  user: { uid: string; phoneNumber: string | null; email: string | null; name: string | null };
  businesses: {
    id: string;
    name: string;
    plan: Plan;
    planStatus?: "active" | "suspended";
    role: "owner" | "staff";
    address?: string | null;
    location?: ShopLocation | null;
    phoneE164?: string | null;
    riverMobileListed?: boolean;
    settings?: { dailyTargetCentavos: number | null };
    billing?: BusinessBilling | null;
  }[];
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
  vehicleSize?: string | null;
  plate: string | null;
  source: string;
  startedAt: string | null;
  doneAt?: string | null;
  bookingId?: string | null;
  createdAt: string;
}

export type PaymentMethod = "cash" | "gcash" | "maya" | "other";

export interface Sale {
  id: string;
  amountCentavos: number;
  method: PaymentMethod;
  paymentRef: string | null;
  status: string;
  serviceIds: string[];
  plate: string | null;
  customerName: string | null;
  paidAt: string;
}

export interface SalesSummary {
  date: string;
  totalCentavos: number;
  cars: number;
  byHour: { hour: number; label: string; centavos: number; count: number }[];
  recent: Sale[];
  previousDayTotalCentavos: number;
}

export interface Member {
  id: string;
  uid: string;
  role: "owner" | "staff";
  status: string;
  displayName: string | null;
  phoneE164: string | null;
  email: string | null;
}

export interface Invite {
  id: string;
  phoneE164: string | null;
  email: string | null;
  role: "owner" | "staff";
  status: string;
  createdAt: string;
}

export interface AlertItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  bookingId: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phoneE164: string | null;
  plate: string | null;
  vehicleSize: string | null;
}

export interface GrowthMetrics {
  date: string;
  bookingsRequestedOpen: number;
  bookingsAcceptedOrBeyond: number;
  queueToday: number;
  carsWashedToday: number;
  salesTodayCentavos: number;
  salesLast200Centavos: number;
  comingSoon: string[];
}
export interface VerifyResult {
  booking: Booking;
  queueItem: QueueItem | null;
}
