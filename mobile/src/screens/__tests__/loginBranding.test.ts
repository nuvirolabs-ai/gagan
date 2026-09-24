import { describe, expect, it } from "vitest";
import { RETAILER_LOGIN_ARTWORK, RETAILER_LOGIN_ARTWORK_LABEL } from "../loginBranding";

describe("Retailer login artwork contract", () => {
  it("keeps the retailer app mapped to the left-panel identity", () => {
    expect(RETAILER_LOGIN_ARTWORK.source).toBe("gagan-retailer-login.png");
    expect(RETAILER_LOGIN_ARTWORK.brand).toBe("GAGAN");
    expect(RETAILER_LOGIN_ARTWORK.title).toBe("Welcome to GAGAN");
    expect(RETAILER_LOGIN_ARTWORK.support).toBe("Contact your distributor");
    expect(RETAILER_LOGIN_ARTWORK_LABEL).toContain("retailer");
  });

  it("preserves the supplied panel proportions and native card region", () => {
    expect(RETAILER_LOGIN_ARTWORK.width / RETAILER_LOGIN_ARTWORK.height).toBeCloseTo(487 / 1401);
    expect(Number.parseFloat(RETAILER_LOGIN_ARTWORK.cardTopPercent)).toBeGreaterThan(40);
    expect(Number.parseFloat(RETAILER_LOGIN_ARTWORK.cardTopPercent)).toBeLessThan(50);
    expect(Number.parseFloat(RETAILER_LOGIN_ARTWORK.cardHeightPercent)).toBeGreaterThan(35);
    expect(Number.parseFloat(RETAILER_LOGIN_ARTWORK.cardHeightPercent)).toBeLessThan(50);
  });
});
