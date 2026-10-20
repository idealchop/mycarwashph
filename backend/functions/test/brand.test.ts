import { describe, expect, it } from "vitest";
import { brand as fe } from "../../../frontend/src/config/brand.js";
import { brand as be } from "../src/config/brand.js";

describe("brand config", () => {
  it("frontend and backend agree on productSlug and productName", () => {
    expect(fe.productSlug).toBe(be.productSlug);
    expect(fe.productName).toBe(be.productName);
    expect(fe.tagline).toBe(be.tagline);
  });
});
