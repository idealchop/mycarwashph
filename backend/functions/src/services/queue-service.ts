import { HttpError, notFound, unprocessable } from "../lib/errors.js";
import { manilaDayKey } from "../lib/time.js";
import type { Bay, OrderLine, Plan, PaymentMethod, QueueItem, QueueStatus, Service, VehicleSize } from "../models/types.js";
import type { DocStore, Tx } from "../store/doc-store.js";
import type { Actor } from "./audit-service.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";
import { recordSale } from "./sales-service.js";

export interface NewQueueItem {
  source: QueueItem["source"];
  serviceIds: string[];
  vehicleSize: VehicleSize | null;
  customerName?: string | null;
  notes?: string | null;
  customerId: string | null;
  bookingId: string | null;
}

/**
 * Prices the picked services from the shop's Settings > Services (server-side; the client never
 * sends a price). Unknown or inactive services are refused. Size falls back to the medium price.
 */
export async function priceOrder(store: DocStore, businessId: string, serviceIds: string[], size: VehicleSize | null, opts: { allowInactive?: boolean } = {}) {
  const unique = [...new Set(serviceIds)];
  const lines: OrderLine[] = [];
  for (const id of unique) {
    const s = await store.get<Service>(paths.service(businessId, id));
    if (!s || (!s.active && !opts.allowInactive)) throw unprocessable("Pick services from Settings > Services.", "invalid_service");
    const price = s.pricesBySize?.[size ?? "medium"] ?? s.pricesBySize?.medium ?? 0;
    lines.push({ serviceId: id, name: s.name, priceCentavos: price ?? 0, durationMins: s.durationMins ?? 0 });
  }
  return { serviceIds: unique, lines, totalCentavos: lines.reduce((t, l) => t + l.priceCentavos, 0), durationMins: lines.reduce((t, l) => t + l.durationMins, 0) };
}

async function hasActiveServices(store: DocStore, businessId: string) {
  return (await store.list<Service>(paths.services(businessId))).some((s) => s.active !== false);
}

/**
 * Allocates the next daily queue number (resets each Manila day) and creates the
 * queue item inside the given transaction. Reads happen before writes.
 */
export async function allocateQueueItem(store: DocStore, tx: Tx, businessId: string, input: NewQueueItem & Partial<Pick<QueueItem, "lines" | "totalCentavos" | "durationMins">>, now: Date) {
  const dayKey = manilaDayKey(now);
  const counterPath = paths.queueCounter(businessId, dayKey);
  const counter = await tx.get<{ next: number }>(counterPath);
  const queueNumber = counter?.next ?? 1;
  tx.set(counterPath, { next: queueNumber + 1, dayKey });
  const id = store.newId();
  const at = now.toISOString();
  const item: QueueItem = {
    ...input,
    customerName: input.customerName ?? null,
    notes: input.notes ?? null,
    queueNumber,
    queueDate: dayKey,
    status: "queued",
    bayId: null,
    startedAt: null,
    doneAt: null,
    createdAt: at,
    updatedAt: at,
  };
  tx.create(paths.queueItem(businessId, id), { ...item });
  return { ...item, id };
}

/** Partner shops seat up to 10 walk-ins per Manila calendar day; Pro and Lifetime are unlimited (Barbers.ph parity). */
export const PARTNER_WALKINS_PER_DAY = 10;
export const WALKIN_LIMIT_MESSAGE = `You've added ${PARTNER_WALKINS_PER_DAY} walk-ins today, the Partner limit. Upgrade to Pro or Lifetime for unlimited walk-ins.`;
export const walkInLimit = (plan: Plan) => (plan === "paid" ? null : PARTNER_WALKINS_PER_DAY);

export interface WalkInAllowance { used: number; limit: number | null; left: number | null }

export async function walkInAllowance(store: DocStore, businessId: string, plan: Plan, now: Date): Promise<WalkInAllowance> {
  const doc = await store.get<{ count: number }>(paths.walkInCounter(businessId, manilaDayKey(now)));
  const used = doc?.count ?? 0;
  const limit = walkInLimit(plan);
  return { used, limit, left: limit === null ? null : Math.max(0, limit - used) };
}

/**
 * Creates a queue item. Walk-ins (source "staff") are counted on a per-day counter doc inside the
 * same transaction, so concurrent adds can't pass the Partner cap. Scan-verified bookings don't count.
 */
