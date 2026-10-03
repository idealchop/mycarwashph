import { notFound } from "../lib/errors.js";
import type { DocData, DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";

/**
 * Generic business-scoped collection helpers for simple catalog data
 * (services, bays, customers). The caller passes a collection path that is
 * already scoped to an authorized business.
 */
export async function listItems<T>(store: DocStore, collectionPath: string, orderBy?: string) {
  return store.list<T>(collectionPath, orderBy ? { orderBy: { field: orderBy } } : undefined);
}

export async function createItem(
  store: DocStore,
  businessId: string,
  collectionPath: string,
  data: DocData,
  actorUid: string,
  action: string,
  now: Date,
) {
  const id = store.newId();
  const at = now.toISOString();
  const doc = { ...data, createdAt: at, updatedAt: at };
  await store.create(`${collectionPath}/${id}`, doc);
  await writeAudit(store, businessId, { actor: { type: "user", id: actorUid }, action, target: `${collectionPath}/${id}`, meta: null }, now);
  return { ...doc, id };
}

export async function updateItem(
  store: DocStore,
  businessId: string,
  docPath: string,
  patch: DocData,
  actorUid: string,
  action: string,
  now: Date,
) {
  const existing = await store.get<DocData>(docPath);
  if (!existing) throw notFound();
  const update = { ...patch, updatedAt: now.toISOString() };
  await store.update(docPath, update);
  await writeAudit(store, businessId, { actor: { type: "user", id: actorUid }, action, target: docPath, meta: { fields: Object.keys(patch) } }, now);
  return { ...existing, ...update };
}
