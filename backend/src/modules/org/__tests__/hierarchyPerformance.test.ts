import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HierarchyService } from "../hierarchyService";
import { TargetService } from "../../performance/targetService";
import { OpportunityService } from "../../intelligence/opportunityService";
import { SalesLeaderService } from "../../readmodels/salesLeaderService";

/**
 * A synthetic organisation at the scale the business expects:
 *
 *   1 at the top → 5 → 25 → 300 salespeople, owning 20 000 retailers.
 *
 * The point is not how fast it runs on this laptop — that measures the laptop.
 * The point is that the *number of queries* stays flat as the team grows, so a
 * national head's dashboard is not 300 round trips. Wall-clock is reported for
 * information but never asserted on.
 *
 * This fixture is built and destroyed inside the test. It is deliberately not
 * part of the seed: nobody should find 20 000 fake stores in a real database.
 */

const SHAPE = { national: 1, regional: 5, areaPerRegional: 5, sellersPerArea: 12, retailers: 20_000 };
const run = randomUUID().slice(0, 8);

// A separate client so query logging does not affect the shared one.
const counted = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
let queries = 0;
(counted as any).$on("query", () => {
  queries += 1;
});

function countingRun<T>(work: () => Promise<T>): Promise<{ result: T; queries: number }> {
  queries = 0;
  return work().then((result) => ({ result, queries }));
}

const hierarchy = new HierarchyService(counted);
const targets = new TargetService(counted);
const opportunities = new OpportunityService(counted);
const salesLeader = new SalesLeaderService(counted);

const tierId = randomUUID();
const ids = { national: randomUUID(), regional: [] as string[], area: [] as string[], sellers: [] as string[] };
const repIds: string[] = [];
const retailerIds: string[] = [];

beforeAll(async () => {
  const role = await counted.role.findFirstOrThrow({ where: { name: "salesperson" } });
  await counted.tier.create({ data: { id: tierId, name: `Perf tier ${run}` } });

  let seq = 0;
  const phone = () => `9${String(seq++).padStart(9, "0")}${run}`.slice(0, 14);

  const staffRows: any[] = [{ id: ids.national, name: "Perf National", managerId: null }];
  for (let r = 0; r < SHAPE.regional; r += 1) {
    const id = randomUUID();
    ids.regional.push(id);
    staffRows.push({ id, name: `Perf Regional ${r}`, managerId: ids.national });
  }
  for (const regionalId of ids.regional) {
    for (let a = 0; a < SHAPE.areaPerRegional; a += 1) {
      const id = randomUUID();
      ids.area.push(id);
      staffRows.push({ id, name: `Perf Area ${ids.area.length}`, managerId: regionalId });
    }
  }
  for (const areaId of ids.area) {
    for (let s = 0; s < SHAPE.sellersPerArea; s += 1) {
      const id = randomUUID();
      const repId = randomUUID();
      ids.sellers.push(id);
      repIds.push(repId);
      staffRows.push({ id, name: `Perf Seller ${ids.sellers.length}`, managerId: areaId, salesRepId: repId });
    }
  }

  await counted.salesRep.createMany({
    data: repIds.map((id, index) => ({ id, name: `Perf Rep ${index}`, phone: `8${String(index).padStart(8, "0")}` })),
  });
  await counted.staffUser.createMany({
    data: staffRows.map((row, index) => ({
      ...row,
      phone: phone(),
      email: `perf-${index}-${run}@test.invalid`,
    })),
  });
  await counted.staffRole.createMany({
    data: staffRows.map((row) => ({ staffId: row.id, roleId: role.id })),
  });

  for (let i = 0; i < SHAPE.retailers; i += 1) {
    retailerIds.push(randomUUID());
  }
  const CHUNK = 2_000;
  for (let offset = 0; offset < retailerIds.length; offset += CHUNK) {
    await counted.retailer.createMany({
      data: retailerIds.slice(offset, offset + CHUNK).map((id, index) => {
        const absolute = offset + index;
        return {
          id,
          name: `Perf Store ${absolute}`,
          shopAddress: `Perf address ${absolute}`,
          phone: `7${String(absolute).padStart(8, "0")}`,
          tierId,
          status: "active" as const,
          salesRepId: repIds[absolute % repIds.length],
        };
      }),
    });
  }
}, 180_000);

