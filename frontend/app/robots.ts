import type { MetadataRoute } from "next";

/** Only prod is indexable, and only its public entry. Shop dashboards are private. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "prod") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/$", "/terms", "/privacy"], disallow: ["/home", "/queue", "/moments", "/account", "/sales", "/settings", "/scan", "/sign-in", "/api", "/v1"] },
  };
}
