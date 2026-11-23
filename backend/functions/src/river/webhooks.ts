import type { Booking } from "../models/types.js";
import type { DocStore } from "../store/doc-store.js";
import { signRequest } from "./bridge-kit/index.js";
import type { RiverWebhookConfig } from "./config.js";
import { isRiverSource, toRiverStatus, type RiverStatus } from "./status.js";

/** App -> Bridge status events (openapi.yaml WebhookEvent). `requested` is never sent: the Bridge created it. */
export interface RiverWebhookEvent {
  id: string;
  type: `order.${Exclude<RiverStatus, "requested">}`;
  occurredAt: string;
  data: { orderId: string; reference: string; status: RiverStatus; customerRef: string | null; shopId: string };
}

export const WEBHOOK_MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 1_000, 4_000];
const deliveryPath = (eventId: string) => `river_webhook_deliveries/${eventId}`;

/**
 * Event for a booking update, or null when nothing should be sent: not a River
 * Mobile booking, or the shared status did not change (e.g. queued -> in_bay are
 * both in_progress). The event id is deterministic per (booking, shared status),
 * so a re-fired trigger dedupes on the delivery doc and on the Bridge.
 */
export function webhookEventFor(
  before: Booking | undefined,
  after: Booking | undefined,
  ids: { businessId: string; bookingId: string },
  now: Date,
): RiverWebhookEvent | null {
  if (!before || !after || !isRiverSource(after.source)) return null;
  const from = toRiverStatus(before.status);
  const to = toRiverStatus(after.status);
  if (from === to || to === "requested") return null;
  return {
    id: `mcw.${ids.bookingId}.${to}`,
    type: `order.${to}`,
    occurredAt: after.updatedAt || now.toISOString(),
    data: { orderId: ids.bookingId, reference: after.reference, status: to, customerRef: after.external?.customerRef ?? null, shopId: ids.businessId },
  };
}

/**
 * The Bridge verifies the path from `/hooks/` onwards (its signaturePath()), so a
 * base URL with a prefix such as https://…/bridge still signs `/hooks/carwash`.
 */
export function webhookSignaturePath(url: string): string {
  const path = new URL(url).pathname;
  const at = path.indexOf("/hooks/");
  return at >= 0 ? path.slice(at) : path;
}

export interface WebhookTransport {
  /** Google-signed ID token for this function's service account, aud = the hook URL. */
  mintIdToken(audience: string): Promise<string>;
  fetch(url: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<{ status: number }>;
  sleep(ms: number): Promise<void>;
  now(): Date;
}

type DeliveryStatus = "pending" | "delivered" | "failed" | "not_configured";

/**
 * Sends one event with OIDC (factor 1) + webhook-direction HMAC (factor 2), up to
 * WEBHOOK_MAX_ATTEMPTS tries on network errors, 408, 429 and 5xx. Records the
 * outcome in river_webhook_deliveries/{eventId} (status, attempts, last HTTP code;
 * never the token, signature or secret). A second call for the same event id is a no-op.
 */
export async function deliverWebhook(
  store: DocStore,
  config: RiverWebhookConfig,
  event: RiverWebhookEvent,
  transport: WebhookTransport,
): Promise<DeliveryStatus | "duplicate"> {
  const path = deliveryPath(event.id);
  const startedAt = transport.now().toISOString();
  const base = { eventId: event.id, type: event.type, orderId: event.data.orderId, shopId: event.data.shopId, createdAt: startedAt };
  if (!config.url || !config.secret) {
    try {
      await store.create(path, { ...base, status: "not_configured", attempts: 0, updatedAt: startedAt });
    } catch {
      return "duplicate";
    }
    console.log(JSON.stringify({ severity: "WARNING", message: "river_webhook", eventId: event.id, status: "not_configured" }));
    return "not_configured";
  }
  try {
    await store.create(path, { ...base, status: "pending", attempts: 0, updatedAt: startedAt });
  } catch {
    return "duplicate";
  }

  const body = JSON.stringify(event);
  let attempts = 0;
  let lastHttpStatus: number | null = null;
  let lastError: string | null = null;
  let status: DeliveryStatus = "failed";
  while (attempts < WEBHOOK_MAX_ATTEMPTS) {
    await transport.sleep(BACKOFF_MS[attempts] ?? 4_000);
    attempts++;
    try {
      const token = await transport.mintIdToken(config.url);
      const signed = signRequest({
        method: "POST",
        pathWithQuery: webhookSignaturePath(config.url),
        body,
        keyId: config.keyId,
        secret: config.secret,
        authorization: `Bearer ${token}`,
        idempotencyKey: event.id,
        now: transport.now(),
      });
      const res = await transport.fetch(config.url, { method: "POST", headers: signed.headers, body });
      lastHttpStatus = res.status;
      lastError = null;
      if (res.status >= 200 && res.status < 300) {
        status = "delivered";
        break;
      }
      if (!(res.status === 408 || res.status === 429 || res.status >= 500)) break;
    } catch (err) {
      lastError = err instanceof Error ? err.name : "error";
    }
  }
  const at = transport.now().toISOString();
  await store.update(path, { status, attempts, lastHttpStatus, lastError, updatedAt: at, ...(status === "delivered" ? { deliveredAt: at } : {}) });
  console.log(JSON.stringify({ severity: status === "delivered" ? "INFO" : "WARNING", message: "river_webhook", eventId: event.id, status, attempts, lastHttpStatus }));
  return status;
}
