/**
 * Owner/staff notification abstraction.
 *
 * Always writes an in-app alert. Email/SMS are logged only until provider keys
 * are configured (see docs/api.md). No secrets are invented here.
 */
import type { Alert, AlertType } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import { paths } from "./paths.js";

export interface NotifyInput {
  type: AlertType;
  title: string;
  body: string;
  bookingId?: string | null;
  queueItemId?: string | null;
  /** Optional contact for future email/SMS delivery. */
  phoneE164?: string | null;
  email?: string | null;
}

export async function notifyShop(
  store: DocStore,
  businessId: string,
  input: NotifyInput,
  now: Date,
): Promise<Doc<Alert>> {
  const id = store.newId();
  const alert: Alert = {
    type: input.type,
    title: input.title,
    body: input.body,
    read: false,
    bookingId: input.bookingId ?? null,
    queueItemId: input.queueItemId ?? null,
    createdAt: now.toISOString(),
  };
  await store.create(paths.alert(businessId, id), { ...alert });

  // Placeholder channels — attach a provider later via env (SENDGRID_API_KEY, etc.).
  if (input.email) {
    console.info("[notify:email:stub]", { businessId, to: input.email, title: input.title });
  }
  if (input.phoneE164) {
    console.info("[notify:sms:stub]", { businessId, to: input.phoneE164, title: input.title });
  }
  return { ...alert, id };
}

export async function listAlerts(store: DocStore, businessId: string, limit = 50) {
  return store.list<Alert>(paths.alerts(businessId), {
    orderBy: { field: "createdAt", direction: "desc" },
    limit,
  });
}

export async function markAlertRead(store: DocStore, businessId: string, alertId: string) {
  await store.update(paths.alert(businessId, alertId), { read: true });
}
