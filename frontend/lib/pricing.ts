/** Founder-set Partner prices. Paid plan prices stay TBD — never invent them in UI. */
export const PARTNER_PRICING = {
  monthlyCentavos: 95_000,
  lifetimeCentavos: 1_000_000,
  monthlyLabel: "₱950 / month",
  lifetimeLabel: "₱10,000 one-time",
} as const;

export function pesoFromCentavos(c: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(c / 100);
}
