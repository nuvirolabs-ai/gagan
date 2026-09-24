import { describe, expect, it } from "vitest";
import { SALESPERSON_LOGIN_ARTWORK, SALESPERSON_LOGIN_ARTWORK_LABEL } from "../loginBranding";

describe("Salesperson login artwork contract", () => {
  it("keeps the Salesperson app mapped to the right-panel identity", () => {
    expect(SALESPERSON_LOGIN_ARTWORK.source).toBe("gagan-sales-login.png");
    expect(SALESPERSON_LOGIN_ARTWORK.brand).toBe("GAGAN SALES");
    expect(SALESPERSON_LOGIN_ARTWORK.title).toBe("Welcome to GAGAN SALES");
    expect(SALESPERSON_LOGIN_ARTWORK.support).toBe("Contact your manager");
    expect(SALESPERSON_LOGIN_ARTWORK_LABEL).toContain("Sales");
  });

  it("preserves the supplied panel proportions and native card region", () => {
    expect(SALESPERSON_LOGIN_ARTWORK.width / SALESPERSON_LOGIN_ARTWORK.height).toBeCloseTo(487 / 1401);
    expect(Number.parseFloat(SALESPERSON_LOGIN_ARTWORK.cardTopPercent)).toBeGreaterThan(40);
    expect(Number.parseFloat(SALESPERSON_LOGIN_ARTWORK.cardTopPercent)).toBeLessThan(50);
    expect(Number.parseFloat(SALESPERSON_LOGIN_ARTWORK.cardHeightPercent)).toBeGreaterThan(35);
    expect(Number.parseFloat(SALESPERSON_LOGIN_ARTWORK.cardHeightPercent)).toBeLessThan(50);
  });
});
