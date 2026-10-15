import { describe, it, expect } from "vitest";
import { evaluateCoupon, getAvailableCoupons } from "../couponService";

describe("backend couponService", () => {
  it("lists available coupons", () => {
    const list = getAvailableCoupons();
    expect(list.length).toBeGreaterThan(0);
    expect(list.some(c => c.code === "WELCOME500")).toBe(true);
  });

  it("evaluates WELCOME500 flat discount", () => {
    const res = evaluateCoupon("welcome500", 3000);
    expect(res.valid).toBe(true);
    if (!res.valid) return;
    expect(res.discountAmount).toBe(500);
    expect(res.coupon?.code).toBe("WELCOME500");
  });

  it("rejects WELCOME500 when below minOrderValue", () => {
    const res = evaluateCoupon("WELCOME500", 1500);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.error).toBe("coupon_min_value_not_met");
  });

  it("evaluates DIWALI5 percentage with cap", () => {
    const res = evaluateCoupon("DIWALI5", 30000);
    expect(res.valid).toBe(true);
    if (!res.valid) return;
    expect(res.discountAmount).toBe(1000);
  });

  it("rejects unknown coupon", () => {
    const res = evaluateCoupon("UNKNOWN", 5000);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.error).toBe("invalid_coupon");
  });
});
