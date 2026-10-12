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
};

export default nextConfig;
