#!/usr/bin/env node
/**
 * Seeds the LOCAL EMULATORS with SAMPLE data (never point this at a real project).
 *
 *   pnpm emulators          # terminal 1
 *   pnpm seed:emulator      # terminal 2
 *
 * Creates two owners you can sign in as with the Auth emulator (any SMS code works;
 * the code is also shown in the emulator UI / logs):
 *   +63 917 123 4567  Jun   -> "Sample Carwash"      (Partner, listed on River Mobile)
 *   +63 918 123 4567  Liza  -> "Sample Carwash Plus" (Paid, with bays and a queue)
 * It also registers a local River Mobile API client and books through the real
 * /v1 API (mycarwashPublicApiDev -> database mycarwash-dev), so the Partner home
 * shows incoming bookings. Writes the local API key
 * and check-in QR payloads to /tmp/mycarwash-seed.json (local only).
 */
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT = process.env.GCLOUD_PROJECT ?? "demo-mycarwash";
if (!PROJECT.startsWith("demo-")) throw new Error("Refusing to seed a non-demo project.");
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const PEPPER = process.env.API_KEY_PEPPER ?? "local-dev-pepper";
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ?? "mycarwash-dev";
const PUBLIC_API = process.env.PUBLIC_API_URL ?? `http://127.0.0.1:5001/${PROJECT}/asia-southeast1/mycarwashPublicApiDev`;

const app = initializeApp({ projectId: PROJECT });
const auth = getAuth(app);
// Same named database the *Dev functions use (the emulator supports named databases).
const db = getFirestore(app, DATABASE_ID);
const now = new Date();
const at = now.toISOString();
const minsAgo = (m) => new Date(now.getTime() - m * 60_000).toISOString();
const manilaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).replaceAll("-", "");
/** Today in PHT at hh:mm, as an ISO string with +08:00. */
const todayAt = (hhmm) => `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now)}T${hhmm}:00+08:00`;

async function user(uid, phoneNumber, displayName) {
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser({ uid, phoneNumber, displayName });
}

async function shop(id, ownerUid, name, plan, ownerName, phone) {
  await db.doc(`businesses/${id}`).set({
    name, ownerUid, plan, planStatus: "active", phoneE164: phone, address: "Quezon City (sample)",
    location: { lat: 14.6760, lng: 121.0437, formattedAddress: "Quezon City (sample)", placeId: null },
    billing: { partnerOption: plan === "partner" ? "monthly" : null, status: "active", lastPayment: null, activatedAt: new Date().toISOString(), expiresAt: null, checkoutProvider: "manual" },
    riverMobile: { listed: true, listedAt: at }, bookingCapacity: { slotMins: 60, maxBookingsPerSlot: 2 },
    settings: { dailyTargetCentavos: 750000 },
    createdAt: at, updatedAt: at,
  });
  await db.doc(`businesses/${id}/members/${ownerUid}`).set({
    uid: ownerUid, businessId: id, role: "owner", status: "active", displayName: ownerName, phoneE164: phone,
    email: null, invitedBy: null, createdAt: at, updatedAt: at,
  });
  // SAMPLE service menu (owner-entered in real use; centavos).
  const services = [
    ["svc-regular", "Regular Wash", 30, { small: 25000, medium: 30000, large: 35000 }],
    ["svc-vacuum", "Wash + Vacuum", 45, { small: 35000, medium: 40000, large: 45000 }],
    ["svc-detail", "Full Detail", 120, { small: 120000, medium: 150000, large: 180000 }],
  ];
  for (const [sid, sname, durationMins, pricesBySize] of services) {
    await db.doc(`businesses/${id}/services/${sid}`).set({ name: sname, durationMins, pricesBySize, active: true, listedOnRiverMobile: true, createdAt: at, updatedAt: at });
  }
}

