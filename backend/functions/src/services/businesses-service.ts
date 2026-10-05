import type { AuthUser } from "../auth/token-verifier.js";
import { notFound } from "../lib/errors.js";
import type { Business, Member, Plan } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { defaultBilling } from "./billing-service.js";
import { paths } from "./paths.js";

export interface CreateBusinessInput {
  name: string;
  phoneE164?: string;
  address?: string;
  location?: Business["location"];
}

/**
 * Creates a business and its owner membership atomically. Every new shop starts
 * on the Partner plan; only a platform admin can move it to Paid (prices TBD).
 */
export async function createBusiness(
  store: DocStore,
  user: AuthUser,
  input: CreateBusinessInput,
  now: Date,
): Promise<{ business: Doc<Business>; member: Doc<Member> }> {
  const businessId = store.newId();
  const at = now.toISOString();
  const business: Business = {
    name: input.name,
    ownerUid: user.uid,
    plan: "partner",
    planStatus: "active",
    phoneE164: input.phoneE164 ?? user.phoneNumber ?? null,
    address: input.address ?? input.location?.formattedAddress ?? null,
    location: input.location ?? null,
    riverMobile: { listed: false, listedAt: null },
    bookingCapacity: { slotMins: 60, maxBookingsPerSlot: 2 },
    settings: { dailyTargetCentavos: null },
    billing: defaultBilling(),
    createdAt: at,
    updatedAt: at,
  };
  const member: Member = {
    uid: user.uid,
    businessId,
    role: "owner",
    status: "active",
    displayName: user.name ?? null,
    phoneE164: user.phoneNumber ?? null,
    email: user.email ?? null,
    invitedBy: null,
    createdAt: at,
    updatedAt: at,
  };
  await store.runTransaction(async (tx) => {
    tx.create(paths.business(businessId), { ...business });
    tx.create(paths.member(businessId, user.uid), { ...member });
    await writeAudit(store, businessId, { actor: { type: "user", id: user.uid }, action: "business.create", target: paths.business(businessId), meta: null }, now, tx);
  });
  return { business: { ...business, id: businessId }, member: { ...member, id: user.uid } };
}

/** Businesses the user is an active member of (collection-group query on members.uid). */
export async function listMyBusinesses(store: DocStore, uid: string) {
  const memberships = await store.listGroup<Member>("members", { where: [["uid", "==", uid]] });
  const active = memberships.filter((m) => m.status === "active");
  const rows = await Promise.all(
    active.map(async (m) => {
      const business = await store.get<Business>(paths.business(m.businessId));
      return business ? { business, role: m.role } : null;
    }),
  );
  return rows.filter((r): r is NonNullable<typeof r> => r !== null);
}

export interface UpdateBusinessInput {
  name?: string;
  phoneE164?: string | null;
  address?: string | null;
  location?: Business["location"];
  riverMobileListed?: boolean;
  bookingCapacity?: Business["bookingCapacity"];
  dailyTargetCentavos?: number | null;
}

export async function updateBusiness(
  store: DocStore,
  business: Doc<Business>,
  actorUid: string,
  input: UpdateBusinessInput,
  now: Date,
): Promise<Doc<Business>> {
  const at = now.toISOString();
  const patch: Partial<Business> = { updatedAt: at };
  if (input.name !== undefined) patch.name = input.name;
  if (input.phoneE164 !== undefined) patch.phoneE164 = input.phoneE164;
  if (input.address !== undefined) patch.address = input.address;
  if (input.location !== undefined) {
    patch.location = input.location;
    if (input.location?.formattedAddress && input.address === undefined) {
      patch.address = input.location.formattedAddress;
    }
  }
  if (input.bookingCapacity !== undefined) patch.bookingCapacity = input.bookingCapacity;
  if (input.riverMobileListed !== undefined && input.riverMobileListed !== business.riverMobile.listed) {
    patch.riverMobile = { listed: input.riverMobileListed, listedAt: input.riverMobileListed ? at : null };
  }
  if (input.dailyTargetCentavos !== undefined) {
    patch.settings = { ...(business.settings ?? { dailyTargetCentavos: null }), dailyTargetCentavos: input.dailyTargetCentavos };
  }
  await store.update(paths.business(business.id), patch);
  await writeAudit(store, business.id, { actor: { type: "user", id: actorUid }, action: "business.update", target: paths.business(business.id), meta: { fields: Object.keys(input) } }, now);
  return { ...business, ...patch };
}

/** Platform-admin only (River Apps): switch Partner <-> Paid. Billing is out of scope (prices TBD). */
export async function setPlan(store: DocStore, businessId: string, plan: Plan, adminUid: string, now: Date) {
  const business = await store.get<Business>(paths.business(businessId));
  if (!business) throw notFound("Shop not found.");
  await store.update(paths.business(businessId), { plan, updatedAt: now.toISOString() });
  await writeAudit(store, businessId, { actor: { type: "user", id: adminUid }, action: "business.plan.set", target: paths.business(businessId), meta: { from: business.plan, to: plan } }, now);
  return { ...business, plan };
}
