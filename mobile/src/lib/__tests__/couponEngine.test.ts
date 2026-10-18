import { describe, it, expect } from "vitest";
import { evaluateCoupon, AVAILABLE_COUPONS } from "../couponEngine";

describe("couponEngine", () => {
  it("has default coupons available", () => {
    expect(AVAILABLE_COUPONS.length).toBeGreaterThan(0);
    const welcome = AVAILABLE_COUPONS.find((c) => c.code === "WELCOME500");
    expect(welcome).toBeDefined();
    expect(welcome?.value).toBe(500);
  });

  it("evaluates WELCOME500 flat discount", () => {
    const res = evaluateCoupon("welcome500", 3000);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.discountAmount).toBe(500);
      expect(res.coupon?.code).toBe("WELCOME500");
    }
  });

  it("rejects WELCOME500 when subtotal is below minimum order value", () => {
    const res = evaluateCoupon("WELCOME500", 1500);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBe("coupon_min_value_not_met");
      expect(res.friendlyMessage).toContain("Minimum order value");
    }
  });

  it("evaluates percentage discount DIWALI5 capped at maxDiscount", () => {
    // 5% of 10000 is 500
    const res1 = evaluateCoupon("DIWALI5", 10000);
    expect(res1.valid).toBe(true);
    if (res1.valid) {
      expect(res1.discountAmount).toBe(500);
    }

    // 5% of 30000 is 1500, but cap is 1000
    const res2 = evaluateCoupon("DIWALI5", 30000);
    expect(res2.valid).toBe(true);
    if (res2.valid) {
      expect(res2.discountAmount).toBe(1000);
    }
  });

  it("evaluates SAVE10 percentage discount on qualified order", () => {
    // 10% of 15000 is 1500
    const res = evaluateCoupon("SAVE10", 15000);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.discountAmount).toBe(1500);
    }
  });

  it("rejects non-existent coupon", () => {
    const res = evaluateCoupon("FAKECODE123", 5000);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBe("invalid_coupon");
      expect(res.friendlyMessage).toBe("Invalid coupon code.");
    }
  });

  it("handles blank or null coupon code", () => {
    const res = evaluateCoupon("", 5000);
    expect(res.valid).toBe(false);
  });
});
