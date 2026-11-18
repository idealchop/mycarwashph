import { createHash, randomBytes } from "node:crypto";
import { notFound } from "../lib/errors.js";
import type { Member } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";

/**
 * Staff links (Barbers.ph "barber link"): the owner shares a private link, staff open it with no
 * account. One link per staff person, scoped to one shop, always role "staff". The owner can reset
 * (new token, old link stops) or turn it off. Only sha256(token) is indexed for lookups.
 */
export interface StaffLink {
  name: string;
  token: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const newToken = () => randomBytes(24).toString("base64url"); // 192 bits, 32 chars

export async function listStaffLinks(store: DocStore, businessId: string) {
  const rows = await store.list<StaffLink>(paths.staffLinks(businessId), { orderBy: { field: "createdAt", direction: "desc" } });
  return rows.filter((l) => l.active);
}

export async function createStaffLink(store: DocStore, businessId: string, name: string, uid: string, now: Date): Promise<Doc<StaffLink>> {
  const id = store.newId();
  const at = now.toISOString();
  const link: StaffLink = { name, token: newToken(), active: true, createdBy: uid, createdAt: at, updatedAt: at, lastUsedAt: null };
  await store.create(paths.staffLink(businessId, id), { ...link });
  await store.set(paths.staffLinkIndex(hashToken(link.token)), { businessId, linkId: id, createdAt: at });
  await writeAudit(store, businessId, { actor: { type: "user", id: uid }, action: "staff_link.create", target: paths.staffLink(businessId, id), meta: { name } }, now);
  return { ...link, id };
}

async function activeLink(store: DocStore, businessId: string, linkId: string) {
  const link = await store.get<StaffLink>(paths.staffLink(businessId, linkId));
  if (!link || !link.active) throw notFound("Staff link not found.");
  return link;
}

/** New token; the old link stops working at once. */
export async function resetStaffLink(store: DocStore, businessId: string, linkId: string, uid: string, now: Date): Promise<Doc<StaffLink>> {
  const link = await activeLink(store, businessId, linkId);
  const token = newToken();
  const at = now.toISOString();
  await store.delete(paths.staffLinkIndex(hashToken(link.token)));
  await store.update(paths.staffLink(businessId, linkId), { token, updatedAt: at });
  await store.set(paths.staffLinkIndex(hashToken(token)), { businessId, linkId, createdAt: at });
  await writeAudit(store, businessId, { actor: { type: "user", id: uid }, action: "staff_link.reset", target: paths.staffLink(businessId, linkId), meta: null }, now);
  return { ...link, token, updatedAt: at, id: linkId };
}

/** Turn off: the link stops working and disappears from the list. */
export async function revokeStaffLink(store: DocStore, businessId: string, linkId: string, uid: string, now: Date) {
  const link = await activeLink(store, businessId, linkId);
  await store.delete(paths.staffLinkIndex(hashToken(link.token)));
  await store.update(paths.staffLink(businessId, linkId), { active: false, token: "", updatedAt: now.toISOString() });
  await writeAudit(store, businessId, { actor: { type: "user", id: uid }, action: "staff_link.revoke", target: paths.staffLink(businessId, linkId), meta: null }, now);
}

/** Token -> the shop and a synthetic staff membership, or null when unknown / turned off. */
export async function resolveStaffLink(store: DocStore, token: string): Promise<{ businessId: string; linkId: string; name: string; member: Doc<Member> } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const idx = await store.get<{ businessId: string; linkId: string }>(paths.staffLinkIndex(hashToken(token)));
  if (!idx) return null;
  const link = await store.get<StaffLink>(paths.staffLink(idx.businessId, idx.linkId));
  if (!link || !link.active || link.token !== token) return null;
  const uid = `staff-link:${idx.linkId}`;
  const member: Doc<Member> = {
    id: uid, uid, businessId: idx.businessId, role: "staff", status: "active", displayName: link.name,
    phoneE164: null, email: null, invitedBy: link.createdBy, createdAt: link.createdAt, updatedAt: link.updatedAt,
  };
  return { businessId: idx.businessId, linkId: idx.linkId, name: link.name, member };
}
