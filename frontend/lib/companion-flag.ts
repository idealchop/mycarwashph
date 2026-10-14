/**
 * The AI Companion is shown only where COMPANION_ENABLED=1 (apphosting.dev.yaml; prod is off).
 * next.config copies it to NEXT_PUBLIC_COMPANION_ENABLED at build time for the browser.
 * The API is guarded separately (backend companionEnabled: dev on, prod via COMPANION_ENABLED=1 or INSIGHTS_PROD_ENABLED=true).
 */
export const companionEnabled = () => (process.env.COMPANION_ENABLED ?? process.env.NEXT_PUBLIC_COMPANION_ENABLED) === "1";
