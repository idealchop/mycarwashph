import { brand } from "../config/brand.js";
import { randomCode, safeEqualHex, sha256 } from "../lib/crypto.js";
import { notFound, unprocessable } from "../lib/errors.js";
import type { Booking, Business, QueueItem, Service, VehicleSize } from "../models/types.js";
import type { DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { checkInPayload } from "./bookings-service.js";
import { notifyShop } from "./notify-service.js";
import { paths } from "./paths.js";
import { priceOrder } from "./queue-service.js";
import { CATEGORY_ICON } from "./starter-services.js";

/**
 * Booking link (Barbers.ph /book from the shop QR, Oct 24, 2026). Anyone with the shop's link can see the shop and
 * its active services and send a request; the owner accepts it like a River Mobile booking. The customer gets a
 * ticket token (only its hash is stored) to follow the request. No plate numbers.
 */
async function openShop(store: DocStore, shopId: string) {
  const b = await store.get<Business>(paths.business(shopId));
  if (!b || b.deletedAt || b.planStatus !== "active") throw notFound("Shop not found.");
  return b;
}

export async function publicShop(store: DocStore, shopId: string) {
  const b = await openShop(store, shopId);
  const services = (await store.list<Service>(paths.services(b.id), { orderBy: { field: "name" } })).filter((s) => s.active !== false);
  return {
    id: b.id,
    name: b.name,
    address: b.address ?? b.location?.formattedAddress ?? null,
    phoneE164: b.phoneE164 ?? null,
    hours: b.hours ?? null,
    photoUrls: b.photoUrls ?? [],
    logoUrl: b.logoUrl ?? null,
    services: services.map((s) => {
      const category = s.category ?? "car-wash";
      return { id: s.id, name: s.name, category, icon: s.icon ?? CATEGORY_ICON[category], pricesBySize: s.pricesBySize ?? {} };
    }),
  };
}

export interface LinkBookingInput {
  serviceIds: string[];
  vehicleSize: VehicleSize;
  /** Omit for "now" (walk-in request); otherwise within the next 30 days. */
  scheduledStart?: string;
  name?: string;
  contact?: string;
  notes?: string;
  payPref?: "shop" | "online";
}

export async function createLinkBooking(store: DocStore, shopId: string, input: LinkBookingInput, now: Date, onlineCheckout = false) {
  const b = await openShop(store, shopId);
  const priced = await priceOrder(store, b.id, input.serviceIds, input.vehicleSize);
  if (!priced.serviceIds.length) throw unprocessable("Pick at least one service.", "service_required");
  const when = input.scheduledStart ? new Date(input.scheduledStart) : now;
  if (Number.isNaN(when.getTime()) || when.getTime() < now.getTime() - 10 * 60_000 || when.getTime() > now.getTime() + 30 * 86_400_000) {
    throw unprocessable("Pick a time in the next 30 days.", "invalid_time");
  }
  const bookingId = store.newId();
  const code = randomCode(8);
  const token = randomCode(24);
  const at = now.toISOString();
  const name = input.name?.trim() || "Guest";
  const contact = input.contact?.trim() || null;
  const phone = contact && /^\+?63\d{10}$|^09\d{9}$/.test(contact.replace(/[\s-]/g, "")) ? normalizePhone(contact) : null;
  const booking: Booking = {
    reference: `${brand.bookingRefPrefix}-${randomCode(6)}`,
    source: "online_link",
    status: "requested",
    serviceIds: priced.serviceIds,
    vehicleSize: input.vehicleSize,
    plate: null,
    scheduledStart: when.toISOString(),
    customerSnapshot: { name, phoneE164: phone },
    verifyCodeHash: sha256(`${bookingId}:${code}`),
    external: null,
    notes: [input.notes?.trim(), contact && !phone ? `Contact: ${contact}` : null].filter(Boolean).join(" · ") || null,
    acceptedBy: null,
    checkedInAt: null,
    queueItemId: null,
    linkTokenHash: sha256(`link:${token}`),
    payPref: input.payPref === "online" && onlineCheckout ? "online" : "shop",
    createdAt: at,
    updatedAt: at,
  };
  const path = paths.booking(b.id, bookingId);
  await store.runTransaction(async (tx) => {
    tx.create(path, { ...booking });
    await writeAudit(store, b.id, { actor: { type: "customer", id: "booking-link" }, action: "booking.create", target: path, meta: { via: "booking_link" } }, now, tx);
  });
  await notifyShop(store, b.id, { type: "booking.requested", title: "New booking from your QR", body: `${name} requested ${priced.lines.map((l) => l.name).join(" + ")} (${booking.reference}).`, bookingId, phoneE164: b.phoneE164 ?? null }, now);
  return { bookingId, reference: booking.reference, token, checkIn: { code, qrPayload: checkInPayload(b.id, bookingId, code) }, ticket: await linkTicket(store, b.id, bookingId, token) };
}

function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("63") ? `+${d}` : `+63${d.slice(1)}`;
}

/** Customer ticket view; the token must match. */
export async function linkTicket(store: DocStore, shopId: string, bookingId: string, token: string) {
  const bk = await store.get<Booking>(paths.booking(shopId, bookingId));
  if (!bk || !bk.linkTokenHash || !token || !safeEqualHex(bk.linkTokenHash, sha256(`link:${token}`))) throw notFound("Ticket not found.");
  const q = bk.queueItemId ? await store.get<QueueItem>(paths.queueItem(shopId, bk.queueItemId)) : null;
  const priced = await priceOrder(store, shopId, bk.serviceIds, bk.vehicleSize, { allowInactive: true }).catch(() => null);
  // One customer-facing stage: sent → accepted → in bay → done (or closed).
  const qs = q?.status;
  const stage = ["declined", "cancelled", "no_show"].includes(bk.status) || qs === "cancelled" ? "closed"
    : qs === "done" || qs === "paid" || qs === "closed" || ["completed", "done", "paid", "closed"].includes(bk.status) ? "done"
    : qs === "in_bay" || bk.status === "in_bay" ? "in_bay"
    : qs === "queued" || ["accepted", "checked_in", "queued"].includes(bk.status) ? "accepted"
    : "sent";
  return {
    bookingId: bk.id,
    reference: bk.reference,
    status: bk.status,
    stage,
    queueNumber: q?.queueNumber ?? null,
    vehicleSize: bk.vehicleSize,
    scheduledStart: bk.scheduledStart,
    lines: priced?.lines.map((l) => ({ name: l.name, priceCentavos: l.priceCentavos })) ?? [],
    totalCentavos: priced?.totalCentavos ?? 0,
    payPref: bk.payPref ?? "shop",
    paid: qs === "paid" || qs === "closed" || bk.status === "paid",
    createdAt: bk.createdAt,
  };
}
