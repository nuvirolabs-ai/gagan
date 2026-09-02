import { describe, expect, it } from "vitest";
import { buildPerformanceVisuals } from "../performanceVisuals";

const day = (value: string) => new Date(`${value}T10:00:00.000Z`);

describe("performance visual read model", () => {
  it("fills selling days, aggregates canonical rows and calculates productivity", () => {
    const result = buildPerformanceVisuals({
      from: day("2026-09-01"),
      to: day("2026-09-03"),
      orders: [
        { createdAt: day("2026-09-01"), orderTotal: 1000, categories: ["Daal"] },
        { createdAt: day("2026-09-03"), orderTotal: 2500, categories: ["Rice", "Rice"] },
      ],
      visits: [
        { checkedInAt: day("2026-09-01"), outcome: "order_placed", activityTypes: [] },
        { checkedInAt: day("2026-09-02"), outcome: "no_order", activityTypes: [] },
      ],
      collections: [{ submittedAt: day("2026-09-03"), amount: 500, status: "confirmed" }],
    });

    expect(result.salesTrend.map((row) => row.value)).toEqual([1000, 0, 2500]);
    expect(result.ordersByDay.map((row) => row.orders)).toEqual([1, 0, 1]);
    expect(result.productivityPct).toBe(50);
    expect(result.categoryContribution[0]).toMatchObject({ category: "Rice", value: 2500 });
    expect(result.collectionsTrend[2].confirmedValue).toBe(500);
  });

  it("keeps empty history honest and does not invent a chart conclusion", () => {
    const result = buildPerformanceVisuals({ from: day("2026-09-01"), to: day("2026-09-02"), orders: [], visits: [], collections: [] });
    expect(result.hasEnoughHistory).toBe(false);
    expect(result.productivityPct).toBeNull();
    expect(result.salesTrend).toHaveLength(2);
    expect(result.salesTrend.every((row) => row.value === 0)).toBe(true);
  });
});
