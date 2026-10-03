import type { DocStore, Tx } from "../store/doc-store.js";
import type { AuditLog } from "../models/types.js";
import { paths } from "./paths.js";

export type Actor = AuditLog["actor"];

/** Appends an audit log entry for a business. Pass `tx` to write inside a transaction. */
export async function writeAudit(
  store: DocStore,
  businessId: string,
  entry: Omit<AuditLog, "at">,
  now: Date,
  tx?: Tx,
): Promise<void> {
  const data = { ...entry, at: now.toISOString() };
  const path = paths.auditLog(businessId, store.newId());
  if (tx) tx.create(path, data);
  else await store.create(path, data);
}
