import { conflict, notFound } from "../lib/errors.js";
import type { Member } from "../models/types.js";
import type { DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";

export async function listMembers(store: DocStore, businessId: string) {
  const rows = await store.list<Member>(paths.members(businessId));
  return rows.filter((m) => m.status === "active");
}

/** Owner removes a staff member; revokes access immediately. Owners cannot be removed here. */
export async function removeMember(store: DocStore, businessId: string, uid: string, actorUid: string, now: Date) {
  const member = await store.get<Member>(paths.member(businessId, uid));
  if (!member || member.status !== "active") throw notFound("Member not found.");
  if (member.role === "owner") throw conflict("The owner cannot be removed.", "owner_protected");
  await store.update(paths.member(businessId, uid), { status: "removed", updatedAt: now.toISOString() });
  await writeAudit(store, businessId, { actor: { type: "user", id: actorUid }, action: "member.remove", target: paths.member(businessId, uid), meta: null }, now);
}
