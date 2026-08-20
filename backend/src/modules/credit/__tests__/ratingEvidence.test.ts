import { describe, expect, it } from "vitest";
import { netAllocationAmount } from "../ratingService";

describe("rating payment evidence", () => {
  it("subtracts immutable reversal allocations before treating an invoice as paid", () => {
    expect(netAllocationAmount({
      amount: 10_000,
      reversals: [{ amount: 2_500 }, { amount: 500 }],
    })).toBe(7_000);
  });

  it("never turns an over-reversal into negative payment evidence", () => {
    expect(netAllocationAmount({ amount: 1_000, reversals: [{ amount: 1_500 }] })).toBe(0);
  });
});
