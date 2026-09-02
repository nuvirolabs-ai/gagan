import { describe, expect, it } from "vitest";
import { composeInsights, composeSummary } from "../insightsDomain";
import { composeIssues } from "../issuesDomain";
import type { FounderHealthDomain } from "../types";

const healthy = (domain: FounderHealthDomain["domain"]): FounderHealthDomain => ({
  domain,
  status: "HEALTHY",
  reason: "ok",
  primaryMetric: "x",
  asOf: "t",
});

describe("deterministic brief pieces", () => {
  it("composes an explainable headline from health domains", () => {
    expect(composeSummary([healthy("Sales"), healthy("Collections")]).headline).toBe(
      "Business is healthy overall."
    );
    expect(
      composeSummary([
        { ...healthy("Sales"), status: "HEALTHY" },
        { ...healthy("Collections"), status: "WATCH" },
      ]).headline
    ).toBe("Sales are tracking, while collections need attention.");
    expect(
      composeSummary([{ ...healthy("Inventory"), status: "AT_RISK" }]).tone
    ).toBe("risk");
  });

  it("emits what-changed insights only when the move is material", () => {
    const quiet = composeInsights({
      asOf: "2026-09-02T10:00:00.000Z",
      ordersToday: 100,
      ordersComparable: 99,
      collectionsToday: 50,
      collectionsComparable: 50,
      fillRateToday: 95,
      fillRateComparable: 95,
      inventoryUniqueBlocked: 0,
      inventoryOrderCount: 0,
    });
    expect(quiet).toEqual([]);

    const noisy = composeInsights({
      asOf: "2026-09-02T10:00:00.000Z",
      ordersToday: 120,
      ordersComparable: 100,
      collectionsToday: 40,
      collectionsComparable: 80,
      fillRateToday: 89,
      fillRateComparable: 94,
      inventoryUniqueBlocked: 78_000,
      inventoryOrderCount: 18,
    });
    expect(noisy.map((row) => row.id).sort()).toEqual([
      "collections-pace",
      "fill-rate",
      "inventory-pressure",
      "orders-pace",
    ]);
    expect(noisy.find((row) => row.id === "orders-pace")?.type).toBe("POSITIVE_CHANGE");
    expect(noisy.find((row) => row.id === "collections-pace")?.type).toBe("NEGATIVE_CHANGE");
  });
});

describe("issue ordering", () => {
  it("sorts by business impact, not recency", () => {
    const issues = composeIssues({
      asOf: "t",
      blocked: {
        totalUniqueValue: 200_000,
        grossConstraintImpact: 200_000,
        orderCount: 3,
        asOf: "t",
        categories: [
          { id: "INVENTORY", uniqueValue: 80_000, orderCount: 2 },
          { id: "CREDIT", uniqueValue: 120_000, orderCount: 1 },
        ],
      },
      failedOutbox: 2,
      oldestFailedOutboxHours: 6,
      overdue: 10,
      outstanding: 100,
    });
    expect(issues[0].id).toBe("blocked-credit");
    expect(issues.map((issue) => issue.id)).toContain("sap-outbox");
    expect(issues.every((issue) => issue.status === "open")).toBe(true);
  });

  it("keeps one executive issue per root constraint", () => {
    const issues = composeIssues({
      asOf: "t",
      blocked: {
        totalUniqueValue: 78_000,
        grossConstraintImpact: 156_000,
        orderCount: 1,
        asOf: "t",
        categories: [{ id: "INVENTORY", uniqueValue: 78_000, orderCount: 1 }],
      },
      failedOutbox: 0,
      oldestFailedOutboxHours: null,
      overdue: 0,
      outstanding: 10,
    });
    expect(issues.filter((issue) => issue.id.startsWith("blocked-"))).toHaveLength(1);
    expect(issues[0].owner).toBe("Operations");
  });
});
