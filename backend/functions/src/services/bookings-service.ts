import { brand } from "../config/brand.js";
import { randomCode, safeEqualHex, sha256 } from "../lib/crypto.js";
import { conflict, forbidden, notFound, unprocessable } from "../lib/errors.js";
import { canTransition } from "../models/booking-lifecycle.js";
import type { ApiBookingIndex, Booking, BookingStatus, Business, Service, VehicleSize } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import type { Actor } from "./audit-service.js";
import { writeAudit } from "./audit-service.js";
import { notifyShop } from "./notify-service.js";
import { allocateQueueItem } from "./queue-service.js";
import { paths } from "./paths.js";

/** Check-in QR payload shown in River Mobile: MCW1.<businessId>.<bookingId>.<code> */
export const checkInPayload = (businessId: string, bookingId: string, code: string) =>
  `MCW1.${businessId}.${bookingId}.${code}`;

export function parseCheckInPayload(payload: string) {
  const m = /^MCW1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Z0-9]{8})$/.exec(payload.trim());
  return m ? { businessId: m[1]!, bookingId: m[2]!, code: m[3]! } : null;
}

const codeHash = (bookingId: string, code: string) => sha256(`${bookingId}:${code}`);

/** Strips secrets before a booking leaves the API. */
export function publicBooking(b: Doc<Booking>) {
  const { verifyCodeHash: _hidden, ...rest } = b;
  return rest;
}

export async function listBookings(store: DocStore, businessId: string, status?: BookingStatus) {
  const rows = await store.list<Booking>(paths.bookings(businessId), {
    where: status ? [["status", "==", status]] : undefined,
    orderBy: { field: "scheduledStart", direction: "desc" },
    limit: 100,
  });
  return rows.map(publicBooking);
}

export async function getBooking(store: DocStore, businessId: string, bookingId: string) {
  const booking = await store.get<Booking>(paths.booking(businessId, bookingId));
  if (!booking) throw notFound("Booking not found.");
  return booking;
}

/** Owner/staff decision on a booking (accept, decline, mark served). */
export async function transitionBooking(
  store: DocStore,
  business: Doc<Business>,
  bookingId: string,
  to: BookingStatus,
  actor: Actor,
  now: Date,
) {
  const booking = await getBooking(store, business.id, bookingId);
  if (!canTransition(booking.status, to, business.plan)) {
    throw unprocessable(`Cannot move a ${booking.status} booking to ${to}.`, "invalid_transition");
  }
  const patch: Partial<Booking> = { status: to, updatedAt: now.toISOString() };
  if (to === "accepted") patch.acceptedBy = actor.id;
  await store.update(paths.booking(business.id, bookingId), patch);
  await writeAudit(store, business.id, { actor, action: `booking.${to}`, target: paths.booking(business.id, bookingId), meta: null }, now);
  await notifyShop(
    store,
    business.id,
    {
      type: "booking.status",
      title: `Booking ${to.replace("_", " ")}`,
      body: `${booking.reference} is now ${to}.`,
      bookingId,
    },
    now,
  );
  // Phase 1: enqueue booking.<status> webhook to the API client (signed, retried).
  return publicBooking({ ...booking, ...patch });
}

/**
 * Shop-side Scan: staff scan the customer's check-in QR. Verifies the shop, the
 * code and the status, then marks the booking checked_in. On Paid shops it also
 * creates the queue item (daily number) and moves the booking to queued.
 */
export async function verifyScan(store: DocStore, business: Doc<Business>, payload: string, actor: Actor, now: Date) {
  const parsed = parseCheckInPayload(payload);
  if (!parsed) throw unprocessable("This QR code is not a Mycarwash booking.", "invalid_qr");
  if (parsed.businessId !== business.id) throw unprocessable("This booking is for a different shop.", "wrong_shop");

  return store.runTransaction(async (tx) => {
    const path = paths.booking(business.id, parsed.bookingId);
    const booking = await tx.get<Booking>(path);
    if (!booking || !safeEqualHex(booking.verifyCodeHash, codeHash(parsed.bookingId, parsed.code))) {
      throw unprocessable("We could not verify this booking.", "verification_failed");
    }
    if (booking.status === "requested") throw conflict("Accept this booking first, then scan again.", "not_accepted");
    if (booking.status !== "accepted") throw conflict(`This booking is already ${booking.status}.`, "already_processed");

    const at = now.toISOString();
    const patch: Partial<Booking> = { status: "checked_in", checkedInAt: at, updatedAt: at };
    let queueItem = null;
    if (business.plan === "paid") {
      queueItem = await allocateQueueItem(store, tx, business.id, {
        source: "booking",
        serviceIds: booking.serviceIds,
        vehicleSize: booking.vehicleSize,
        plate: booking.plate,
        customerId: null,
        bookingId: booking.id,
      }, now);
      patch.status = "queued";
      patch.queueItemId = queueItem.id;
    }
    tx.update(path, patch);
    await writeAudit(store, business.id, { actor, action: "booking.verify", target: path, meta: { via: "shop_scan" } }, now, tx);
    return { booking: publicBooking({ ...booking, ...patch }), queueItem };
  });
}

