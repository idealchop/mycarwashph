import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collectionGroup, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const rules = readFileSync(fileURLToPath(new URL("../../firestore.rules", import.meta.url)), "utf8");
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-mycarwash", firestore: { rules } });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const member = (businessId: string, uid: string, role: string, status = "active") =>
      setDoc(doc(db, `businesses/${businessId}/members/${uid}`), { uid, businessId, role, status });
    await setDoc(doc(db, "businesses/shopA"), { name: "Alice Wash", plan: "partner" });
    await setDoc(doc(db, "businesses/shopB"), { name: "Bob Wash", plan: "paid" });
    await member("shopA", "alice", "owner");
    await member("shopA", "sam", "staff");
    await member("shopA", "exstaff", "staff", "removed");
    await member("shopB", "bob", "owner");
    await setDoc(doc(db, "businesses/shopA/services/s1"), { name: "Basic wash" });
    await setDoc(doc(db, "businesses/shopB/services/s1"), { name: "Premium" });
    await setDoc(doc(db, "businesses/shopA/bookings/b1"), { status: "requested", verifyCodeHash: "x" });
    await setDoc(doc(db, "businesses/shopA/audit_logs/l1"), { action: "business.create" });
    await setDoc(doc(db, "api_clients/river-mobile"), { secretHash: "x" });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("tenancy rules", () => {
  it("members can read their own business and its services", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "businesses/shopA")));
    await assertSucceeds(getDoc(doc(as("sam"), "businesses/shopA/services/s1")));
  });

  it("non-members cannot read another business or its data", async () => {
    await assertFails(getDoc(doc(as("alice"), "businesses/shopB")));
    await assertFails(getDoc(doc(as("alice"), "businesses/shopB/services/s1")));
    await assertFails(getDoc(doc(as("alice"), "businesses/shopB/members/bob")));
  });

  it("removed members lose access", async () => {
    await assertFails(getDoc(doc(as("exstaff"), "businesses/shopA")));
  });

  it("signed-out users cannot read anything", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "businesses/shopA")));
  });

  it("clients can never write; writes go through the API", async () => {
    await assertFails(setDoc(doc(as("alice"), "businesses/shopA"), { name: "x" }));
    await assertFails(setDoc(doc(as("alice"), "businesses/shopA/services/s2"), { name: "x" }));
    await assertFails(setDoc(doc(as("mallory"), "businesses/shopA/members/mallory"), { uid: "mallory", businessId: "shopA", role: "owner", status: "active" }));
    await assertFails(setDoc(doc(as("mallory"), "businesses/newShop"), { name: "x" }));
  });

  it("bookings (check-in hashes) and audit logs are protected", async () => {
    await assertFails(getDoc(doc(as("sam"), "businesses/shopA/bookings/b1")));
    await assertFails(getDoc(doc(as("sam"), "businesses/shopA/audit_logs/l1")));
    await assertSucceeds(getDoc(doc(as("alice"), "businesses/shopA/audit_logs/l1")));
  });

  it("platform collections are server-only", async () => {
    await assertFails(getDoc(doc(as("alice"), "api_clients/river-mobile")));
  });

  it("a user can list only their own memberships across shops", async () => {
    await assertSucceeds(getDocs(query(collectionGroup(as("sam"), "members"), where("uid", "==", "sam"))));
    await assertFails(getDocs(query(collectionGroup(as("sam"), "members"), where("uid", "==", "bob"))));
  });
});
