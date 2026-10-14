import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

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
  env: webConfigEnv(),
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
