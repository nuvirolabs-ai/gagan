import { describe, expect, it, vi } from "vitest";
import { SalesLeaderService } from "../salesLeaderService";
import { emptyActuals } from "../../performance/targetService";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const NOW = day("2026-03-20");

function collaborators(options: {
  actuals?: Record<string, Partial<ReturnType<typeof emptyActuals>>>;
  attendance?: any[];
  routes?: Record<string, any>;
  triggers?: any[];
} = {}) {
  return {
    targets: {
      bulkActuals: vi.fn().mockImplementation(async ({ salespeople }: any) => {
        const map = new Map();
        for (const person of salespeople) {
          map.set(person.staffId, { ...emptyActuals(), ...(options.actuals?.[person.staffId] ?? {}) });
        }
        return map;
      }),
    } as any,
    ranking: {
      rank: vi.fn().mockResolvedValue({
        metric: "order_value",
        metricLabel: "Order value",
        metricReason: "because",
        entries: [
          { salespersonId: "s1", name: "Anil", value: 100, rank: 1, previousRank: null },
          { salespersonId: "s2", name: "Bela", value: 50, rank: 2, previousRank: null },
        ],
      }),
    } as any,
    opportunities: {
      forSalesperson: vi.fn().mockResolvedValue({ triggers: options.triggers ?? [], summary: [] }),
    } as any,
    attendance: {
      teamAttendance: vi.fn().mockResolvedValue(
        options.attendance ?? [
          { salespersonId: "s1", mark: "present" },
          { salespersonId: "s2", mark: "absent" },
        ]
      ),
    } as any,
    routes: {
      routeForDate: vi.fn().mockImplementation(async (staffId: string) => options.routes?.[staffId] ?? null),
    } as any,
  };
}

