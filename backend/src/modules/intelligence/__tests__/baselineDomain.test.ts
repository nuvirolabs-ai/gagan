import { describe, expect, it } from "vitest";
import {
  BASELINE_MAX_ORDERS,
  MIN_ORDERS_FOR_INTERVAL,
  buildBaseline,
  mean,
  median,
  trendOf,
  wholeDaysBetween,
} from "../baselineDomain";

const at = (iso: string) => new Date(`${iso}T10:00:00.000Z`);
const NOW = at("2026-03-20");

const order = (iso: string, value = 20000, lineItems = 5, categories: string[] = ["Daal"]) => ({
  placedAt: at(iso),
  value,
  lineItems,
  categories,
});

describe("statistics helpers", () => {
  it("takes the middle of an odd sample", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("averages the two middles of an even sample", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("has no median or mean for nothing", () => {
    expect(median([])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("counts whole days regardless of the time of day", () => {
    expect(wholeDaysBetween(at("2026-03-01"), new Date("2026-03-13T01:00:00.000Z"))).toBe(12);
  });
});

describe("order cycle", () => {
  it("needs three orders before it will say 'usually'", () => {
    const two = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-03-01"), order("2026-03-13")],
      visits: [],
      now: NOW,
    });
    expect(two.hasIntervalBaseline).toBe(false);
    expect(two.medianIntervalDays).toBeNull();

    const three = buildBaseline({
      retailerId: "r1",
      // Two clean 12-day gaps.
      orders: [order("2026-02-17"), order("2026-03-01"), order("2026-03-13")],
      visits: [],
      now: NOW,
    });
    expect(three.hasIntervalBaseline).toBe(true);
    expect(three.medianIntervalDays).toBe(12);
  });

  it("says nothing at all about a shop that has never ordered", () => {
    const baseline = buildBaseline({ retailerId: "r1", orders: [], visits: [], now: NOW });
    expect(baseline).toMatchObject({
      orderCount: 0,
      medianIntervalDays: null,
      medianOrderValue: null,
      daysSinceLastOrder: null,
      hasIntervalBaseline: false,
      hasValueBaseline: false,
    });
  });

  it("takes the median gap, so one long holiday does not become the cycle", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-01-01"), order("2026-02-20"), order("2026-03-01"), order("2026-03-11")],
      visits: [],
      now: NOW,
    });
    // Gaps of 50, 10 and 10 days: the median is 10, not the 23-day average.
    expect(baseline.medianIntervalDays).toBe(10);
  });

  it("measures from the newest order however the rows arrived", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-03-13"), order("2026-02-18"), order("2026-03-01")],
      visits: [],
      now: NOW,
    });
    expect(baseline.daysSinceLastOrder).toBe(7);
    expect(baseline.lastOrderAt).toEqual(at("2026-03-13"));
  });

  it("looks at no more than the recent window of orders", () => {
    const orders = Array.from({ length: BASELINE_MAX_ORDERS + 6 }, (_, index) =>
      order(`2026-01-${String((index % 28) + 1).padStart(2, "0")}`)
    );
    expect(buildBaseline({ retailerId: "r1", orders, visits: [], now: NOW }).orderCount).toBe(
      BASELINE_MAX_ORDERS
    );
  });

  it("ignores two orders on the same day rather than calling the cycle zero", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [order("2026-03-01"), order("2026-03-01"), order("2026-03-13"), order("2026-03-25")],
      visits: [],
      now: NOW,
    });
    expect(baseline.medianIntervalDays).toBe(12);
  });
});

describe("value and range", () => {
  it("needs enough orders before quoting a typical basket", () => {
    const thin = buildBaseline({ retailerId: "r1", orders: [order("2026-03-01", 50000)], visits: [], now: NOW });
    expect(thin.hasValueBaseline).toBe(false);
    expect(thin.medianOrderValue).toBeNull();
  });

  it("reports the typical and the most recent order separately", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [
        order("2026-03-13", 11200, 3),
        order("2026-03-01", 22400, 8),
        order("2026-02-18", 23000, 7),
      ],
      visits: [],
      now: NOW,
    });
    expect(baseline.medianOrderValue).toBe(22400);
    expect(baseline.lastOrderValue).toBe(11200);
    expect(baseline.medianLineItems).toBe(7);
    expect(baseline.lastOrderLineItems).toBe(3);
  });
});

describe("categories", () => {
  it("counts a category as regular when it is in at least half the orders", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [
        order("2026-03-13", 20000, 5, ["Daal"]),
        order("2026-03-01", 20000, 5, ["Daal", "Rice"]),
        order("2026-02-18", 20000, 5, ["Daal", "Rice"]),
        order("2026-02-05", 20000, 5, ["Daal", "Sugar"]),
      ],
      visits: [],
      now: NOW,
    });
    expect(baseline.regularCategories).toEqual(["Daal", "Rice"]);
    expect(baseline.lastOrderCategories).toEqual(["Daal"]);
  });

  it("does not double-count a category listed twice in one order", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [
        order("2026-03-13", 20000, 5, ["Daal", "Daal"]),
        order("2026-03-01", 20000, 5, ["Rice"]),
        order("2026-02-18", 20000, 5, ["Rice"]),
      ],
      visits: [],
      now: NOW,
    });
    expect(baseline.regularCategories).toEqual(["Rice"]);
  });
});

describe("trend", () => {
  it("stays unknown without six orders to compare", () => {
    expect(trendOf([100, 100, 100, 100, 100])).toBe("unknown");
  });

  it("calls a clear rise and a clear fall", () => {
    expect(trendOf([130, 130, 130, 100, 100, 100])).toBe("rising");
    expect(trendOf([70, 70, 70, 100, 100, 100])).toBe("falling");
  });

  it("calls small movement steady", () => {
    expect(trendOf([105, 100, 100, 100, 100, 100])).toBe("steady");
  });
});

describe("visits", () => {
  it("measures from the most recent visit", () => {
    const baseline = buildBaseline({
      retailerId: "r1",
      orders: [],
      visits: [{ visitedAt: at("2026-03-02") }, { visitedAt: at("2026-03-15") }],
      now: NOW,
    });
    expect(baseline.daysSinceLastVisit).toBe(5);
  });

  it("has nothing to say about a shop never visited", () => {
    expect(
      buildBaseline({ retailerId: "r1", orders: [], visits: [], now: NOW }).daysSinceLastVisit
    ).toBeNull();
  });
});

describe("the least history a cycle needs", () => {
  it("is three orders", () => {
    expect(MIN_ORDERS_FOR_INTERVAL).toBe(3);
  });
});