afterAll(async () => {
  const staffIds = [ids.national, ...ids.regional, ...ids.area, ...ids.sellers];
  await counted.retailer.deleteMany({ where: { id: { in: retailerIds } } });
  await counted.staffRole.deleteMany({ where: { staffId: { in: staffIds } } });
  await counted.staffUser.updateMany({ where: { id: { in: staffIds } }, data: { managerId: null } });
  await counted.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  await counted.salesRep.deleteMany({ where: { id: { in: repIds } } });
  await counted.tier.delete({ where: { id: tierId } });
  await counted.$disconnect();
}, 180_000);

describe("resolving a large tree", () => {
  it("finds all 330 reports of the top of the tree in a single query", async () => {
    const started = Date.now();
    const { result, queries: used } = await countingRun(() => hierarchy.getAllReports(ids.national));
    expect(result).toHaveLength(SHAPE.regional + ids.area.length + ids.sellers.length);
    expect(used).toBe(1);
    console.log(`getAllReports(330): ${used} query, ${Date.now() - started}ms`);
  });

  it("costs the same one query for a first-line manager as for the national head", async () => {
    const { queries: wide } = await countingRun(() => hierarchy.getAllReports(ids.national));
    const { queries: narrow } = await countingRun(() => hierarchy.getAllReports(ids.area[0]));
    expect(wide).toBe(narrow);
  });

  it("walks a four-level chain in one query", async () => {
    const { result, queries: used } = await countingRun(() =>
      hierarchy.getManagementChain(ids.sellers[0])
    );
    expect(result).toHaveLength(3);
    expect(used).toBe(1);
  });

  it("derives 20 000 retailers from the tree in three queries", async () => {
    const started = Date.now();
    const { result, queries: used } = await countingRun(() =>
      hierarchy.getManagerTeamRetailers(ids.national)
    );
    expect(result).toHaveLength(SHAPE.retailers);
    // tree + staff→rep + retailers. Not one per salesperson, and not one per store.
    expect(used).toBe(3);
    console.log(`getManagerTeamRetailers(20000): ${used} queries, ${Date.now() - started}ms`);
  });
});

describe("preserving the bounded reads the dashboards depend on", () => {
  it("measures a 300-person team's actuals in a fixed number of queries", async () => {
    const salespeople = ids.sellers.map((staffId, index) => ({
      staffId,
      name: `Perf Seller ${index}`,
      salesRepId: repIds[index],
    }));
    const period = { from: new Date("2026-03-01"), to: new Date("2026-03-31") };

    const { queries: many } = await countingRun(() => targets.bulkActuals({ salespeople, period }));
    const { queries: few } = await countingRun(() =>
      targets.bulkActuals({ salespeople: salespeople.slice(0, 2), period })
    );
    // Team size changes the rows scanned, never the number of round trips.
    expect(many).toBe(few);
    console.log(`bulkActuals: ${many} queries for 300 people, ${few} for 2`);
  });

  it("loads a whole manager dashboard in a fixed number of queries", async () => {
    // The end-to-end read a national head actually triggers: staff, targets,
    // attendance, calendar, ranking, beat progress and recommended actions.
    // This is the number that regresses first if anything reintroduces a loop.
    const period = { from: new Date("2026-03-01"), to: new Date("2026-03-31") };
    const started = Date.now();
    const { queries: many } = await countingRun(() =>
      salesLeader.load({ scopeStaffIds: ids.sellers, managerStaffId: ids.national, period })
    );
    const { queries: few } = await countingRun(() =>
      salesLeader.load({ scopeStaffIds: ids.sellers.slice(0, 2), managerStaffId: ids.national, period })
    );
    expect(many).toBe(few);
    console.log(`salesLeader.load: ${many} queries for 300 people, ${few} for 2, ${Date.now() - started}ms`);
  });

  it("aggregates opportunities across the whole tree in a fixed number of queries", async () => {
    const { queries: many } = await countingRun(() =>
      opportunities.forTeam({ staffIds: ids.sellers, limit: 20 })
    );
    const { queries: few } = await countingRun(() =>
      opportunities.forTeam({ staffIds: ids.sellers.slice(0, 2), limit: 20 })
    );
    expect(many).toBe(few);
    console.log(`opportunities.forTeam: ${many} queries for 300 people, ${few} for 2`);
  });
});
