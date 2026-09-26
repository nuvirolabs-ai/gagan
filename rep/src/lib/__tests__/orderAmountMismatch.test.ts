import { describe, expect, it } from "vitest";
import { hasOrderAmountMismatch } from "../orderAmountMismatch";

describe("hasOrderAmountMismatch", () => {
  it("flags a snapshotless historical order whose stored total differs from its item extensions", () => {
    expect(hasOrderAmountMismatch({ orderTotal: "42850", items: [
      { unitPrice: "3150", qtyOrdered: 9 },
      { unitPrice: "5400", qtyOrdered: 5 },
    ] })).toBe(true);
  });

  it("does not flag matching totals or snapshot-backed commercial orders", () => {
    expect(hasOrderAmountMismatch({ orderTotal: "8550", items: [{ unitPrice: "2850", qtyOrdered: 3 }] })).toBe(false);
    expect(hasOrderAmountMismatch({ orderTotal: "42850", commercialSnapshot: {}, items: [{ unitPrice: "5400", qtyOrdered: 5 }] })).toBe(false);
  });

  it("does not make a discrepancy claim from incomplete item data", () => {
    expect(hasOrderAmountMismatch({ orderTotal: "100", items: [{ unitPrice: null, qtyOrdered: 1 }] })).toBe(false);
  });
});
