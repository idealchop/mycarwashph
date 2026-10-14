import type { PartnerBillingOption } from "./api";

/** Standard pricing approved Oct 14, 2026 (centavos). Partner is the entry tier; never call it free. */
export const PLAN_TIERS: { id: PartnerBillingOption; name: string; centavos: number; originalCentavos: number; cadence: "month" | "one-time"; locations: string; blurb: string }[] = [
  { id: "monthly", name: "Pro", centavos: 49_900, originalCentavos: 95_000, cadence: "month", locations: "1 shop", blurb: "All features, 1 shop" },
  { id: "lifetime", name: "Lifetime", centavos: 1_000_000, originalCentavos: 1_800_000, cadence: "one-time", locations: "1–5 locations", blurb: "All features, pay once" },
  { id: "lifetime_5plus", name: "Lifetime", centavos: 2_000_000, originalCentavos: 3_500_000, cadence: "one-time", locations: "5+ locations", blurb: "All features, pay once" },
];

export const tierFor = (id: PartnerBillingOption) => PLAN_TIERS.find((t) => t.id === id) ?? PLAN_TIERS[0];
export const tierLabel = (id: PartnerBillingOption) => {
  const t = tierFor(id);
  return t.cadence === "month" ? t.name : `${t.name} (${t.locations})`;
};
/** Shop plan as shown to people: Partner, Pro or Lifetime ("paid" is the data id). */
export const planLabel = (plan: string, option?: PartnerBillingOption | null) =>
  plan === "partner" ? "Partner" : option && option !== "monthly" ? "Lifetime" : "Pro";

export function pesoFromCentavos(c: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(c / 100);
}
