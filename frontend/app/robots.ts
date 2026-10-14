import type { MetadataRoute } from "next";

/** Only prod is indexable, and only its public entry. Shop dashboards are private. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "prod") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/$", "/terms", "/privacy"], disallow: ["/home", "/queue", "/bookings", "/sales", "/customers", "/messages", "/growth", "/settings", "/scan", "/invite", "/sign-in", "/api", "/v1"] },
  };
}
