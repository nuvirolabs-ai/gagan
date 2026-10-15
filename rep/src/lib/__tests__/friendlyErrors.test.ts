import { describe, it, expect } from "vitest";
import { friendlyErrorMessage } from "../friendlyErrors";

describe("rep friendlyErrorMessage", () => {
  it("translates minimum_order_value into friendly English", () => {
    const err = { message: "minimum_order_value" };
    const res = friendlyErrorMessage(err, "en");
    expect(res.title).toBe("Minimum Order Required");
    expect(res.message).toContain("Order value is below the minimum required amount");
  });

  it("translates network errors properly", () => {
    const networkErr = new TypeError("Failed to fetch");
    const res = friendlyErrorMessage(networkErr, "en");
    expect(res.title).toBe("Network Connection Issue");
    expect(res.message).toContain("Weak internet connection");
  });

  it("translates quote_changed_or_expired", () => {
    const err = { body: { error: "quote_changed_or_expired" } };
    const res = friendlyErrorMessage(err, "en");
    expect(res.title).toBe("Prices Updated");
  });

  it("translates invalid_coupon", () => {
    const err = { body: { error: "invalid_coupon" } };
    const res = friendlyErrorMessage(err, "en");
    expect(res.title).toBe("Invalid Coupon");
  });
});
