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
      routeProgressForDate: vi.fn().mockImplementation(async (staffIds: string[]) => {
        const progress = new Map<string, any>();
        for (const staffId of staffIds) {
          const route = options.routes?.[staffId];
          if (route) progress.set(staffId, route.progress);
        }
        return progress;
      }),
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
        { salespersonId: "s1", scope: "PERSONAL", metric: "order_value", targetValue: "300000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
        { salespersonId: "s2", scope: "PERSONAL", metric: "order_value", targetValue: "300000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
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
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });

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
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    // 20 of 31 days elapsed, ₹3,00,000 so far.
    expect(result.team.projection.projected).toBe(465000);
    expect(result.team.projection.label).toBe("Projected at current run rate");
  });

  it("never claims the team will achieve anything", async () => {
    const service = build({ actuals: { s1: { order_value: 200000 } } });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
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
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    expect(result.sellingDays.total).toBe(29);
    expect(result.sellingDays.elapsed).toBe(18);
  });
});

describe("who needs attention", () => {
  it("flags a salesperson projected short of their own target", async () => {
    const service = build({
      actuals: { s1: { order_value: 280000 }, s2: { order_value: 60000 } },
    });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    const bela = result.members.find((member) => member.name === "Bela")!;
    expect(bela.risk.level).toBe("at_risk");
    expect(bela.risk.projectedAchievementPct).toBe(31);
    expect(bela.risk.reasons[0]).toContain("projected at current run rate");
    expect(bela.riskFacts).toEqual([
      { code: "PROJECTED_ACHIEVEMENT", values: { projectedAchievementPct: 31 } },
      { code: "ATTENDANCE_ABSENT", values: { mark: "absent" } },
    ]);
  });

  it("explains a low beat completion as its own reason", async () => {
    const service = build({
      actuals: { s1: { order_value: 60000 } },
      routes: {
        s1: { progress: { completionPct: 40, visited: 2, total: 5 } },
      },
    });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    const anil = result.members.find((member) => member.name === "Anil")!;
    expect(anil.risk.reasons).toContain("Today's beat is 40% complete (2 of 5 stops).");
    expect(anil.route).toEqual({ completionPct: 40, visited: 2, total: 5 });
    expect(anil.riskFacts).toContainEqual({
      code: "ROUTE_PROGRESS",
      values: { completionPct: 40, visited: 2, total: 5 },
    });
  });

  it("names absence as a reason", async () => {
    const service = build({ actuals: { s2: { order_value: 10000 } } });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    const bela = result.members.find((member) => member.name === "Bela")!;
    expect(bela.risk.reasons).toContain("Not marked present today.");
  });

  it("leaves a salesperson on pace alone", async () => {
    const service = build({ actuals: { s1: { order_value: 400000 }, s2: { order_value: 400000 } } });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    expect(result.members.every((member) => member.risk.level === "on_track")).toBe(true);
  });
});

describe("recommended actions", () => {
  it("tells the manager who to call, and why", async () => {
    const service = build({ actuals: { s1: { order_value: 280000 }, s2: { order_value: 60000 } } });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    const coach = result.recommendedActions.find((action) => action.type === "COACH_AT_RISK")!;
    expect(coach.action).toBe("Call Bela");
    expect(coach.why).toContain("projected at current run rate");
    expect(coach.details).toEqual({
      actionCode: "COACH_AT_RISK",
      actionValues: { salespersonName: "Bela" },
      reason: { code: "PROJECTED_ACHIEVEMENT", values: { projectedAchievementPct: 31 } },
    });
  });

  it("reuses the field engine so a suggestion names the store", async () => {
    const service = build({
      actuals: { s1: { order_value: 400000 }, s2: { order_value: 60000 } },
      triggers: [
        {
          type: "HIGH_VALUE_RETAILER_MISSED",
          retailerName: "Sharma Stores",
          why: "Usually orders every 12 days, based on 5 recent orders. It has been 19 days.",
          priority: 80,
          facts: {
            code: "HIGH_VALUE_RETAILER_MISSED",
            usualOrderCycleDays: 12,
            daysSinceLastOrder: 19,
            recentOrderCount: 5,
            typicalOrderValue: 22400,
          },
        },
      ],
    });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    const review = result.recommendedActions.find((action) =>
      action.type.startsWith("REVIEW_")
    )!;
    expect(review.action).toContain("Sharma Stores");
    expect(review.why).toContain("Usually orders every 12 days");
    expect(review.details).toEqual({
      actionCode: "HIGH_VALUE_RETAILER_MISSED",
      actionValues: { salespersonName: "Bela", retailerName: "Sharma Stores" },
      reason: {
        code: "HIGH_VALUE_RETAILER_MISSED",
        usualOrderCycleDays: 12,
        daysSinceLastOrder: 19,
        recentOrderCount: 5,
        typicalOrderValue: 22400,
      },
    });
  });

  it("gives every recommendation a reason", async () => {
    const service = build({ actuals: { s2: { order_value: 10000 } } });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    expect(result.recommendedActions.length).toBeGreaterThan(0);
    for (const action of result.recommendedActions) {
      expect(action.why.length).toBeGreaterThan(10);
    }
  });

  it("stays short enough to act on", async () => {
    const service = build({ actuals: { s1: { order_value: 1 }, s2: { order_value: 1 } } });
    const result = await service.load({ scopeStaffIds: ["s1", "s2"], now: NOW });
    expect(result.recommendedActions.length).toBeLessThanOrEqual(6);
  });
});

