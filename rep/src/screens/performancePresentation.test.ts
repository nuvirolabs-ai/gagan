import { describe, expect, it } from "vitest";
import { chartRows, compactInr, metricRows } from "./performancePresentation";

describe("performance presentation", () => {
  it("formats large INR values on one readable line", () => {
    expect(compactInr(300000)).toBe("₹3L");
    expect(compactInr(342000)).toBe("₹3.42L");
    expect(compactInr(48750)).toBe("₹48.8K");
  });

  it("maps canonical series to the selected metric", () => {
    const visuals = {
      salesTrend: [{ date: "2026-09-01", value: 342000 }],
      ordersByDay: [{ date: "2026-09-01", orders: 4 }],
      visitsTrend: [{ date: "2026-09-01", visits: 2 }],
      collectionsTrend: [{ date: "2026-09-01", confirmedValue: 12000 }],
    };
    expect(metricRows(visuals, "sales")[0].value).toBe(342000);
    expect(metricRows(visuals, "orders")[0].value).toBe(4);
    expect(metricRows(visuals, "visits")[0].value).toBe(2);
    expect(metricRows(visuals, "collections")[0].value).toBe(12000);
  });

  it("keeps seven-day daily detail and buckets a 30-day view", () => {
    const salesTrend = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, "0")}`,
      value: index + 1,
    }));
    expect(chartRows({ salesTrend }, "sales", 7)).toHaveLength(7);
    expect(chartRows({ salesTrend }, "sales", 30)).toHaveLength(6);
    expect(chartRows({ salesTrend }, "sales", 30).reduce((sum, row) => sum + row.value, 0)).toBe(465);
  });

  it("leaves a zero series truthful instead of manufacturing movement", () => {
    expect(chartRows({ salesTrend: [] }, "sales", 30)).toEqual([]);
    expect(chartRows({ salesTrend: [{ date: "2026-09-01", value: 0 }] }, "sales", 7)[0].value).toBe(0);
  });
});
