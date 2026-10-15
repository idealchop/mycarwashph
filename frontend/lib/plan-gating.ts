/**
 * PLAN_GATING_ENABLED ("1" on; default off while testing). next.config copies it to
 * NEXT_PUBLIC_PLAN_GATING_ENABLED for the browser. Off: every shop gets the Pro/Lifetime
 * features and no limit counters or upgrade prompts. The plan data and billing page stay.
 */
export const planGatingEnabled = () => (process.env.PLAN_GATING_ENABLED ?? process.env.NEXT_PUBLIC_PLAN_GATING_ENABLED) === "1";

/** True when the shop may use Paid features: its plan is paid, or gating is off. */
export const hasPaidFeatures = (shop: { plan?: string } | null | undefined) => !!shop && (shop.plan === "paid" || !planGatingEnabled());
