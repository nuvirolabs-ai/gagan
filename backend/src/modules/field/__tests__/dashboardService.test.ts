import { describe, expect, it, vi } from "vitest";
import { FieldDashboardService } from "../dashboardService";

describe("field dashboard today", () => {
  it("loads the route for the India calendar day after UTC midnight diverges", async () => {
    const routeForDate = vi.fn().mockResolvedValue(null);
    const prisma = { serviceIssue: { findMany: vi.fn().mockResolvedValue([]) } };
    const attendance = {
      openSession: vi.fn().mockResolvedValue(null),
      attendanceHistory: vi.fn().mockResolvedValue([]),
    };
    const dashboard = new FieldDashboardService(
      prisma as any,
      attendance as any,
      { routeForDate } as any,
      { openFollowUps: vi.fn().mockResolvedValue([]) } as any,
      { forSalesperson: vi.fn().mockResolvedValue([]) } as any,
      { state: vi.fn().mockResolvedValue(null) } as any
    );
    vi.spyOn(dashboard, "metricsFor").mockResolvedValue({ orderValue: 0, visits: 0 } as any);
    vi.spyOn(dashboard as any, "targetsFor").mockResolvedValue([]);
    vi.spyOn(dashboard, "pendingCollections").mockResolvedValue({
      retailers: [],
      reviewRetailers: [],
      totalOverdue: 0,
      totalOutstanding: 0,
    });

    await dashboard.today({
      salespersonId: "staff-1",
      now: new Date("2026-09-26T18:34:00.000Z"),
    });

    expect(routeForDate).toHaveBeenCalledWith("staff-1", new Date("2026-09-27T00:00:00.000Z"));
  });
});
