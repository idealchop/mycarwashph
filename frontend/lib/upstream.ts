/**
 * Server-only: where the same-origin `/api/*` proxy sends shop API calls.
 *
 * The shop API functions (mycarwashApiDev / mycarwashApiProd) are private Cloud
 * Run services: the smartrefill.io organisation policy forbids `allUsers`
 * invokers, so only the App Hosting backend's service account may call them.
 *
 * URLs are the Cloud Run service URLs printed by `firebase deploy --only functions`
 * (hash form …-o4uz6gedqa-as.a.run.app). The ID-token audience must match exactly.
 */
export const UPSTREAMS = {
  dev: "https://mycarwashapidev-o4uz6gedqa-as.a.run.app",
  prod: "https://mycarwashapiprod-o4uz6gedqa-as.a.run.app",
  emulator: "http://127.0.0.1:5001/demo-mycarwash/asia-southeast1/mycarwashApiDev",
} as const;

/**
 * API_UPSTREAM_URL (apphosting.<env>.yaml) wins. Fallbacks: the emulator on
 * localhost, otherwise dev or prod from the App Hosting hostname.
 */
export function upstreamFor(host: string | null): string | null {
  const explicit = process.env.API_UPSTREAM_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const h = (host ?? "").toLowerCase();
  if (h.startsWith("localhost") || h.startsWith("127.0.0.1")) return UPSTREAMS.emulator;
  if (h.startsWith("mycarwash-dev--")) return UPSTREAMS.dev;
  if (h.startsWith("mycarwash-prod--") || h === "mycarwash.ph" || h === "www.mycarwash.ph") return UPSTREAMS.prod;
  return null;
}

/** Local emulator URLs need no Google ID token. */
export const needsIdToken = (upstream: string) => upstream.startsWith("https://");

let cached: { audience: string; token: string; expiresAt: number } | null = null;

/**
 * Google-signed ID token for the backend's service account, from the Cloud Run
 * metadata server (App Hosting runs on Cloud Run). Cached for 50 minutes.
 */
export async function serviceIdToken(audience: string): Promise<string> {
  if (cached && cached.audience === audience && cached.expiresAt > Date.now()) return cached.token;
  const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
  const res = await fetch(url, { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`metadata server returned ${res.status}`);
  const token = (await res.text()).trim();
  cached = { audience, token, expiresAt: Date.now() + 50 * 60_000 };
  return token;
}
