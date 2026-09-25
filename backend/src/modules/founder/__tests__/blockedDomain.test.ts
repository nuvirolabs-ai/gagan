import { describe, expect, it } from "vitest";
import { detectBlockers, primaryBlocker, summarizeBlocked } from "../blockedDomain";

describe("blocked value deduplication", () => {
  it("assigns a deterministic primary blocker and does not double-count unique value", () => {
    expect(primaryBlocker(["INVENTORY", "CREDIT", "SYSTEM"])).toBe("CREDIT");
    const summary = summarizeBlocked(
      [
        { id: "a", orderTotal: 10_000, categories: ["CREDIT", "INVENTORY"] },
        { id: "b", orderTotal: 4_000, categories: ["INVENTORY"] },
      ],
      "t"
    );
    expect(summary.totalUniqueValue).toBe(14_000);
    expect(summary.grossConstraintImpact).toBe(24_000);
    expect(summary.categories.find((row) => row.id === "CREDIT")?.uniqueValue).toBe(10_000);
    expect(summary.categories.find((row) => row.id === "INVENTORY")?.uniqueValue).toBe(4_000);
    expect(summary.orderCount).toBe(2);
  });

  it("ignores unconstrained open orders", () => {
    expect(summarizeBlocked([{ id: "a", orderTotal: 9_000, categories: [] }], "t").totalUniqueValue).toBe(0);
  });

  it("classifies credit, short stock, packed dispatch, and failed SAP", () => {
    expect(
      detectBlockers({
        status: "placed",
        sapSyncStatus: "pending",
        hasOpenApproval: true,
        lines: [{ remaining: 2, available: 0, snapshotStale: false }],
      })
    ).toEqual(["CREDIT", "INVENTORY"]);
    expect(
      detectBlockers({
        status: "packed",
        sapSyncStatus: "failed",
        hasOpenApproval: false,
        lines: [{ remaining: 0, available: 10, snapshotStale: false }],
      })
    ).toEqual(["DISPATCH", "SYSTEM"]);
  });
});
