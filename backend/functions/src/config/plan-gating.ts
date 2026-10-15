/**
 * PLAN_GATING_ENABLED ("1" = on, anything else = off; default off while we test).
 * Off: every tier check passes (walk-in cap, companion quota and Pro-only tools/tips/alerts,
 * Paid-only routes). The plan data, billing and pricing stay as they are; "1" restores gating.
 */
let override: boolean | null = null;
export const planGatingEnabled = () => override ?? process.env.PLAN_GATING_ENABLED === "1";
/** Tests only. null = read the env again. */
export function setPlanGating(on: boolean | null) {
  override = on;
}