export interface ApiBookingInput {
  shopId: string;
  serviceIds: string[];
  vehicleSize: VehicleSize;
  plate?: string;
  slotStart: string;
  customer: { ref: string; name: string; phoneE164?: string };
  externalBookingRef?: string;
  notes?: string;
}

/** River Mobile booking (POST /v1/bookings). Only listed shops and listed services are bookable. */
export async function createApiBooking(store: DocStore, clientId: string, input: ApiBookingInput, now: Date) {
  const business = await store.get<Business>(paths.business(input.shopId));
  if (!business || !business.riverMobile.listed || business.planStatus !== "active") {
    throw notFound("Shop not found or not listed on River Mobile.");
  }
  for (const serviceId of input.serviceIds) {
    const service = await store.get<Service>(paths.service(input.shopId, serviceId));
    if (!service || !service.active || !service.listedOnRiverMobile) {
      throw unprocessable(`Service ${serviceId} is not bookable at this shop.`, "invalid_service");
    }
  }
  const bookingId = store.newId();
  const code = randomCode(8);
  const at = now.toISOString();
  const booking: Booking = {
    reference: `${brand.bookingRefPrefix}-${randomCode(6)}`,
    source: "river_mobile_api",
    status: "requested",
    serviceIds: input.serviceIds,
    vehicleSize: input.vehicleSize,
    plate: input.plate ?? null,
    scheduledStart: new Date(input.slotStart).toISOString(),
    customerSnapshot: { name: input.customer.name, phoneE164: input.customer.phoneE164 ?? null },
    verifyCodeHash: codeHash(bookingId, code),
    external: { clientId, customerRef: input.customer.ref, externalBookingRef: input.externalBookingRef ?? null },
    notes: input.notes ?? null,
    acceptedBy: null,
    checkedInAt: null,
    queueItemId: null,
    createdAt: at,
    updatedAt: at,
  };
  const index: ApiBookingIndex = { businessId: input.shopId, clientId, customerRef: input.customer.ref, createdAt: at };
  await store.runTransaction(async (tx) => {
    tx.create(paths.booking(input.shopId, bookingId), { ...booking });
    tx.create(paths.apiBookingIndex(bookingId), { ...index });
    await writeAudit(store, input.shopId, { actor: { type: "api_client", id: clientId }, action: "booking.create", target: paths.booking(input.shopId, bookingId), meta: null }, now, tx);
  });
  await notifyShop(
    store,
    input.shopId,
    {
      type: "booking.requested",
      title: "New River Mobile booking",
      body: `${input.customer.name} requested a booking (${booking.reference}).`,
      bookingId,
      phoneE164: business.phoneE164 ?? null,
    },
    now,
  );
  return {
    bookingId,
    reference: booking.reference,
    status: booking.status,
    shopId: input.shopId,
    checkIn: { code, qrPayload: checkInPayload(input.shopId, bookingId, code) },
    createdAt: at,
  };
}

/** Loads a booking for an API client; clients can only see bookings they created. */
export async function getApiBooking(store: DocStore, clientId: string, bookingId: string) {
  const index = await store.get<ApiBookingIndex>(paths.apiBookingIndex(bookingId));
  if (!index || index.clientId !== clientId) throw notFound("Booking not found.");
  const booking = await getBooking(store, index.businessId, bookingId);
  return { booking, businessId: index.businessId };
}

export function apiBookingView(b: Doc<Booking>, businessId: string) {
  return {
    bookingId: b.id,
    reference: b.reference,
    shopId: businessId,
    status: b.status,
    serviceIds: b.serviceIds,
    vehicleSize: b.vehicleSize,
    scheduledStart: b.scheduledStart,
    checkedInAt: b.checkedInAt,
    externalBookingRef: b.external?.externalBookingRef ?? null,
    updatedAt: b.updatedAt,
  };
}

/**
 * Customer-side check-in (POST /v1/bookings/:id/check-in): the customer scans the
 * printed shop QR in River Mobile. Placeholder format MCW-SHOP.<shopId>; Phase 1
 * adds a signature and a time-window check.
 */
export async function apiCheckIn(store: DocStore, clientId: string, bookingId: string, shopQr: string, now: Date) {
  const { booking, businessId } = await getApiBooking(store, clientId, bookingId);
  const m = /^MCW-SHOP\.([A-Za-z0-9_-]+)$/.exec(shopQr.trim());
  if (!m) throw unprocessable("This is not a Mycarwash shop QR.", "invalid_qr");
  if (m[1] !== businessId) throw forbidden("This QR belongs to a different shop.");
  if (booking.status !== "accepted") throw conflict(`Booking is ${booking.status}; only accepted bookings can check in.`, "invalid_status");
  const at = now.toISOString();
  const patch: Partial<Booking> = { status: "checked_in", checkedInAt: at, updatedAt: at };
  await store.update(paths.booking(businessId, bookingId), patch);
  await writeAudit(store, businessId, { actor: { type: "api_client", id: clientId }, action: "booking.verify", target: paths.booking(businessId, bookingId), meta: { via: "customer_shop_qr" } }, now);
  // Phase 1: on Paid shops also create the queue item, as the shop-side scan does.
  return apiBookingView({ ...booking, ...patch }, businessId);
}
