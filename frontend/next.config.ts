import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/**
 * Firebase web config. On App Hosting, FIREBASE_WEBAPP_CONFIG is injected at build
 * time for the web app linked to the backend, so the public config never has to be
 * committed. Explicit NEXT_PUBLIC_FIREBASE_* values (e.g. .env.local) win.
 */
function webConfigEnv(): Record<string, string> {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return {};
  try {
    const c = JSON.parse(raw) as Record<string, string>;
    const pick = (key: string, value?: string) => (process.env[key] ? {} : value ? { [key]: value } : {});
    return {
      ...pick("NEXT_PUBLIC_FIREBASE_API_KEY", c.apiKey),
      ...pick("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", c.authDomain),
      ...pick("NEXT_PUBLIC_FIREBASE_PROJECT_ID", c.projectId),
      ...pick("NEXT_PUBLIC_FIREBASE_APP_ID", c.appId),
      ...pick("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", c.storageBucket),
    };
  } catch {
    return {};
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  // AI Companion switch (lib/companion-flag.ts): on only where COMPANION_ENABLED=1.
  // Plan gating switch (lib/plan-gating.ts): off unless PLAN_GATING_ENABLED=1.
  env: {
    ...webConfigEnv(),
    NEXT_PUBLIC_COMPANION_ENABLED: process.env.COMPANION_ENABLED === "1" ? "1" : "0",
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_ID: process.env.K_REVISION || process.env.BUILD_ID || `${pkg.version}-${Date.now().toString(36)}`,
    NEXT_PUBLIC_PLAN_GATING_ENABLED: process.env.PLAN_GATING_ENABLED === "1" ? "1" : "0",
  },
  // River Maps is a source-only workspace package (vendored from idealchop/river-maps).
  transpilePackages: ["@river/map"],
  // Pages retired when Mycarwash moved to the Barbers.ph structure (3-item nav).
  async redirects() {
    const home = ["/messages", "/growth", "/customers", "/dashboard", "/staff", "/onboarding", "/welcome", "/sign-in", "/sign-in/:path*", "/invite/:path*"];
    return [
      ...home.map((source) => ({ source, destination: "/home", permanent: false })),
      { source: "/bookings", destination: "/history", permanent: false },
      { source: "/community", destination: "/moments", permanent: false },
      { source: "/community/:path*", destination: "/moments", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Camera for Scan, geolocation for the map pin; nothing else.
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
