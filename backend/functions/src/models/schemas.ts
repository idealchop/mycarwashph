import { z } from "zod";
import { API_SCOPES, PLANS, QUEUE_STATUSES, VEHICLE_SIZES } from "./types.js";

const name = z.string().trim().min(1).max(80);
/** Philippine mobile in E.164, e.g. +639171234567. */
export const phoneE164 = z.string().regex(/^\+639\d{9}$/, "Use a PH mobile number like +639171234567");
const centavos = z.number().int().min(0).max(100_000_000);
const vehicleSize = z.enum(VEHICLE_SIZES);
const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const createBusinessSchema = z.object({
  name,
  phoneE164: phoneE164.optional(),
  address: z.string().trim().max(200).optional(),
});

export const updateBusinessSchema = z
  .object({
    name: name.optional(),
    phoneE164: phoneE164.nullable().optional(),
    address: z.string().trim().max(200).nullable().optional(),
    riverMobileListed: z.boolean().optional(),
    bookingCapacity: z
      .object({ slotMins: z.number().int().min(15).max(240), maxBookingsPerSlot: z.number().int().min(1).max(50) })
      .optional(),
  })
  .strict();

export const setPlanSchema = z.object({ plan: z.enum(PLANS) });

export const serviceSchema = z.object({
  name,
  durationMins: z.number().int().min(5).max(600),
  pricesBySize: z.partialRecord(vehicleSize, centavos.nullable()).default({}),
  active: z.boolean().default(true),
  listedOnRiverMobile: z.boolean().default(false),
});
export const updateServiceSchema = serviceSchema.partial().strict();

export const baySchema = z.object({ name, active: z.boolean().default(true), sortOrder: z.number().int().min(0).default(0) });
export const updateBaySchema = baySchema.partial().strict();

export const customerSchema = z.object({
  name,
  phoneE164: phoneE164.nullable().default(null),
  plate: z.string().trim().max(12).nullable().default(null),
  vehicleSize: vehicleSize.nullable().default(null),
});

export const verifyScanSchema = z.object({
  /** Raw QR payload from River Mobile: MCW1.<businessId>.<bookingId>.<code> */
  payload: z.string().trim().min(10).max(200),
});

export const queueCreateSchema = z.object({
  serviceIds: z.array(id).max(10).default([]),
  vehicleSize: vehicleSize.nullable().default(null),
  plate: z.string().trim().max(12).nullable().default(null),
  customerId: id.nullable().default(null),
});

export const queueUpdateSchema = z
  .object({ status: z.enum(QUEUE_STATUSES).optional(), bayId: id.nullable().optional() })
  .strict();

export const v1CreateBookingSchema = z.object({
  shopId: id,
  serviceIds: z.array(id).min(1).max(10),
  vehicleSize,
  plate: z.string().trim().max(12).optional(),
  slotStart: z.iso.datetime({ offset: true }),
  customer: z.object({
    ref: z.string().min(1).max(128),
    name,
    phoneE164: phoneE164.optional(),
  }),
  externalBookingRef: z.string().max(128).optional(),
  notes: z.string().max(500).optional(),
});

export const v1CheckInSchema = z.object({
  /** Payload of the printed shop QR scanned in River Mobile: MCW-SHOP.<shopId> (unsigned placeholder). */
  shopQr: z.string().trim().min(5).max(200),
});

export const apiScopeSchema = z.enum(API_SCOPES);
