import { badRequest, forbidden, notFound } from "../lib/errors.js";
import {
  PLAN_PRICING,
  type BillingPaymentMethod,
  type BillingStatus,
  type Business,
  type PartnerBillingOption,
} from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";

export function defaultBilling(): Business["billing"] {
  return {
    partnerOption: null,
    status: "trial",
    lastPayment: null,
    activatedAt: null,
    expiresAt: null,
    checkoutProvider: "manual",
  };
}

export function partnerPriceCentavos(option: PartnerBillingOption): number {
  return PLAN_PRICING[option].centavos;
}

const peso = (c: number) => `₱${(c / 100).toLocaleString("en-US")}`;

export function pricingCatalog() {
  return {
    currency: "PHP",
    partner: {
      name: "Partner",
      note: "Entry tier: River Mobile bookings, Scan and the queue.",
      monthlyCentavos: PLAN_PRICING.monthly.centavos,
      lifetimeCentavos: PLAN_PRICING.lifetime.centavos,
    },
    tiers: (Object.keys(PLAN_PRICING) as PartnerBillingOption[]).map((id) => {
      const t = PLAN_PRICING[id];
      return {
        id, ...t,
        label: `${peso(t.centavos)}${t.cadence === "month" ? " / month" : " one-time"}`,
        originalLabel: peso(t.originalCentavos),
      };
    }),
  };
}

export async function selectPartnerBilling(
  store: DocStore,
  business: Doc<Business>,
  option: PartnerBillingOption,
  actorUid: string,
  now: Date,
): Promise<Doc<Business>> {
  if (business.plan !== "partner") throw badRequest("Upgrades apply to Partner shops. This shop is already on Pro or Lifetime.");
  const at = now.toISOString();
  const billing: Business["billing"] = {
    ...(business.billing ?? defaultBilling()),
    partnerOption: option,
    status: business.billing?.status === "active" ? "active" : "unpaid",
    checkoutProvider: "manual",
  };
  await store.update(paths.business(business.id), { billing, updatedAt: at });
  await writeAudit(
    store,
    business.id,
    { actor: { type: "user", id: actorUid }, action: "billing.select", target: paths.business(business.id), meta: { option, amountCentavos: partnerPriceCentavos(option) } },
    now,
  );
  return { ...business, billing, updatedAt: at };
}

export async function confirmBillingPayment(
  store: DocStore,
  business: Doc<Business>,
  input: { method: BillingPaymentMethod; paymentRef?: string | null; amountCentavos?: number },
  actorUid: string,
  now: Date,
): Promise<Doc<Business>> {
  const billing = business.billing ?? defaultBilling();
  if (!billing.partnerOption) throw badRequest("Choose Pro or Lifetime first.");
  const amount = input.amountCentavos ?? partnerPriceCentavos(billing.partnerOption);
  const at = now.toISOString();
  const next: Business["billing"] = {
    ...billing,
    status: "pending",
    lastPayment: {
      amountCentavos: amount,
      method: input.method,
      paymentRef: input.paymentRef ?? null,
      recordedAt: at,
      recordedBy: actorUid,
    },
    checkoutProvider: "manual",
  };
  await store.update(paths.business(business.id), { billing: next, updatedAt: at });
  await writeAudit(
    store,
    business.id,
    { actor: { type: "user", id: actorUid }, action: "billing.payment_recorded", target: paths.business(business.id), meta: { method: input.method, amountCentavos: amount } },
    now,
  );
  return { ...business, billing: next, updatedAt: at };
}

/** Platform admin marks Partner payment as active (or suspends). */
export async function activateBilling(
  store: DocStore,
  businessId: string,
  input: { status: Extract<BillingStatus, "active" | "suspended" | "unpaid">; expiresAt?: string | null },
  adminUid: string,
  now: Date,
): Promise<Doc<Business>> {
  const business = await store.get<Business>(paths.business(businessId));
  if (!business) throw notFound("Shop not found.");
  const at = now.toISOString();
  const billing = business.billing ?? defaultBilling();
  let expiresAt = input.expiresAt === undefined ? billing.expiresAt : input.expiresAt;
  if (input.status === "active" && billing.partnerOption === "monthly" && !expiresAt) {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() + 1);
    expiresAt = d.toISOString();
  }
  if (input.status === "active" && billing.partnerOption !== "monthly") expiresAt = null;
  const next: Business["billing"] = {
    ...billing,
    status: input.status,
    activatedAt: input.status === "active" ? at : billing.activatedAt,
    expiresAt,
  };
  const planStatus = input.status === "suspended" ? "suspended" : "active";
  await store.update(paths.business(businessId), { billing: next, planStatus, updatedAt: at });
  await writeAudit(
    store,
    businessId,
    { actor: { type: "user", id: adminUid }, action: "billing.activate", target: paths.business(businessId), meta: { status: input.status, expiresAt } },
    now,
  );
  return { ...business, billing: next, planStatus, updatedAt: at };
}

export function requirePlatformAdmin(isAdmin: boolean) {
  if (!isAdmin) throw forbidden("Only River Apps admins can activate billing.");
}
