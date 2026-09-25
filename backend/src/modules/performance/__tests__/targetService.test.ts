import { describe, expect, it, vi } from "vitest";
import { TargetService, currentMonth, emptyActuals } from "../targetService";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function fakePrisma(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    staffUser: { findUnique: vi.fn().mockResolvedValue({ salesRepId: "rep-1" }) },
    order: { aggregate: vi.fn().mockResolvedValue({ _sum: { orderTotal: null }, _count: { _all: 0 } }) },
    orderItem: { count: vi.fn().mockResolvedValue(0) },
    salesVisit: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    collectionSubmission: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
    retailer: { count: vi.fn().mockResolvedValue(0) },
    salesTarget: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
  return db;
}

const PERIOD = { from: day("2026-03-01"), to: day("2026-03-31") };

describe("counting what actually happened", () => {
  it("derives every metric from canonical rows", async () => {
    const prisma = fakePrisma({
      order: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { orderTotal: "78400" }, _count: { _all: 6 } }),
      },
      orderItem: { count: vi.fn().mockResolvedValue(32) },
      salesVisit: {
        findMany: vi.fn().mockResolvedValue([
          { retailerId: "r1", outcome: "order_placed", activities: [] },
          { retailerId: "r2", outcome: "no_order", activities: [{ type: "collection_completed" }] },
          { retailerId: "r3", outcome: "no_order", activities: [{ type: "stock_check" }] },
        ]),
        count: vi.fn().mockResolvedValue(9),
      },
      collectionSubmission: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: "21000" } }) },
      retailer: { count: vi.fn().mockResolvedValue(2) },
    });

    const actuals = await new TargetService(prisma).actualsFor({
      salespersonId: "staff-1",
      period: PERIOD,
    });

    expect(actuals).toEqual({
      order_value: 78400,
      order_count: 6,
      line_items: 32,
      // r1 (order outcome) and r2 (collection activity); r3 was not productive.
      productive_outlets: 2,
      collection_value: 21000,
      new_customers: 2,
      visits: 9,
    });
  });

  it("counts a store visited twice as one productive outlet", async () => {
    const prisma = fakePrisma({
      salesVisit: {
        findMany: vi.fn().mockResolvedValue([
          { retailerId: "r1", outcome: "order_placed", activities: [] },
          { retailerId: "r1", outcome: "payment_collected", activities: [] },
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
    });
    const actuals = await new TargetService(prisma).actualsFor({
      salespersonId: "staff-1",
      period: PERIOD,
    });
    expect(actuals.productive_outlets).toBe(1);
    expect(actuals.visits).toBe(2);
  });

  it("excludes rejected orders from value, count and lines", async () => {
    const prisma = fakePrisma();
    await new TargetService(prisma).actualsFor({ salespersonId: "staff-1", period: PERIOD });

    const orderWhere = prisma.order.aggregate.mock.calls[0][0].where;
    expect(orderWhere).toMatchObject({
      placedByRepId: "rep-1",
      placedBy: "rep",
      status: { not: "rejected" },
    });
    // Lines are counted through the same order filter, not separately.
    expect(prisma.orderItem.count.mock.calls[0][0].where.order).toEqual(orderWhere);
  });

  it("counts only collections Accounts has confirmed", async () => {
    const prisma = fakePrisma();
    await new TargetService(prisma).actualsFor({ salespersonId: "staff-1", period: PERIOD });
    expect(prisma.collectionSubmission.aggregate.mock.calls[0][0].where).toMatchObject({
      collectorStaffId: "staff-1",
      status: "confirmed",
    });
  });

  it("reports zeros rather than failing for staff with no sales-rep link", async () => {
    const prisma = fakePrisma({ staffUser: { findUnique: vi.fn().mockResolvedValue({ salesRepId: null }) } });
    const actuals = await new TargetService(prisma).actualsFor({
      salespersonId: "staff-1",
      period: PERIOD,
    });
    expect(actuals).toMatchObject({ order_value: 0, order_count: 0, line_items: 0, new_customers: 0 });
    expect(prisma.order.aggregate).not.toHaveBeenCalled();
  });

  it("measures the whole period in one pass, not once per metric", async () => {
    const prisma = fakePrisma();
    await new TargetService(prisma).actualsFor({ salespersonId: "staff-1", period: PERIOD });
    expect(prisma.order.aggregate).toHaveBeenCalledTimes(1);
    expect(prisma.salesVisit.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.collectionSubmission.aggregate).toHaveBeenCalledTimes(1);
  });
});

describe("target progress", () => {
  it("joins a stored target to its counted actual", async () => {
    const prisma = fakePrisma({
      salesTarget: {
        findMany: vi.fn().mockResolvedValue([
          {
            metric: "order_value",
            targetValue: "120000",
            periodStart: day("2026-03-01"),
            periodEnd: day("2026-03-31"),
          },
        ]),
      },
    });
    const progress = await new TargetService(prisma).progressFor({
      salespersonId: "staff-1",
      period: PERIOD,
      now: day("2026-03-20"),
      actuals: { ...emptyActuals(), order_value: 78400 },
    });
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({
      metric: "order_value",
      target: 120000,
      actual: 78400,
      remaining: 41600,
      completionPct: 65,
    });
  });

  it("reports nothing for a metric nobody set a target on", async () => {
    const prisma = fakePrisma();
    const progress = await new TargetService(prisma).progressFor({
      salespersonId: "staff-1",
      period: PERIOD,
      actuals: { ...emptyActuals(), order_value: 500000 },
    });
    expect(progress).toEqual([]);
  });

  it("ignores a stored target whose metric this build does not define", async () => {
    const prisma = fakePrisma({
      salesTarget: {
        findMany: vi.fn().mockResolvedValue([
          { metric: "some_future_metric", targetValue: "10", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
        ]),
      },
    });
    const progress = await new TargetService(prisma).progressFor({
      salespersonId: "staff-1",
      period: PERIOD,
      actuals: emptyActuals(),
    });
    expect(progress).toEqual([]);
  });

  it("grades each target against its own period, not the requested window", async () => {
    const prisma = fakePrisma({
      salesTarget: {
        findMany: vi.fn().mockResolvedValue([
          { metric: "visits", targetValue: "31", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
        ]),
      },
    });
    const [progress] = await new TargetService(prisma).progressFor({
      salespersonId: "staff-1",
      period: PERIOD,
      now: day("2026-03-02"),
      actuals: { ...emptyActuals(), visits: 2 },
    });
    // Two days in, two visits done: on pace rather than behind.
    expect(progress.status).toBe("on_track");
  });
});

describe("the headline target", () => {
  const progress = (metric: string, target: number) =>
    ({ metric, target, actual: 0, unit: "count", label: metric }) as any;

  it("prefers sales value when one is set", () => {
    expect(
      TargetService.headline([progress("visits", 40), progress("order_value", 120000)])?.metric
    ).toBe("order_value");
  });

  it("falls back through the preference order", () => {
    expect(
      TargetService.headline([progress("visits", 40), progress("productive_outlets", 12)])?.metric
    ).toBe("productive_outlets");
  });

  it("skips a target of zero", () => {
    expect(TargetService.headline([progress("order_value", 0), progress("visits", 40)])?.metric).toBe(
      "visits"
    );
  });

  it("has no headline when nothing is set", () => {
    expect(TargetService.headline([])).toBeNull();
  });
});

describe("the default period", () => {
  it("is the calendar month the day falls in", () => {
    const period = currentMonth(day("2026-03-17"));
    expect(period.from.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(period.to.toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("ends on the real last day of a short month", () => {
    expect(currentMonth(day("2026-02-10")).to.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});
