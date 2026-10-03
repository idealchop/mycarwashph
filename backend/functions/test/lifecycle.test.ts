import { describe, expect, it } from "vitest";
import { manilaDayKey } from "../src/lib/time.js";
import { canTransition } from "../src/models/booking-lifecycle.js";
import { parseCheckInPayload } from "../src/services/bookings-service.js";

describe("booking lifecycle", () => {
  it("follows plan §3.6 for Partner and Paid", () => {
    expect(canTransition("requested", "accepted", "partner")).toBe(true);
    expect(canTransition("requested", "checked_in", "partner")).toBe(false);
    expect(canTransition("checked_in", "completed", "partner")).toBe(true);
    expect(canTransition("checked_in", "queued", "partner")).toBe(false);
    expect(canTransition("checked_in", "queued", "paid")).toBe(true);
    expect(canTransition("checked_in", "completed", "paid")).toBe(false);
    expect(canTransition("declined", "accepted", "paid")).toBe(false);
  });
});

describe("helpers", () => {
  it("uses the Manila day for queue resets", () => {
    expect(manilaDayKey(new Date("2026-10-03T15:59:00Z"))).toBe("20261003");
    expect(manilaDayKey(new Date("2026-10-03T16:00:00Z"))).toBe("20261004");
  });
  it("parses check-in payloads strictly", () => {
    expect(parseCheckInPayload("MCW1.shop1.bk1.ABCDEFGH")).toEqual({ businessId: "shop1", bookingId: "bk1", code: "ABCDEFGH" });
    expect(parseCheckInPayload("MCW1.shop1.bk1.short")).toBeNull();
    expect(parseCheckInPayload("https://evil.example")).toBeNull();
  });
});