function fakePrisma(staff?: any[]) {
  return {
    staffUser: {
      findMany: vi.fn().mockResolvedValue(
        staff ?? [
          { id: "s1", name: "Anil", salesRepId: "r1", salesRep: { territory: "Pune North" } },
          { id: "s2", name: "Bela", salesRepId: "r2", salesRep: { territory: "Pune North" } },
        ]
      ),
    },
    salesTarget: {
      findMany: vi.fn().mockResolvedValue([
        { salespersonId: "s1", metric: "order_value", targetValue: "300000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
        { salespersonId: "s2", metric: "order_value", targetValue: "300000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
      ]),
    },
    workingCalendar: { findMany: vi.fn().mockResolvedValue([]) },
  } as any;
}

function build(options: Parameters<typeof collaborators>[0] = {}, staff?: any[]) {
  const c = collaborators(options);
  return new SalesLeaderService(
    fakePrisma(staff),
    c.targets,
    c.ranking,
    c.opportunities,
    c.attendance,
    c.routes
  );
}

describe("team totals", () => {
  it("adds up what the team has actually done", async () => {
    const service = build({
      actuals: {
        s1: { order_value: 200000, visits: 40, order_count: 12, collection_value: 50000, new_customers: 2, productive_outlets: 20 },
        s2: { order_value: 100000, visits: 20, order_count: 5, collection_value: 10000, new_customers: 1, productive_outlets: 8 },
      },
    });
    const result = await service.load({ territory: "Pune North", now: NOW });

    expect(result.team).toMatchObject({
      salespeople: 2,
      target: 600000,
      actual: 300000,
      completionPct: 50,
      visits: 60,
      orders: 17,
      collections: 60000,
      newRetailers: 3,
      productiveOutlets: 28,
      present: 1,
    });
  });

  it("projects the period at the current run rate, and labels it", async () => {
    const service = build({ actuals: { s1: { order_value: 200000 }, s2: { order_value: 100000 } } });
    const result = await service.load({ territory: "Pune North", now: NOW });
    // 20 of 31 days elapsed, ₹3,00,000 so far.
    expect(result.team.projection.projected).toBe(465000);
    expect(result.team.projection.label).toBe("Projected at current run rate");
  });

  it("never claims the team will achieve anything", async () => {
    const service = build({ actuals: { s1: { order_value: 200000 } } });
    const result = await service.load({ territory: "Pune North", now: NOW });
    expect(JSON.stringify(result)).not.toMatch(/will achieve|guaranteed|certain to/i);
  });

  it("counts only real selling days when the calendar excludes some", async () => {
    const prisma = fakePrisma();
    prisma.workingCalendar.findMany.mockResolvedValue([
      { date: day("2026-03-07") },
      { date: day("2026-03-14") },
    ]);
    const c = collaborators({ actuals: { s1: { order_value: 200000 } } });
    const service = new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes);
    const result = await service.load({ territory: "Pune North", now: NOW });
    expect(result.sellingDays.total).toBe(29);
    expect(result.sellingDays.elapsed).toBe(18);
  });
});

describe("who needs attention", () => {
  it("flags a salesperson projected short of their own target", async () => {
    const service = build({
      actuals: { s1: { order_value: 280000 }, s2: { order_value: 60000 } },
    });
    const result = await service.load({ territory: "Pune North", now: NOW });
    const bela = result.members.find((member) => member.name === "Bela")!;
    expect(bela.risk.level).toBe("at_risk");
    expect(bela.risk.projectedAchievementPct).toBe(31);
    expect(bela.risk.reasons[0]).toContain("projected at current run rate");
  });

  it("explains a low beat completion as its own reason", async () => {
    const service = build({
      actuals: { s1: { order_value: 60000 } },
      routes: {
        s1: { progress: { completionPct: 40, visited: 2, total: 5 } },
      },
    });
    const result = await service.load({ territory: "Pune North", now: NOW });
    const anil = result.members.find((member) => member.name === "Anil")!;
    expect(anil.risk.reasons).toContain("Today's beat is 40% complete (2 of 5 stops).");
    expect(anil.route).toEqual({ completionPct: 40, visited: 2, total: 5 });
  });

  it("names absence as a reason", async () => {
    const service = build({ actuals: { s2: { order_value: 10000 } } });
    const result = await service.load({ territory: "Pune North", now: NOW });
    const bela = result.members.find((member) => member.name === "Bela")!;
    expect(bela.risk.reasons).toContain("Not marked present today.");
  });

  it("leaves a salesperson on pace alone", async () => {
    const service = build({ actuals: { s1: { order_value: 400000 }, s2: { order_value: 400000 } } });
    const result = await service.load({ territory: "Pune North", now: NOW });
    expect(result.members.every((member) => member.risk.level === "on_track")).toBe(true);
  });
});

describe("recommended actions", () => {
  it("tells the manager who to call, and why", async () => {
    const service = build({ actuals: { s1: { order_value: 280000 }, s2: { order_value: 60000 } } });
    const result = await service.load({ territory: "Pune North", now: NOW });
    const coach = result.recommendedActions.find((action) => action.type === "COACH_AT_RISK")!;
    expect(coach.action).toBe("Call Bela");
    expect(coach.why).toContain("projected at current run rate");
  });

  it("reuses the field engine so a suggestion names the store", async () => {
    const service = build({
      actuals: { s2: { order_value: 60000 } },
      triggers: [
        {
          type: "HIGH_VALUE_RETAILER_MISSED",
          retailerName: "Sharma Stores",
          why: "Usually orders every 12 days, based on 5 recent orders. It has been 19 days.",
          priority: 80,
        },
      ],
    });
    const result = await service.load({ territory: "Pune North", now: NOW });
    const review = result.recommendedActions.find((action) =>
      action.type.startsWith("REVIEW_")
    )!;
    expect(review.action).toContain("Sharma Stores");
    expect(review.why).toContain("Usually orders every 12 days");
  });

  it("gives every recommendation a reason", async () => {
    const service = build({ actuals: { s2: { order_value: 10000 } } });
    const result = await service.load({ territory: "Pune North", now: NOW });
    expect(result.recommendedActions.length).toBeGreaterThan(0);
    for (const action of result.recommendedActions) {
      expect(action.why.length).toBeGreaterThan(10);
    }
  });

  it("stays short enough to act on", async () => {
    const service = build({ actuals: { s1: { order_value: 1 }, s2: { order_value: 1 } } });
    const result = await service.load({ territory: "Pune North", now: NOW });
    expect(result.recommendedActions.length).toBeLessThanOrEqual(6);
  });
});

describe("an empty team", () => {
  it("returns a usable, honest shape", async () => {
    const service = build({}, []);
    const result = await service.load({ territory: "Nowhere", now: NOW });
    expect(result.members).toEqual([]);
    expect(result.team.salespeople).toBe(0);
    expect(result.team.projection.projected).toBeNull();
    expect(result.recommendedActions).toEqual([]);
  });
});

describe("scope", () => {
  it("restricts the team to the territory asked for", async () => {
    const prisma = fakePrisma();
    const c = collaborators();
    await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      territory: "Pune North",
      now: NOW,
    });
    expect(prisma.staffUser.findMany.mock.calls[0][0].where).toMatchObject({
      salesRep: { territory: "Pune North" },
    });
  });

  it("covers the company when no territory is given", async () => {
    const prisma = fakePrisma();
    const c = collaborators();
    await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      now: NOW,
    });
    expect(prisma.staffUser.findMany.mock.calls[0][0].where.salesRep).toBeUndefined();
    expect(c.ranking.rank.mock.calls[0][0].scope).toBe("company");
  });
});
