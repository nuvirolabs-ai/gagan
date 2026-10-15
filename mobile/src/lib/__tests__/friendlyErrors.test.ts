import { describe, it, expect } from "vitest";
import { friendlyErrorMessage } from "../friendlyErrors";

describe("friendlyErrorMessage", () => {
  it("translates minimum_order_value into friendly English", () => {
    const err = { message: "minimum_order_value" };
    const res = friendlyErrorMessage(err, "en");
    expect(res.title).toBe("Minimum Order Required");
    expect(res.message).toContain("Order value is below the minimum required amount");
  });

  it("translates minimum_order_value into friendly Hindi", () => {
    const err = { body: { error: "minimum_order_value" } };
    const res = friendlyErrorMessage(err, "hi");
    expect(res.title).toBe("न्यूनतम ऑर्डर आवश्यक");
    expect(res.message).toContain("न्यूनतम राशि से कम है");
  });

  it("translates network errors properly", () => {
    const networkErr = new TypeError("Failed to fetch");
    const res = friendlyErrorMessage(networkErr, "en");
    expect(res.title).toBe("Network Connection Issue");
    expect(res.message).toContain("Weak internet connection");
  });

  it("translates insufficient_inventory into friendly message", () => {
    const err = { message: "insufficient_inventory" };
    const res = friendlyErrorMessage(err, "en");
    expect(res.title).toBe("Item Shortage");
  });

  it("translates idempotency_key_conflict", () => {
    const err = { body: { error: "idempotency_key_conflict" } };
    const res = friendlyErrorMessage(err, "en");
    expect(res.title).toBe("Order Already Placed");
  });

  it("preserves already friendly sentences", () => {
    const res = friendlyErrorMessage(new Error("Please add your billing address first"), "en");
    expect(res.message).toBe("Please add your billing address first");
  });

  it("falls back to generic notice for unknown error codes", () => {
    const res = friendlyErrorMessage(new Error("unknown_fatal_crash_code"), "en");
    expect(res.title).toBe("Notice");
  });
});
