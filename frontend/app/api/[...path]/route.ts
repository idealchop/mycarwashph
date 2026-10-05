import { type NextRequest } from "next/server";
import { needsIdToken, serviceIdToken, upstreamFor } from "@/lib/upstream";

/**
 * Same-origin proxy for the shop API: browser -> /api/<path> -> private Cloud Run
 * function. Cloud Run IAM is satisfied with the App Hosting service account's ID
 * token in X-Serverless-Authorization; the user's Firebase ID token stays in
 * Authorization and the Express app still verifies it and enforces membership.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_HEADERS = ["authorization", "content-type", "idempotency-key", "accept"];
const RESPONSE_HEADERS = ["content-type", "ratelimit", "ratelimit-policy", "retry-after"];

function problem(status: number, code: string, title: string) {
  return Response.json({ status, code, title }, { status, headers: { "Cache-Control": "no-store" } });
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const upstream = upstreamFor(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  if (!upstream) return problem(500, "api_not_configured", "The API is not configured for this site.");

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
      console.error("api proxy: no service ID token", err);
      return problem(502, "upstream_auth_failed", "We couldn't reach the server. Please try again.");
    }
  }

  const target = `${upstream}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
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
    console.error("api proxy: upstream unreachable", err);
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
