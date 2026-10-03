/**
 * Firestore data model. Every business-scoped document lives under
 * businesses/{businessId}/... Money is integer centavos. Timestamps are ISO 8601
 * strings in UTC written by the server; shop-facing rendering uses PHT.
 */

export const ROLES = ["owner", "staff"] as const;
export type Role = (typeof ROLES)[number];

/** Partner = light booking + scan app; Paid = full shop system. Prices are not set here (TBD). */
export const PLANS = ["partner", "paid"] as const;
export type Plan = (typeof PLANS)[number];

export const VEHICLE_SIZES = ["small", "medium", "large", "xl"] as const;
export type VehicleSize = (typeof VEHICLE_SIZES)[number];

/** businesses/{businessId} */
export interface Business {
  name: string;
  ownerUid: string;
  plan: Plan;
  planStatus: "active" | "suspended";
  phoneE164?: string | null;
  address?: string | null;
  /** Opt-in to being listed and bookable in River Mobile. */
  riverMobile: { listed: boolean; listedAt: string | null };
  /** Partner availability: simple max bookings per slot. */
  bookingCapacity: { slotMins: number; maxBookingsPerSlot: number };
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
  plate: string | null;
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
  plate: string | null;
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
export interface QueueItem {
  queueNumber: number;
  queueDate: string;
  source: "walk_in_qr" | "booking" | "staff";
  status: QueueStatus;
  bayId: string | null;
  serviceIds: string[];
  vehicleSize: VehicleSize | null;
  plate: string | null;
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
