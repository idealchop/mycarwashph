import { notFound, unprocessable } from "../lib/errors.js";
import { manilaDayKey } from "../lib/time.js";
import type { Bay, QueueItem, QueueStatus, VehicleSize } from "../models/types.js";
import type { DocStore, Tx } from "../store/doc-store.js";
import type { Actor } from "./audit-service.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";

export interface NewQueueItem {
  source: QueueItem["source"];
  serviceIds: string[];
  vehicleSize: VehicleSize | null;
  plate: string | null;
  customerId: string | null;
  bookingId: string | null;
}

/**
 * Allocates the next daily queue number (resets each Manila day) and creates the
 * queue item inside the given transaction. Reads happen before writes.
 */
export async function allocateQueueItem(store: DocStore, tx: Tx, businessId: string, input: NewQueueItem, now: Date) {
  const dayKey = manilaDayKey(now);
  const counterPath = paths.queueCounter(businessId, dayKey);
  const counter = await tx.get<{ next: number }>(counterPath);
  const queueNumber = counter?.next ?? 1;
  tx.set(counterPath, { next: queueNumber + 1, dayKey });
  const id = store.newId();
  const at = now.toISOString();
  const item: QueueItem = {
    ...input,
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

export async function createQueueItem(store: DocStore, businessId: string, input: NewQueueItem, actor: Actor, now: Date) {
  return store.runTransaction(async (tx) => {
    const item = await allocateQueueItem(store, tx, businessId, input, now);
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

export async function updateQueueItem(
  store: DocStore,
  businessId: string,
  id: string,
  patch: { status?: QueueStatus; bayId?: string | null },
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
  if (patch.status && patch.status !== item.status) {
    if (!NEXT[item.status].includes(patch.status)) {
      throw unprocessable(`Cannot move from ${item.status} to ${patch.status}.`, "invalid_transition");
    }
    update.status = patch.status;
    if (patch.status === "in_bay") update.startedAt = at;
    if (patch.status === "done") update.doneAt = at;
  }
  await store.update(path, update);
  await writeAudit(store, businessId, { actor: { type: "user", id: actorUid }, action: "queue.update", target: path, meta: { ...patch } }, now);
  return { ...item, ...update };
}
