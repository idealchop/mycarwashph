import { type NextRequest } from "next/server";
import { needsIdToken, serviceIdToken } from "@/lib/upstream";

/**
 * Same-origin public entry for the River Mobile partner API (`/v1/*`).
 *
 * The Cloud Functions remain private (org Domain restricted sharing forbids
 * allUsers). App Hosting invokes them with a Google ID token; callers send the
 * River Mobile API key in Authorization (unchanged).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_UPSTREAMS = {
  dev: "https://mycarwashpublicapidev-o4uz6gedqa-as.a.run.app",
  prod: "https://mycarwashpublicapiprod-o4uz6gedqa-as.a.run.app",
  emulator: "http://127.0.0.1:5001/demo-mycarwash/asia-southeast1/mycarwashPublicApiDev",
} as const;

function publicUpstream(host: string | null): string | null {
  const explicit = process.env.PUBLIC_API_UPSTREAM_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const h = (host ?? "").toLowerCase();
  if (h.startsWith("localhost") || h.startsWith("127.0.0.1")) return PUBLIC_UPSTREAMS.emulator;
  if (h.startsWith("mycarwash-dev--")) return PUBLIC_UPSTREAMS.dev;
  if (h.startsWith("mycarwash-prod--") || h === "mycarwash.ph" || h === "www.mycarwash.ph" || h.startsWith("api.")) {
    return PUBLIC_UPSTREAMS.prod;
  }
  return null;
}

const REQUEST_HEADERS = ["authorization", "content-type", "idempotency-key", "accept", "x-api-key"];
const RESPONSE_HEADERS = ["content-type", "ratelimit", "ratelimit-policy", "retry-after", "idempotent-replayed"];

function problem(status: number, code: string, title: string) {
  return Response.json({ status, code, title }, { status, headers: { "Cache-Control": "no-store" } });
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const upstream = publicUpstream(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  if (!upstream) return problem(500, "api_not_configured", "The partner API is not configured for this site.");

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (clientIp) headers.set("x-mycarwash-client-ip", clientIp);
  if (needsIdToken(upstream)) {
    try {
      headers.set("x-serverless-authorization", `Bearer ${await serviceIdToken(upstream)}`);
    } catch (err) {
      console.error("v1 proxy: no service ID token", err);
      return problem(502, "upstream_auth_failed", "We couldn't reach the server. Please try again.");
    }
  }

  const target = `${upstream}/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let res: Response;
  try {
    res = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error("v1 proxy: upstream unreachable", err);
    return problem(502, "upstream_unavailable", "We couldn't reach the server. Please try again.");
  }

  const out = new Headers({ "Cache-Control": "no-store" });
  for (const name of RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(res.status === 204 ? null : await res.arrayBuffer(), { status: res.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
