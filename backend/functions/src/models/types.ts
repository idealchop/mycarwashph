/**
 * Firestore data model. Every business-scoped document lives under
 * businesses/{businessId}/... Money is integer centavos. Timestamps are ISO 8601
 * strings in UTC written by the server; shop-facing rendering uses PHT.
 */

export const ROLES = ["owner", "staff"] as const;
export type Role = (typeof ROLES)[number];

/** Partner = entry tier (booking + Scan); "paid" (data id) = Pro or Lifetime, the full shop system. */
export const PLANS = ["partner", "paid"] as const;
export type Plan = (typeof PLANS)[number];

/**
 * Standard pricing (approved Oct 14, 2026), centavos. Option ids stay data-compatible:
 * "monthly" = Pro, "lifetime" = Lifetime (1–5 locations), "lifetime_5plus" = Lifetime (5+ locations).
 */
export const PLAN_PRICING = {
  monthly: { name: "Pro", centavos: 49_900, originalCentavos: 95_000, cadence: "month", locations: "1 shop" },
  lifetime: { name: "Lifetime", centavos: 1_000_000, originalCentavos: 1_800_000, cadence: "one-time", locations: "1–5 locations" },
  lifetime_5plus: { name: "Lifetime", centavos: 2_000_000, originalCentavos: 3_500_000, cadence: "one-time", locations: "5+ locations" },
} as const;

/** Back-compat aliases. */
export const PARTNER_PRICING = {
  monthlyCentavos: PLAN_PRICING.monthly.centavos,
  lifetimeCentavos: PLAN_PRICING.lifetime.centavos,
  lifetime5PlusCentavos: PLAN_PRICING.lifetime_5plus.centavos,
} as const;

export const PARTNER_BILLING_OPTIONS = ["monthly", "lifetime", "lifetime_5plus"] as const;
export type PartnerBillingOption = (typeof PARTNER_BILLING_OPTIONS)[number];

