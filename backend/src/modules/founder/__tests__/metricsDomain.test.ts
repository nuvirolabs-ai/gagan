import { describe, expect, it } from "vitest";
import {
  deliveredQuantity,
  deltaVsComparable,
  fillRate,
  isFillEligible,
  metric,
  pace,
} from "../metricsDomain";

describe("fill rate", () => {
  it("is unavailable when fulfilment has not started", () => {
    expect(
      fillRate([{ status: "placed", items: [{ qtyOrdered: 10, qtyDelivered: null }] }])
    ).toBeNull();
    expect(isFillEligible({ status: "confirmed", items: [{ qtyOrdered: 1, qtyDelivered: null }] })).toBe(
      false
    );
  });

  it("uses captured delivered qty and treats unmarked delivered orders as full fill", () => {
    expect(
      fillRate([
        { status: "packed", items: [{ qtyOrdered: 10, qtyDelivered: 9 }] },
        { status: "delivered", items: [{ qtyOrdered: 10, qtyDelivered: null }] },
      ])
    ).toBe(95);
    expect(deliveredQuantity("delivered", { qtyOrdered: 4, qtyDelivered: null })).toBe(4);
    expect(deliveredQuantity("packed", { qtyOrdered: 4, qtyDelivered: null })).toBe(0);
  });

  it("excludes rejected orders", () => {
    expect(
      fillRate([{ status: "rejected", items: [{ qtyOrdered: 10, qtyDelivered: 0 }] }])
    ).toBeNull();
  });
});

describe("period comparison", () => {
  it("does not invent a pace when the comparable day is empty and today is not", () => {
    expect(pace(100, 0)).toBeNull();
    expect(pace(0, 0)).toBe(1);
    expect(pace(80, 100)).toBe(0.8);
  });

  it("records signed movement without turning unavailable into zero", () => {
    expect(deltaVsComparable(120, 100, "inr")).toEqual({ amount: 20, unit: "inr", direction: "up" });
    expect(deltaVsComparable(null, 100, "percent")).toBeNull();
    expect(metric({ id: "fillRate", label: "Fill rate", value: null, unit: "percent", asOf: "t" }).value).toBeNull();
    expect(metric({ id: "fillRate", label: "Fill rate", value: null, unit: "percent", asOf: "t" }).availability).toBe(
      "unavailable"
    );
  });
});