describe("an empty team", () => {
  it("returns a usable, honest shape", async () => {
    const service = build({}, []);
    const result = await service.load({ scopeStaffIds: [], now: NOW });
    expect(result.members).toEqual([]);
    expect(result.team.salespeople).toBe(0);
    expect(result.team.projection.projected).toBeNull();
    expect(result.recommendedActions).toEqual([]);
  });
});

describe("scope", () => {
  it("restricts the team to the caller's reporting tree", async () => {
    const prisma = fakePrisma();
    const c = collaborators();
    await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      scopeStaffIds: ["s1", "s2"],
      now: NOW,
    });
    expect(prisma.staffUser.findMany.mock.calls[0][0].where).toMatchObject({
      id: { in: ["s1", "s2"] },
    });
    expect(c.ranking.rank.mock.calls[0][0].scope).toBe("team");
  });

  it("covers the company for an org-wide reader", async () => {
    const prisma = fakePrisma();
    const c = collaborators();
    await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      now: NOW,
    });
    expect(prisma.staffUser.findMany.mock.calls[0][0].where.id).toBeUndefined();
    expect(c.ranking.rank.mock.calls[0][0].scope).toBe("company");
  });

  it("reads the whole team's beat progress in one query", async () => {
    const prisma = fakePrisma();
    const c = collaborators();
    await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      scopeStaffIds: ["s1", "s2"],
      now: NOW,
    });
    expect(c.routes.routeProgressForDate).toHaveBeenCalledTimes(1);
    expect(c.routes.routeProgressForDate.mock.calls[0][0]).toEqual(["s1", "s2"]);
  });

  it("scopes attendance to the same tree rather than the whole company", async () => {
    const prisma = fakePrisma();
    const c = collaborators();
    await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      scopeStaffIds: ["s1", "s2"],
      now: NOW,
    });
    expect(c.attendance.teamAttendance.mock.calls[0][1]).toEqual(["s1", "s2"]);
  });
});

