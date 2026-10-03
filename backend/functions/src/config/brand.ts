/**
 * Brand constants for Mycarwash.ph (River Kit convention: names, slugs and URLs
 * live in one place so the API never hardcodes them elsewhere).
 */
export const brand = {
  appName: "Mycarwash.ph",
  slug: "mycarwash",
  company: "River Apps",
  supportEmail: "support@mycarwash.ph",
  appUrl: "https://mycarwash.ph",
  publicApiUrl: "https://api.mycarwash.ph",
  /** Prefix for booking references shown to customers, e.g. CWS-7KQ2M9. */
  bookingRefPrefix: "CWS",
  timeZone: "Asia/Manila",
  region: "asia-southeast1",
} as const;
