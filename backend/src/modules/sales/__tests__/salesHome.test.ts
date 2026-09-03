import { describe, expect, it } from "vitest";
import {
  FIELD_DAILY_TARGET,
  FIELD_WEEKLY_TARGET,
  buildSalesHome,
  percentOfTarget,
  startOfUtcDay,
  startOfUtcWeek,
} from "../salesHome";

describe("sales home aggregation", () => {
  const staff = { id: "staff-1", name: "Arjun" };
  const retailers = [
    { id: "r1", name: "Sharma General Store", shopAddress: "MG Road, Bangalore", beatName: "MG Road", district: "Bangalore" },
    { id: "r2", name: "Kaveri Super Mart", shopAddress: "Commercial Street", beatName: "Commercial Street", district: "Bangalore" },
  ];

  it("builds next-visit route, targets and milestone chips from existing orders and visits", () => {
    const home = buildSalesHome({
      staff,
      territory: "Bangalore North",
      retailers,
      visitsToday: [{ id: "v1", retailerId: "r1", checkedOutAt: null, retailerName: "Sharma General Store" }],
      todaySales: 48_750,
      weekSales: 221_000,
      pendingApprovals: 3,
      now: new Date("2026-09-03T04:00:00.000Z"),
    });

    expect(home.greeting).toBe("morning");
    expect(home.sales).toMatchObject({
      today: 48_750,
      week: 221_000,
      dailyTarget: FIELD_DAILY_TARGET,
      weeklyTarget: FIELD_WEEKLY_TARGET,
      dailyPct: 76,
      weeklyPct: 68,
      currentMilestone: 75,
      nextMilestone: 80,
      hitMilestones: [25, 50, 75],
    });
    expect(home.route.next).toMatchObject({ id: "r2", name: "Kaveri Super Mart", status: "NEXT", timeLabel: "11:00" });
    expect(home.route.stops[0]).toMatchObject({ id: "r1", status: "DONE", timeLabel: "09:30" });
    expect(home.route).toMatchObject({ planned: 2, done: 1, remaining: 1, coveragePct: 50 });
    expect(home.attendance).toMatchObject({
      punchedIn: true,
      activeVisit: { id: "v1", retailerId: "r1" },
    });
    expect(home.badges.notifications).toBe(3);
  });

  it("marks the first unvisited outlet as NEXT when nobody has been seen", () => {
    const home = buildSalesHome({
      staff,
      retailers,
      visitsToday: [],
      todaySales: 0,
      weekSales: 0,
    });
    expect(home.route.next).toMatchObject({ id: "r1", status: "NEXT" });
    expect(home.route.stops[1].status).toBe("PLANNED");
    expect(home.attendance.punchedIn).toBe(false);
  });

  it("keeps week windows on UTC Monday and clamps progress", () => {
    const wednesday = new Date("2026-09-02T10:00:00.000Z");
    expect(startOfUtcDay(wednesday).toISOString()).toBe("2026-09-02T00:00:00.000Z");
    expect(startOfUtcWeek(wednesday).toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(percentOfTarget(80_000, FIELD_DAILY_TARGET)).toBe(100);
    expect(percentOfTarget(0, FIELD_DAILY_TARGET)).toBe(0);
  });
});