describe("team targets", () => {
  it("excludes only the requesting leader and counts a subordinate selling leader once", async () => {
    const prisma = fakePrisma([
      { id: "m1", name: "Deepak", salesRepId: "rm", salesRep: { territory: "North" } },
      { id: "s1", name: "Leader Report", salesRepId: "r1", salesRep: { territory: "North" } },
      { id: "s2", name: "Nested Report", salesRepId: "r2", salesRep: { territory: "North" } },
    ]);
    prisma.salesTarget.findMany.mockResolvedValue([
      { salespersonId: "m1", scope: "PERSONAL", metric: "order_value", targetValue: "100" },
      { salespersonId: "m1", scope: "TEAM", metric: "order_value", targetValue: "4000" },
      { salespersonId: "s1", scope: "PERSONAL", metric: "order_value", targetValue: "200" },
      { salespersonId: "s1", scope: "TEAM", metric: "order_value", targetValue: "9999" },
      { salespersonId: "s2", scope: "PERSONAL", metric: "order_value", targetValue: "300" },
    ].map((target) => ({ ...target, periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") })));
    const c = collaborators({ actuals: {
      m1: { order_value: 1000 }, s1: { order_value: 2000 }, s2: { order_value: 3000 },
    } });
    const result = await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      scopeStaffIds: ["m1", "s1", "s2"], managerStaffId: "m1", now: NOW,
    });
    expect(result.members.map((member) => member.salespersonId)).toEqual(["s1", "s2"]);
    expect(result.team).toMatchObject({ salespeople: 2, actual: 5000, target: 4000 });
    expect(result.targets).toMatchObject({ assigned: 4000, rollup: 500 });
    expect(c.targets.bulkActuals.mock.calls[0][0].salespeople.map((person: any) => person.staffId)).toEqual(["s1", "s2"]);
    expect(c.attendance.teamAttendance.mock.calls[0][1]).toEqual(["s1", "s2"]);
  });

  it("distinguishes a configured zero TEAM target from no assigned target", async () => {
    const prisma = fakePrisma([]);
    prisma.salesTarget.findMany.mockResolvedValue([{ salespersonId: "m1", scope: "TEAM", metric: "order_value", targetValue: "0" }]);
    const c = collaborators();
    const result = await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      scopeStaffIds: [], managerStaffId: "m1", now: NOW,
    });
    expect(result.targets.assigned).toBe(0);
    expect(result.targets.rollupConfigured).toBe(false);
    expect(result.team.target).toBe(0);
  });

  it("separates the sum of child targets from a target set on the manager", async () => {
    const prisma = fakePrisma();
    prisma.salesTarget.findMany = vi.fn().mockResolvedValue([
      { salespersonId: "s1", scope: "PERSONAL", metric: "order_value", targetValue: "300000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
      { salespersonId: "s2", scope: "PERSONAL", metric: "order_value", targetValue: "300000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
      // The manager was asked for more than has been cascaded downward.
      { salespersonId: "m1", scope: "TEAM", metric: "order_value", targetValue: "800000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
    ]);
    const c = collaborators();
    const result = await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      scopeStaffIds: ["s1", "s2"],
      managerStaffId: "m1",
      now: NOW,
    });
    expect(result.targets.rollup).toBe(600000);
    expect(result.targets.assigned).toBe(800000);
    expect(result.targets.uncascaded).toBe(200000);
    // Progress is measured against the commitment, not against the rollup.
    expect(result.team.target).toBe(800000);
    expect(prisma.salesTarget.findMany.mock.calls[0][0].where.salespersonId.in).toEqual([
      "s1",
      "s2",
      "m1",
    ]);
  });

  it("keeps the manager's assigned target when there are no active reports", async () => {
    const prisma = fakePrisma([]);
    prisma.salesTarget.findMany = vi.fn().mockResolvedValue([
      {
        salespersonId: "m1",
        scope: "TEAM",
        metric: "order_value",
        targetValue: "800000",
        periodStart: day("2026-03-01"),
        periodEnd: day("2026-03-31"),
      },
    ]);
    const c = collaborators();
    const result = await new SalesLeaderService(
      prisma,
      c.targets,
      c.ranking,
      c.opportunities,
      c.attendance,
      c.routes
    ).load({ scopeStaffIds: [], managerStaffId: "m1", now: NOW });

    expect(prisma.salesTarget.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.salesTarget.findMany.mock.calls[0][0].where.salespersonId.in).toEqual(["m1"]);
    expect(result.targets).toMatchObject({ assigned: 800000, rollup: 0, uncascaded: 800000 });
    expect(result.team).toMatchObject({ salespeople: 0, target: 800000, actual: 0 });
  });

  it("does not duplicate the manager in the target query when already in the scoped rows", async () => {
    const prisma = fakePrisma([
      { id: "s1", name: "Anil", salesRepId: "r1", salesRep: { territory: "Pune North" } },
      { id: "m1", name: "Manager", salesRepId: "rm", salesRep: { territory: "Pune North" } },
    ]);
    const c = collaborators();
    await new SalesLeaderService(
      prisma,
      c.targets,
      c.ranking,
      c.opportunities,
      c.attendance,
      c.routes
    ).load({ scopeStaffIds: ["s1", "m1"], managerStaffId: "m1", now: NOW });

    expect(prisma.salesTarget.findMany.mock.calls[0][0].where.salespersonId.in).toEqual([
      "s1",
      "m1",
    ]);
  });

  it("falls back to the rollup when the manager has no target of their own", async () => {
    const prisma = fakePrisma();
    const c = collaborators();
    const result = await new SalesLeaderService(prisma, c.targets, c.ranking, c.opportunities, c.attendance, c.routes).load({
      scopeStaffIds: ["s1", "s2"],
      managerStaffId: "m1",
      now: NOW,
    });
    expect(result.targets.assigned).toBeNull();
    expect(result.targets.uncascaded).toBeNull();
    expect(result.team.target).toBe(result.targets.rollup);
  });
});
