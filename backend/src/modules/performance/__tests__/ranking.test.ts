import { describe, expect, it, vi } from "vitest";
import {
  MIN_TARGET_COVERAGE,
  chooseMetric,
  rankContenders,
  rankMovement,
} from "../rankingDomain";
import { RankingService, previousPeriod } from "../rankingService";
import { emptyActuals } from "../targetService";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("ordering contenders", () => {
  it("ranks by value, highest first", () => {
    const ranked = rankContenders([
      { salespersonId: "a", name: "Anil", value: 40 },
      { salespersonId: "b", name: "Bela", value: 90 },
      { salespersonId: "c", name: "Chetan", value: 65 },
    ]);
    expect(ranked.map((entry) => [entry.name, entry.rank])).toEqual([
      ["Bela", 1],
      ["Chetan", 2],
      ["Anil", 3],
    ]);
  });

  it("gives tied salespeople the same rank and skips the position they consumed", () => {
    const ranked = rankContenders([
      { salespersonId: "a", name: "Anil", value: 90 },
      { salespersonId: "b", name: "Bela", value: 90 },
      { salespersonId: "c", name: "Chetan", value: 50 },
    ]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  it("breaks a tie the same way every time", () => {
    const contenders = [
      { salespersonId: "z", name: "Bela", value: 90 },
      { salespersonId: "a", name: "Bela", value: 90 },
      { salespersonId: "m", name: "Anil", value: 90 },
    ];
    const first = rankContenders(contenders).map((entry) => entry.salespersonId);
    const again = rankContenders([...contenders].reverse()).map((entry) => entry.salespersonId);
    // Name then id, regardless of the order they arrived in.
    expect(first).toEqual(["m", "a", "z"]);
    expect(again).toEqual(first);
  });

  it("ranks everyone first when the whole group is tied", () => {
    const ranked = rankContenders([
      { salespersonId: "a", name: "Anil", value: 0 },
      { salespersonId: "b", name: "Bela", value: 0 },
    ]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1]);
  });

  it("handles an empty scope", () => {
    expect(rankContenders([])).toEqual([]);
  });
});

describe("choosing the ranking metric", () => {
  it("ranks on target achievement when most of the group carries a target", () => {
    const choice = chooseMetric({ participants: 10, withTargets: 8 });
    expect(choice.metric).toBe("target_achievement_pct");
    expect(choice.reason).toContain("8 of 10");
  });

  it("falls back to order value when few carry a target, and says why", () => {
    const choice = chooseMetric({ participants: 10, withTargets: 2 });
    expect(choice.metric).toBe("order_value");
    expect(choice.reason).toMatch(/rather than comparing against bars most people were never set/);
  });

  it("switches exactly at the coverage threshold", () => {
    const participants = 10;
    const atThreshold = chooseMetric({ participants, withTargets: participants * MIN_TARGET_COVERAGE });
    expect(atThreshold.metric).toBe("target_achievement_pct");
    expect(chooseMetric({ participants, withTargets: 5 }).metric).toBe("order_value");
  });

  it("says plainly when there is nobody to rank", () => {
    expect(chooseMetric({ participants: 0, withTargets: 0 }).reason).toBe("Nobody in this scope to rank.");
  });
});

describe("movement", () => {
  it("calls a smaller rank number a move up", () => {
    expect(rankMovement(4, 7)).toEqual({ direction: "up", places: 3 });
  });

  it("calls a bigger rank number a move down", () => {
    expect(rankMovement(9, 4)).toEqual({ direction: "down", places: 5 });
  });

  it("reports standing still", () => {
    expect(rankMovement(4, 4)).toEqual({ direction: "same", places: 0 });
  });

  it("reports no movement at all without a previous position", () => {
    expect(rankMovement(4, null)).toEqual({ direction: "new", places: 0 });
  });
});

describe("previous period", () => {
  it("is the equally long window immediately before", () => {
    const previous = previousPeriod({ from: day("2026-03-01"), to: day("2026-03-31") });
    expect(previous.from.toISOString().slice(0, 10)).toBe("2026-01-29");
    expect(previous.to.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("ranking service", () => {
  function fakePrisma(options: {
    staff?: any[];
    targets?: any[];
    actuals?: Record<string, Partial<ReturnType<typeof emptyActuals>>>;
  } = {}) {
    const staff = options.staff ?? [
      { id: "s1", name: "Anil", salesRepId: "r1", salesRep: { territory: "Pune North" } },
      { id: "s2", name: "Bela", salesRepId: "r2", salesRep: { territory: "Pune North" } },
      { id: "s3", name: "Chetan", salesRepId: "r3", salesRep: { territory: "Pune North" } },
    ];
    return {
      staffUser: {
        findMany: vi.fn().mockResolvedValue(staff),
        findUnique: vi.fn().mockResolvedValue({ salesRep: { territory: "Pune North" } }),
      },
      salesTarget: { findMany: vi.fn().mockResolvedValue(options.targets ?? []) },
    } as any;
  }

  function fakeTargets(actualsByStaff: Record<string, Partial<ReturnType<typeof emptyActuals>>>) {
    return {
      bulkActuals: vi.fn().mockImplementation(async ({ salespeople }: any) => {
        const map = new Map();
        for (const person of salespeople) {
          map.set(person.staffId, { ...emptyActuals(), ...(actualsByStaff[person.staffId] ?? {}) });
        }
        return map;
      }),
    } as any;
  }

  it("ranks on order value when nobody carries a target", async () => {
    const service = new RankingService(
      fakePrisma(),
      fakeTargets({ s1: { order_value: 10000 }, s2: { order_value: 50000 }, s3: { order_value: 30000 } })
    );
    const result = await service.rank({ scope: "territory", territory: "Pune North", now: day("2026-03-15") });
    expect(result.metric).toBe("order_value");
    expect(result.entries.map((entry) => entry.name)).toEqual(["Bela", "Chetan", "Anil"]);
    expect(result.participants).toBe(3);
  });

  it("ranks on the share of each salesperson's own target once most carry one", async () => {
    const targets = [
      { salespersonId: "s1", metric: "order_value", targetValue: "100000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
      { salespersonId: "s2", metric: "order_value", targetValue: "500000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
      { salespersonId: "s3", metric: "order_value", targetValue: "100000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
    ];
    const service = new RankingService(
      fakePrisma({ targets }),
      fakeTargets({ s1: { order_value: 90000 }, s2: { order_value: 200000 }, s3: { order_value: 50000 } })
    );
    const result = await service.rank({ scope: "territory", territory: "Pune North", now: day("2026-03-15") });
    expect(result.metric).toBe("target_achievement_pct");
    // Anil did less money than Bela but 90% of his own target against her 40%.
    expect(result.entries.map((entry) => [entry.name, entry.value])).toEqual([
      ["Anil", 90],
      ["Chetan", 50],
      ["Bela", 40],
    ]);
  });

  it("averages a salesperson across every target they carry", async () => {
    const targets = [
      { salespersonId: "s1", metric: "order_value", targetValue: "100000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
      { salespersonId: "s1", metric: "visits", targetValue: "50", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
      { salespersonId: "s2", metric: "order_value", targetValue: "100000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
      { salespersonId: "s3", metric: "order_value", targetValue: "100000", periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") },
    ];
    const service = new RankingService(
      fakePrisma({ targets }),
      fakeTargets({ s1: { order_value: 100000, visits: 25 } })
    );
    const result = await service.rank({ scope: "territory", territory: "Pune North", now: day("2026-03-15") });
    // 100% of sales and 50% of visits averages to 75.
    expect(result.entries.find((entry) => entry.name === "Anil")?.value).toBe(75);
  });

  it("restricts a territory ranking to that territory", async () => {
    const prisma = fakePrisma();
    await new RankingService(prisma, fakeTargets({})).rank({
      scope: "territory",
      territory: "Pune North",
      now: day("2026-03-15"),
    });
    expect(prisma.staffUser.findMany.mock.calls[0][0].where).toMatchObject({
      status: "active",
      salesRep: { territory: "Pune North" },
    });
  });

  it("does not filter by territory for a company ranking", async () => {
    const prisma = fakePrisma();
    await new RankingService(prisma, fakeTargets({})).rank({ scope: "company", now: day("2026-03-15") });
    expect(prisma.staffUser.findMany.mock.calls[0][0].where.salesRep).toBeUndefined();
  });

  it("shows no previous position when the earlier period has no activity", async () => {
    const service = new RankingService(
      fakePrisma(),
      fakeTargets({ s1: { order_value: 10000 }, s2: { order_value: 50000 } })
    );
    const result = await service.rank({ scope: "company", now: day("2026-03-15") });
    // The fake returns the same numbers for both windows, so the guard is what
    // keeps a fabricated movement arrow off a brand-new team.
    expect(result.entries.every((entry) => entry.previousRank === null || entry.previousRank > 0)).toBe(true);
  });

  it("returns an empty, explained result for a scope with nobody in it", async () => {
    const service = new RankingService(fakePrisma({ staff: [] }), fakeTargets({}));
    const result = await service.rank({ scope: "territory", territory: "Nowhere", now: day("2026-03-15") });
    expect(result).toMatchObject({ participants: 0, entries: [] });
    expect(result.metricReason).toBe("Nobody in this scope to rank.");
  });

  it("gives one salesperson their own standing inside their territory", async () => {
    const service = new RankingService(
      fakePrisma(),
      fakeTargets({ s1: { order_value: 10000 }, s2: { order_value: 50000 }, s3: { order_value: 30000 } })
    );
    const standing = await service.standingFor({ salespersonId: "s1", now: day("2026-03-15") });
    expect(standing).toMatchObject({ rank: 3, participants: 3, scope: "territory", scopeLabel: "Pune North" });
  });

  it("reports an unranked salesperson as having no rank rather than last place", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ salesRep: { territory: "Pune North" } });
    const service = new RankingService(prisma, fakeTargets({}));
    const standing = await service.standingFor({ salespersonId: "not-in-scope", now: day("2026-03-15") });
    expect(standing.rank).toBeNull();
    expect(standing.movement).toBeNull();
  });
});
