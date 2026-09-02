import { describe, expect, it } from "vitest";
import { STAGING_SALES_KIT } from "../salesKit";

describe("staging Sales Kit", () => {
  it("is a small read-only set of Gagan collateral", () => {
    expect(STAGING_SALES_KIT.length).toBeGreaterThanOrEqual(4);
    expect(STAGING_SALES_KIT.every((item) => item.source === "demo" && item.url.startsWith("https://"))).toBe(true);
    expect(STAGING_SALES_KIT.every((item) => item.title.toLowerCase().includes("gagan") || item.category.length > 0)).toBe(true);
  });
});