export const BILLING_STATUSES = ["trial", "unpaid", "pending", "active", "suspended"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const BILLING_PAYMENT_METHODS = ["gcash", "maya", "bank", "other"] as const;
export type BillingPaymentMethod = (typeof BILLING_PAYMENT_METHODS)[number];

export interface ShopLocation {
  lat: number;
  lng: number;
  /** Human-readable address from Maps or typed by the owner. */
  formattedAddress: string | null;
  placeId: string | null;
}

export interface BusinessBilling {
  /** Chosen Partner package; null until owner picks one. */
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
  /** For monthly Partner; null for lifetime / unpaid. */
  expiresAt: string | null;
  /** Stub for future PSP (Xendit/PayMongo) — never invent live charges. */
  checkoutProvider: "manual" | "stub" | null;
}

export const VEHICLE_SIZES = ["small", "medium", "large", "xl"] as const;
export type VehicleSize = (typeof VEHICLE_SIZES)[number];

/** businesses/{businessId} */
export interface Business {
  name: string;
  ownerUid: string;
  plan: Plan;
  planStatus: "active" | "suspended";
  phoneE164?: string | null;
  /** Street / shop address text (also mirrored in location.formattedAddress when set via Maps). */
  address?: string | null;
  /** Map pin for River Mobile proximity. Null until set. */
  location?: ShopLocation | null;
  /** Opt-in to being listed and bookable in River Mobile. */
  riverMobile: { listed: boolean; listedAt: string | null };
  /** Partner availability: simple max bookings per slot. */
  bookingCapacity: { slotMins: number; maxBookingsPerSlot: number };
  /** Shop settings (Paid). dailyTargetCentavos null = not set. */
  settings: { dailyTargetCentavos: number | null };
  /** Storefront / interior photo HTTPS URLs for River Mobile (max 6). */
  photoUrls: string[];
  /** Opening hours as free text, e.g. "Mon–Sat 8 AM–6 PM". */
  hours?: string | null;
  /** Shop logo HTTPS URL. */
  logoUrl?: string | null;
  /** Billing for the Pro / Lifetime upgrade. */
  billing: BusinessBilling;
  /** Last owner-triggered AI Insights refresh (server-side 24h rate limit). */
  insightsRefreshedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** businesses/{businessId}/members/{uid} — the tenancy source of truth. */
export interface Member {
  uid: string;
  businessId: string;
  role: Role;
  status: "active" | "removed";
  displayName: string | null;
  phoneE164: string | null;
  email: string | null;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** businesses/{businessId}/services/{serviceId} */
export interface Service {
  name: string;
  durationMins: number;
  /** Centavos per vehicle size. Owner-entered; null = not offered / price not set. */
  pricesBySize: Partial<Record<VehicleSize, number | null>>;
  active: boolean;
  listedOnRiverMobile: boolean;
  createdAt: string;
  updatedAt: string;
}

/** businesses/{businessId}/bays/{bayId} (Paid) */
export interface Bay {
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** businesses/{businessId}/customers/{customerId} (Paid) */
export interface Customer {
  name: string;
  phoneE164: string | null;
  /** Legacy: no longer collected. */
  plate?: string | null;
  vehicleSize: VehicleSize | null;
  createdAt: string;
  updatedAt: string;
}

export const BOOKING_STATUSES = [
  "requested",
  "accepted",
  "declined",
  "cancelled",
  "no_show",
  "checked_in",
  "completed",
  "queued",
  "in_bay",
  "done",
  "paid",
  "closed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** businesses/{businessId}/bookings/{bookingId} */
export interface Booking {
  reference: string;
  source: "river_mobile_api" | "online_link" | "staff";
  status: BookingStatus;
  serviceIds: string[];
  vehicleSize: VehicleSize;
  /** Legacy: no longer stored or shown. */
  plate?: string | null;
  scheduledStart: string;
  customerSnapshot: { name: string; phoneE164: string | null };
  /** sha256(bookingId:code) of the check-in code shown in River Mobile. */
  verifyCodeHash: string;
  external: { clientId: string; customerRef: string; externalBookingRef: string | null } | null;
  notes: string | null;
  acceptedBy: string | null;
  checkedInAt: string | null;
  queueItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const QUEUE_STATUSES = ["queued", "in_bay", "done", "paid", "closed", "cancelled"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

/** businesses/{businessId}/queue/{queueItemId} (Paid) */
/** One service on an order, priced server-side from Settings > Services at the time it was added. */
export interface OrderLine {
  serviceId: string;
  name: string;
  priceCentavos: number;
  durationMins: number;
}

export interface QueueItem {
  queueNumber: number;
  queueDate: string;
  source: "walk_in_qr" | "booking" | "staff";
  status: QueueStatus;
  bayId: string | null;
  serviceIds: string[];
  vehicleSize: VehicleSize | null;
  /** Legacy: no longer collected or shown (older items may still have it). */
  plate?: string | null;
  /** Service lines and total, computed server-side (items created before Oct 2026 may lack them). */
  lines?: OrderLine[];
  totalCentavos?: number;
  durationMins?: number;
  customerName?: string | null;
  notes?: string | null;
  paidAt?: string | null;
  paymentMethod?: PaymentMethod | null;
  customerId: string | null;
  bookingId: string | null;
  startedAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** businesses/{businessId}/audit_logs/{id} */
export interface AuditLog {
  actor: { type: "user" | "api_client"; id: string };
  action: string;
  target: string;
  meta: Record<string, unknown> | null;
  at: string;
}


export const PAYMENT_METHODS = ["cash", "gcash", "maya", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** businesses/{businessId}/sales/{saleId} — recorded when a queue item is paid. */
export interface Sale {
  queueItemId: string | null;
  bookingId: string | null;
  amountCentavos: number;
  method: PaymentMethod;
  /** Staff-entered reference (GCash/Maya ref, or future PSP id). */
  paymentRef: string | null;
  /** Optional QR payload shown to the customer (e.g. shop GCash QR string). Not a secret. */
  paymentQrPayload: string | null;
  status: "recorded" | "void";
  serviceIds: string[];
  vehicleSize: VehicleSize | null;
  /** Legacy: no longer stored or shown. */
  plate?: string | null;
  customerName: string | null;
  recordedBy: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

/** businesses/{businessId}/invites/{inviteId} — pending staff invite. */
export interface Invite {
  phoneE164: string | null;
  email: string | null;
  role: Role;
  status: "pending" | "accepted" | "revoked";
  invitedBy: string;
  acceptedUid: string | null;
  createdAt: string;
  updatedAt: string;
}

/** invite_index/{inviteId} — resolves an invite across shops for accept. */
export interface InviteIndex {
  businessId: string;
  createdAt: string;
}

export const ALERT_TYPES = ["booking.requested", "booking.status", "queue.paid", "system"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

/** businesses/{businessId}/alerts/{alertId} — in-app owner/staff alerts (Messages). */
export interface Alert {
  type: AlertType;
  title: string;
  body: string;
  read: boolean;
  bookingId: string | null;
  queueItemId: string | null;
  createdAt: string;
}

export const API_SCOPES = [
  "shops:read",
  "bookings:write",
  "bookings:read",
  "checkin:write",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** api_clients/{clientId} (top level, platform-managed; never readable by clients). */
export interface ApiClient {
  name: string;
  environment: "dev" | "prod" | "local";
  scopes: ApiScope[];
  secretHash: string;
  status: "active" | "revoked";
  createdAt: string;
}

/** api_booking_index/{bookingId}: maps a public booking id to its shop and client. */
export interface ApiBookingIndex {
  businessId: string;
  clientId: string;
  customerRef: string;
  createdAt: string;
}