export async function createQueueItem(store: DocStore, businessId: string, input: NewQueueItem, actor: Actor, now: Date, plan: Plan = "paid") {
  if (!input.serviceIds.length && (await hasActiveServices(store, businessId))) {
    throw unprocessable("Pick at least one service.", "service_required");
  }
  const priced = { ...input, ...(await priceOrder(store, businessId, input.serviceIds, input.vehicleSize)) };
  return store.runTransaction(async (tx) => {
    // Firestore transactions: all reads first. allocateQueueItem reads the queue counter before its writes.
    const walkIn = input.source !== "booking";
    const counterPath = paths.walkInCounter(businessId, manilaDayKey(now));
    const used = walkIn ? (await tx.get<{ count: number }>(counterPath))?.count ?? 0 : 0;
    const limit = walkInLimit(plan);
    if (walkIn && limit !== null && used >= limit) {
      throw new HttpError(402, "walkin_limit", WALKIN_LIMIT_MESSAGE, { limit: "walk-ins", used, max: limit });
    }
    const item = await allocateQueueItem(store, tx, businessId, priced, now);
    if (walkIn) tx.set(counterPath, { count: used + 1, dayKey: manilaDayKey(now), updatedAt: now.toISOString() });
    await writeAudit(store, businessId, { actor, action: "queue.create", target: paths.queueItem(businessId, item.id), meta: { queueNumber: item.queueNumber } }, now, tx);
    return item;
  });
}

export async function listQueue(store: DocStore, businessId: string, dayKey: string) {
  return store.list<QueueItem>(paths.queue(businessId), { where: [["queueDate", "==", dayKey]], orderBy: { field: "queueNumber" } });
}

const NEXT: Record<QueueStatus, QueueStatus[]> = {
  queued: ["in_bay", "cancelled"],
  in_bay: ["done"],
  done: ["paid"],
  paid: ["closed"],
  closed: [],
  cancelled: [],
};

export interface QueueSaleInput {
  /** Defaults to the order total computed from its services. */
  amountCentavos?: number;
  method: PaymentMethod;
  paymentRef?: string | null;
  paymentQrPayload?: string | null;
  customerName?: string | null;
}

export async function updateQueueItem(
  store: DocStore,
  businessId: string,
  id: string,
  patch: { status?: QueueStatus; bayId?: string | null; sale?: QueueSaleInput; serviceIds?: string[]; vehicleSize?: VehicleSize; customerName?: string | null; notes?: string | null },
  actorUid: string,
  now: Date,
) {
  const path = paths.queueItem(businessId, id);
  const item = await store.get<QueueItem>(path);
  if (!item) throw notFound("Queue item not found.");
  const at = now.toISOString();
  const update: Partial<QueueItem> = { updatedAt: at };
  if (patch.bayId !== undefined) {
    if (patch.bayId !== null) {
      const bay = await store.get<Bay>(paths.bay(businessId, patch.bayId));
      if (!bay || !bay.active) throw unprocessable("That bay does not exist or is inactive.", "invalid_bay");
    }
    update.bayId = patch.bayId;
  }
  // Order edits (Barbers' Edit on order details): only while the car is still open.
  const editing = patch.serviceIds !== undefined || patch.vehicleSize !== undefined || patch.customerName !== undefined || patch.notes !== undefined;
  if (editing) {
    if (!["queued", "in_bay", "done"].includes(item.status)) throw unprocessable("Paid or cancelled orders can't be edited.", "order_closed");
    if (patch.serviceIds !== undefined || patch.vehicleSize !== undefined) {
      const priced = await priceOrder(store, businessId, patch.serviceIds ?? item.serviceIds, patch.vehicleSize ?? item.vehicleSize, { allowInactive: patch.serviceIds === undefined });
      Object.assign(update, priced, patch.vehicleSize ? { vehicleSize: patch.vehicleSize } : {});
    }
    if (patch.customerName !== undefined) update.customerName = patch.customerName;
    if (patch.notes !== undefined) update.notes = patch.notes;
  }
  if (patch.status && patch.status !== item.status) {
    if (!NEXT[item.status].includes(patch.status)) {
      throw unprocessable(`Cannot move from ${item.status} to ${patch.status}.`, "invalid_transition");
    }
    if (patch.status === "paid" && !patch.sale) {
      throw unprocessable("Record the payment amount and method when marking paid.", "sale_required");
    }
    update.status = patch.status;
    if (patch.status === "in_bay") update.startedAt = at;
    if (patch.status === "done") update.doneAt = at;
    if (patch.status === "paid") {
      update.paidAt = at;
      update.paymentMethod = patch.sale!.method;
    }
  }
  await store.update(path, update);
  await writeAudit(store, businessId, { actor: { type: "user", id: actorUid }, action: "queue.update", target: path, meta: { status: patch.status, bayId: patch.bayId } }, now);

  let sale = null;
  if (patch.status === "paid" && patch.sale) {
    sale = await recordSale(
      store,
      businessId,
      {
        queueItemId: id,
        bookingId: item.bookingId,
        amountCentavos: patch.sale.amountCentavos ?? update.totalCentavos ?? item.totalCentavos ?? 0,
        method: patch.sale.method,
        paymentRef: patch.sale.paymentRef,
        paymentQrPayload: patch.sale.paymentQrPayload,
        serviceIds: update.serviceIds ?? item.serviceIds,
        vehicleSize: update.vehicleSize ?? item.vehicleSize,
        customerName: patch.sale.customerName ?? item.customerName ?? null,
      },
      actorUid,
      now,
    );
  }
  return { item: { ...item, ...update }, sale };
}
