import type { Booking, MeResponse, QueueItem, Sale, SalesSummary } from "./api";
import { SAMPLE_SALES_TODAY, SAMPLE_TARGET, sampleHourlyDesktop } from "./sample-data";

/** Local preview only — never from Firestore. Labeled Sample / Preview in the UI. */
export const GUEST_SHOP: MeResponse["businesses"][number] = {
  id: "guest-preview",
  name: "Demo Carwash (preview)",
  plan: "paid",
  planStatus: "active",
  role: "owner",
  address: "Maginhawa St, Quezon City (sample)",
  location: { lat: 14.65, lng: 121.05, formattedAddress: "Maginhawa St, Quezon City (sample)", placeId: null },
  phoneE164: null,
  riverMobileListed: true,
  settings: { dailyTargetCentavos: SAMPLE_TARGET.targetCentavos },
  billing: {
    partnerOption: "monthly",
    status: "trial",
    lastPayment: null,
    activatedAt: null,
    expiresAt: null,
    checkoutProvider: "manual",
  },
};

export const GUEST_ME: MeResponse = {
  user: { uid: "guest", phoneNumber: null, email: null, name: "Guest" },
  businesses: [GUEST_SHOP],
};

export const GUEST_BOOKINGS: Booking[] = [
  {
    id: "gb1",
    reference: "CWS-DEMO1",
    status: "requested",
    serviceIds: ["svc1"],
    vehicleSize: "medium",
    plate: "ABC 1234",
    scheduledStart: new Date().toISOString(),
    customerSnapshot: { name: "Sample Customer", phoneE164: null },
    source: "river_mobile_api",
    checkedInAt: null,
  },
  {
    id: "gb2",
    reference: "CWS-DEMO2",
    status: "accepted",
    serviceIds: ["svc1"],
    vehicleSize: "small",
    plate: "XYZ 9876",
    scheduledStart: new Date().toISOString(),
    customerSnapshot: { name: "Another Guest", phoneE164: null },
    source: "river_mobile_api",
    checkedInAt: null,
  },
];

export const GUEST_QUEUE: QueueItem[] = [
  {
    id: "gq1",
    queueNumber: 4,
    status: "queued",
    bayId: null,
    serviceIds: [],
    plate: "QWE 2468",
    source: "walk_in",
    startedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "gq2",
    queueNumber: 5,
    status: "in_bay",
    bayId: "bay1",
    serviceIds: [],
    plate: "RTY 5566",
    source: "booking",
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export const GUEST_SALES_SUMMARY: SalesSummary = {
  date: "preview",
  totalCentavos: SAMPLE_SALES_TODAY.totalCentavos,
  cars: SAMPLE_SALES_TODAY.cars,
  byHour: sampleHourlyDesktop.map((h, i) => ({
    hour: 7 + i,
    label: h.label,
    centavos: h.value * 100,
    count: 1,
  })),
  recent: [
    {
      id: "gs1",
      amountCentavos: 25000,
      method: "cash",
      paymentRef: null,
      status: "recorded",
      serviceIds: [],
      plate: "XYZ 9876",
      customerName: "Regular Wash",
      paidAt: new Date().toISOString(),
    },
  ] as Sale[],
  previousDayTotalCentavos: 480_000,
};
