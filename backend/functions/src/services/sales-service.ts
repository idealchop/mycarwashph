import { notFound } from "../lib/errors.js";
import { manilaDayKey } from "../lib/time.js";
import type { PaymentMethod, Sale, VehicleSize } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";

export interface RecordSaleInput {
  queueItemId?: string | null;
  bookingId?: string | null;
  amountCentavos: number;
  method: PaymentMethod;
  paymentRef?: string | null;
  paymentQrPayload?: string | null;
  serviceIds?: string[];
  vehicleSize?: VehicleSize | null;
  plate?: string | null;
  customerName?: string | null;
}

export async function recordSale(
  store: DocStore,
  businessId: string,
  input: RecordSaleInput,
  recordedBy: string,
  now: Date,
): Promise<Doc<Sale>> {
  const id = store.newId();
  const at = now.toISOString();
  const sale: Sale = {
    queueItemId: input.queueItemId ?? null,
    bookingId: input.bookingId ?? null,
    amountCentavos: input.amountCentavos,
    method: input.method,
    paymentRef: input.paymentRef ?? null,
    paymentQrPayload: input.paymentQrPayload ?? null,
    status: "recorded",
    serviceIds: input.serviceIds ?? [],
    vehicleSize: input.vehicleSize ?? null,
    plate: input.plate ?? null,
    customerName: input.customerName ?? null,
    recordedBy,
    paidAt: at,
    createdAt: at,
    updatedAt: at,
  };
  await store.create(paths.sale(businessId, id), { ...sale });
  await writeAudit(
    store,
    businessId,
    { actor: { type: "user", id: recordedBy }, action: "sale.record", target: paths.sale(businessId, id), meta: { amountCentavos: sale.amountCentavos, method: sale.method } },
    now,
  );
  return { ...sale, id };
}

export async function listSales(store: DocStore, businessId: string, opts?: { limit?: number }) {
  return store.list<Sale>(paths.sales(businessId), {
    orderBy: { field: "paidAt", direction: "desc" },
    limit: opts?.limit ?? 100,
  });
}

export interface SalesSummary {
  date: string;
  totalCentavos: number;
  cars: number;
  byHour: { hour: number; label: string; centavos: number; count: number }[];
  recent: Doc<Sale>[];
  previousDayTotalCentavos: number;
}

/** Aggregates sales for a Manila calendar day (and previous day for change %). */
export async function salesSummary(store: DocStore, businessId: string, dayKey: string, recentLimit = 8): Promise<SalesSummary> {
  const all = await store.list<Sale>(paths.sales(businessId), {
    orderBy: { field: "paidAt", direction: "desc" },
    limit: 500,
  });
  const active = all.filter((s) => s.status === "recorded");
  const inDay = (s: Sale, key: string) => manilaDayKey(new Date(s.paidAt)) === key;
  const today = active.filter((s) => inDay(s, dayKey));
  // previous Manila day
  const noon = new Date(`${dayKey.slice(0, 4)}-${dayKey.slice(4, 6)}-${dayKey.slice(6, 8)}T12:00:00+08:00`);
  const prevKey = manilaDayKey(new Date(noon.getTime() - 86_400_000));
  const yesterday = active.filter((s) => inDay(s, prevKey));

  const byHourMap = new Map<number, { centavos: number; count: number }>();
  for (const s of today) {
    const hour = Number(
      new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" }).format(new Date(s.paidAt)),
    );
    const row = byHourMap.get(hour) ?? { centavos: 0, count: 0 };
    row.centavos += s.amountCentavos;
    row.count += 1;
    byHourMap.set(hour, row);
  }
  const hours = [...byHourMap.keys()].sort((a, b) => a - b);
  const span = hours.length ? hours : [7, 8, 9, 10, 11, 12, 13];
  const from = Math.min(...span, 7);
  const to = Math.max(...span, 13);
  const byHour = [];
  for (let h = from; h <= to; h++) {
    const row = byHourMap.get(h) ?? { centavos: 0, count: 0 };
    const label =
      h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
    byHour.push({ hour: h, label, centavos: row.centavos, count: row.count });
  }

  return {
    date: dayKey,
    totalCentavos: today.reduce((t, s) => t + s.amountCentavos, 0),
    cars: today.length,
    byHour,
    recent: today.slice(0, recentLimit),
    previousDayTotalCentavos: yesterday.reduce((t, s) => t + s.amountCentavos, 0),
  };
}

export async function getSale(store: DocStore, businessId: string, saleId: string) {
  const sale = await store.get<Sale>(paths.sale(businessId, saleId));
  if (!sale) throw notFound("Sale not found.");
  return sale;
}