async function main() {
  await user("owner-jun", "+639171234567", "Jun Santos");
  await user("owner-liza", "+639181234567", "Liza Reyes");
  await shop("sample-carwash", "owner-jun", "Sample Carwash", "partner", "Jun Santos", "+639171234567");
  await shop("sample-carwash-plus", "owner-liza", "Sample Carwash Plus", "paid", "Liza Reyes", "+639181234567");

  // Paid shop: bays and today's queue (SAMPLE).
  const P = "businesses/sample-carwash-plus";
  for (const [i, name] of ["Bay 1", "Bay 2", "Bay 3", "Bay 4"].entries()) {
    await db.doc(`${P}/bays/bay-${i + 1}`).set({ name, active: true, sortOrder: i, createdAt: at, updatedAt: at });
  }
  const q = [
    [1, "in_bay", "bay-1", ["svc-regular"], "ABC 1234", "staff", 18],
    [2, "in_bay", "bay-2", ["svc-detail"], "KLM 4321", "booking", 100],
    [3, "in_bay", "bay-3", ["svc-vacuum"], "NDX 5678", "staff", 14],
    [4, "queued", null, ["svc-regular"], "QWE 2468", "staff", 0],
    [5, "queued", null, ["svc-vacuum"], "STV 1357", "booking", 0],
    [6, "queued", null, ["svc-detail"], "UIO 8642", "staff", 0],
    [7, "queued", null, ["svc-regular"], "PAS 9753", "booking", 0],
  ];
  for (const [n, status, bayId, serviceIds, plate, source, started] of q) {
    await db.doc(`${P}/queue/q-${n}`).set({
      queueNumber: n, queueDate: manilaDay, source, status, bayId, serviceIds, vehicleSize: "medium", plate,
      customerId: null, bookingId: null, startedAt: status === "in_bay" ? minsAgo(started) : null, doneAt: null,
      createdAt: minsAgo(60 - n), updatedAt: at,
    });
  }
  await db.doc(`${P}/counters/queue-${manilaDay}`).set({ next: 8, dayKey: manilaDay });

  // Local River Mobile API client (key stays on this machine).
  const secret = randomBytes(24).toString("hex");
  await db.doc("api_clients/river-mobile").set({
    name: "River Mobile (local)", environment: "local", scopes: ["shops:read", "bookings:write", "bookings:read", "checkin:write"],
    secretHash: createHash("sha256").update(`${PEPPER}:${secret}`).digest("hex"), status: "active", createdAt: at,
  });
  const apiKey = `mcw_river-mobile_${secret}`;

  // Book through the real /v1 API (functions emulator must be running).
  const bookings = [
    ["Maria S.", "ABC 1234", ["svc-vacuum"], "10:00"],
    ["Rico D.", "KLM 4321", ["svc-detail"], "11:30"],
    ["Ana P.", "DFG 7788", ["svc-regular"], "14:00"],
    ["Ben T.", "JKL 2020", ["svc-regular"], "16:00"],
  ];
  const created = [];
  for (const [i, [name, plate, serviceIds, time]] of bookings.entries()) {
    const res = await fetch(`${PUBLIC_API}/v1/bookings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `seed-${now.getTime()}-${i}` },
      body: JSON.stringify({ shopId: "sample-carwash", serviceIds, vehicleSize: "medium", plate, slotStart: todayAt(time), customer: { ref: `rm-sample-${i}`, name } }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`POST /v1/bookings failed: ${res.status} ${JSON.stringify(body)}`);
    created.push(body);
  }
  // The 2nd and 3rd bookings are already accepted so they can be scanned.
  for (const b of created.slice(1, 3)) {
    await db.doc(`businesses/sample-carwash/bookings/${b.bookingId}`).update({ status: "accepted", acceptedBy: "owner-jun", updatedAt: at });
  }
  writeFileSync("/tmp/mycarwash-seed.json", JSON.stringify({ apiKey, bookings: created }, null, 2));
  console.log("Seeded emulators (SAMPLE data).");
  console.log("Sign in as +63 917 123 4567 (Partner) or +63 918 123 4567 (Paid).");
  console.log("Scan test payload (accepted booking):", created[1].checkIn.qrPayload);
  console.log("Local API key and payloads written to /tmp/mycarwash-seed.json");
}

main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
