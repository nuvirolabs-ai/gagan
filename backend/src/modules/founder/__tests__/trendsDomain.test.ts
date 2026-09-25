import { describe, expect, it } from "vitest";
import { interpretTrend, percentChange } from "../trendsDomain";
import { rollingWindow } from "../period";

describe("trend interpretation", () => {
  it("uses a 5% band for stabilization", () => {
    expect(interpretTrend({ id: "orders", current: 105, previous: 100 })).toBe("Orders are accelerating.");
    expect(interpretTrend({ id: "orders", current: 102, previous: 100 })).toBe("Orders have stabilized.");
    expect(interpretTrend({ id: "collections", current: 80, previous: 100 })).toBe("Collections are weakening.");
    expect(interpretTrend({ id: "fillRate", current: 91, previous: 90 })).toBe("Fill rate has stabilized.");
    expect(interpretTrend({ id: "fillRate", current: 80, previous: 90 })).toBe("Fill rate is weakening.");
    expect(interpretTrend({ id: "activeRetailers", current: 12, previous: 10 })).toBe(
      "Active retailer count is improving."
    );
    expect(interpretTrend({ id: "salesTeam", current: 40, previous: 50 })).toBe(
      "Sales-team productivity is weakening."
    );
  });

  it("does not invent an overdue history", () => {
    expect(interpretTrend({ id: "overdue", current: 20_000, previous: null })).toBe(
      "Overdue is taken from today's invoice ledger, not a reconstructed history."
    );
    expect(interpretTrend({ id: "fillRate", current: null, previous: null, unavailable: true })).toBe(
      "Fill rate is unavailable until fulfilment has started in this period."
    );
  });

  it("returns null percent change when the prior window is empty", () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(110, 100)).toBe(10);
  });
});

describe("rolling windows", () => {
  it("keeps 7/30/90 day current and prior windows adjacent", () => {
    const now = new Date("2026-09-02T08:30:00.000+05:30");
    const week = rollingWindow(now, 7);
    expect(week.current.label).toBe("7D");
    expect(week.previous.end.getTime()).toBe(week.current.start.getTime());
    expect((week.current.end.getTime() - week.current.start.getTime()) / 86_400_000).toBe(7);
    expect((week.previous.end.getTime() - week.previous.start.getTime()) / 86_400_000).toBe(7);
  });
});
