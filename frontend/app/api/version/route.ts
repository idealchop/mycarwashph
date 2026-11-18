import { APP_VERSION, BUILD_ID } from "@/lib/app-version";

export const dynamic = "force-dynamic";

/** Version and build of the running deploy. */
export function GET() {
  return Response.json({ build: BUILD_ID, version: APP_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
