/**
 * Brand constants for Mycarwash.ph (River Kit convention: names, slugs and URLs
 * live in one place so the API never hardcodes them elsewhere).
 */
export const brand = {
  appName: "Mycarwash.ph",
  /** River rules name for appName; same value as frontend/src/config/brand.ts productName. */
  productName: "Mycarwash.ph",
  slug: "mycarwash",
  /** River rules product id; must match frontend/src/config/brand.ts productSlug. */
  productSlug: "mycarwash",
  tagline: "Run your carwash from your phone: River Mobile bookings, scan to verify, queue, bays and sales.",
  colors: { primary: "#000000" },
  company: "River Apps",
  supportEmail: "support@mycarwash.ph",
  appUrl: "https://mycarwash.ph",
  publicApiUrl: "https://api.mycarwash.ph",
  /** Prefix for booking references shown to customers, e.g. CWS-7KQ2M9. */
  bookingRefPrefix: "CWS",
  timeZone: "Asia/Manila",
  region: "asia-southeast1",
} as const;
