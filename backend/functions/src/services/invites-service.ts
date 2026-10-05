import { conflict, forbidden, notFound, unprocessable } from "../lib/errors.js";
import type { AuthUser } from "../auth/token-verifier.js";
import type { Invite, Member, Role } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";

export async function createInvite(
  store: DocStore,
  businessId: string,
  input: { phoneE164?: string; email?: string; role: Role },
  invitedBy: string,
  now: Date,
): Promise<Doc<Invite>> {
  if (input.role === "owner") throw unprocessable("Cannot invite as owner.", "invalid_role");
  const members = await store.list<Member>(paths.members(businessId));
  if (input.phoneE164) {
    const clash = members.find((m) => m.status === "active" && m.phoneE164 === input.phoneE164);
    if (clash) throw conflict("That phone number is already on the team.", "already_member");
  }
  if (input.email) {
    const clash = members.find((m) => m.status === "active" && m.email?.toLowerCase() === input.email!.toLowerCase());
    if (clash) throw conflict("That email is already on the team.", "already_member");
  }
  const id = store.newId();
  const at = now.toISOString();
  const invite: Invite = {
    phoneE164: input.phoneE164 ?? null,
    email: input.email?.toLowerCase() ?? null,
    role: input.role,
    status: "pending",
    invitedBy,
    acceptedUid: null,
    createdAt: at,
    updatedAt: at,
  };
  await store.create(paths.invite(businessId, id), { ...invite });
  await store.set(paths.inviteIndex(id), { businessId, createdAt: at });
  await writeAudit(store, businessId, { actor: { type: "user", id: invitedBy }, action: "invite.create", target: paths.invite(businessId, id), meta: { role: input.role } }, now);
  return { ...invite, id };
}

export async function listInvites(store: DocStore, businessId: string) {
  const rows = await store.list<Invite>(paths.invites(businessId), { orderBy: { field: "createdAt", direction: "desc" } });
  return rows.filter((i) => i.status === "pending");
}

export async function revokeInvite(store: DocStore, businessId: string, inviteId: string, actorUid: string, now: Date) {
  const invite = await store.get<Invite>(paths.invite(businessId, inviteId));
  if (!invite || invite.status !== "pending") throw notFound("Invite not found.");
  await store.update(paths.invite(businessId, inviteId), { status: "revoked", updatedAt: now.toISOString() });
  await writeAudit(store, businessId, { actor: { type: "user", id: actorUid }, action: "invite.revoke", target: paths.invite(businessId, inviteId), meta: null }, now);
}

function matchesInvite(invite: Invite, user: AuthUser) {
  if (invite.phoneE164 && user.phoneNumber && invite.phoneE164 === user.phoneNumber) return true;
  if (invite.email && user.email && invite.email === user.email.toLowerCase()) return true;
  return false;
}

/** Accept a pending invite after sign-in; phone or email must match. */
export async function acceptInvite(store: DocStore, inviteId: string, user: AuthUser, now: Date) {
  const index = await store.get<{ businessId: string }>(paths.inviteIndex(inviteId));
  if (!index) throw notFound("Invite not found.");
  const businessId = index.businessId;
  const invite = await store.get<Invite>(paths.invite(businessId, inviteId));
  if (!invite || invite.status !== "pending") throw notFound("Invite not found.");
  if (!matchesInvite(invite, user)) throw forbidden("Sign in with the invited phone or email to accept.");

  const existing = await store.get<Member>(paths.member(businessId, user.uid));
  if (existing?.status === "active") throw conflict("You are already on this team.", "already_member");

  const at = now.toISOString();
  const member: Member = {
    uid: user.uid,
    businessId,
    role: invite.role,
    status: "active",
    displayName: user.name ?? null,
    phoneE164: user.phoneNumber ?? invite.phoneE164,
    email: user.email ?? invite.email,
    invitedBy: invite.invitedBy,
    createdAt: at,
    updatedAt: at,
  };
  await store.runTransaction(async (tx) => {
    tx.set(paths.member(businessId, user.uid), { ...member });
    tx.update(paths.invite(businessId, inviteId), { status: "accepted", acceptedUid: user.uid, updatedAt: at });
  });
  await writeAudit(store, businessId, { actor: { type: "user", id: user.uid }, action: "invite.accept", target: paths.member(businessId, user.uid), meta: { inviteId } }, now);
  return { businessId, member: { ...member, id: user.uid } };
}

/** Pending invites that match the signed-in user's phone or email. */
export async function listMyPendingInvites(store: DocStore, user: AuthUser) {
  // Without a collection-group index across all shops, resolve via invite_index is not
  // listable. Owners share the invite id; we also scan recent invites is not feasible.
  // Practical approach: accept by invite id only; listing for the user requires the
  // invite id from the owner. Return empty here; GET /invites/:id preview is separate.
  void store;
  void user;
  return [] as { inviteId: string; businessId: string; role: Role }[];
}

export async function getInvitePreview(store: DocStore, inviteId: string) {
  const index = await store.get<{ businessId: string }>(paths.inviteIndex(inviteId));
  if (!index) throw notFound("Invite not found.");
  const invite = await store.get<Invite>(paths.invite(index.businessId, inviteId));
  if (!invite || invite.status !== "pending") throw notFound("Invite not found.");
  const business = await store.get<{ name: string }>(paths.business(index.businessId));
  return {
    inviteId,
    businessId: index.businessId,
    shopName: business?.name ?? "Shop",
    role: invite.role,
    phoneE164: invite.phoneE164,
    email: invite.email,
  };
}
