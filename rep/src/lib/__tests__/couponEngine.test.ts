import { describe, it, expect } from "vitest";
import { evaluateCoupon, AVAILABLE_COUPONS } from "../couponEngine";

describe("rep couponEngine", () => {
  it("has default coupons available", () => {
    expect(AVAILABLE_COUPONS.length).toBeGreaterThan(0);
    const welcome = AVAILABLE_COUPONS.find((c) => c.code === "WELCOME500");
    expect(welcome).toBeDefined();
    expect(welcome?.value).toBe(500);
  });

  it("evaluates WELCOME500 flat discount", () => {
    const res = evaluateCoupon("welcome500", 3000);
    expect(res.valid).toBe(true);
    expect(res.discountAmount).toBe(500);
    expect(res.coupon?.code).toBe("WELCOME500");
  });

  it("evaluates percentage discount DIWALI5 capped at maxDiscount", () => {
    const res = evaluateCoupon("DIWALI5", 30000);
    expect(res.valid).toBe(true);
    expect(res.discountAmount).toBe(1000);
  });

  it("evaluates SAVE10 percentage discount on qualified order", () => {
    const res = evaluateCoupon("SAVE10", 15000);
    expect(res.valid).toBe(true);
    expect(res.discountAmount).toBe(1500);
  });

  it("rejects non-existent coupon", () => {
    const res = evaluateCoupon("NONEXISTENT", 5000);
    expect(res.valid).toBe(false);
    expect(res.error).toBe("invalid_coupon");
    expect(res.friendlyMessage).toBe("Invalid coupon code.");
  });
});
