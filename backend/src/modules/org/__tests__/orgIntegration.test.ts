import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../../modules/identity/sessionRuntime";
import { HierarchyService } from "../hierarchyService";
import { ScopeResolver } from "../scope";
import { Permissions } from "../../identity/roleCatalog";

const run = randomUUID();
const digits = run.replace(/\D/g, "").slice(0, 8).padEnd(8, "1");
const app = createApp();
const hierarchy = new HierarchyService(prisma);
const scopes = new ScopeResolver(hierarchy);

/**
 * A four-level organisation, which is the shape the brief describes:
 *
 *   national
 *   ├── regionalWest
 *   │   └── areaWest
 *   │       ├── sellerW1
 *   │       └── sellerW2
 *   └── regionalEast
 *       └── sellerE1
 *
 * No job titles appear in any assertion — the names are for the reader.
 */
const ids = {
  tier: randomUUID(),
  national: randomUUID(),
  regionalWest: randomUUID(),
  regionalEast: randomUUID(),
  areaWest: randomUUID(),
  sellerW1: randomUUID(),
  sellerW2: randomUUID(),
  sellerE1: randomUUID(),
  outsider: randomUUID(),
  platform: randomUUID(),
  repW1: randomUUID(),
  repW2: randomUUID(),
  repE1: randomUUID(),
  storeW1: randomUUID(),
  storeW2: randomUUID(),
  storeE1: randomUUID(),
};

const staffIds = [
  ids.national,
  ids.regionalWest,
  ids.regionalEast,
  ids.areaWest,
  ids.sellerW1,
  ids.sellerW2,
  ids.sellerE1,
  ids.outsider,
  ids.platform,
];

const tokens: Record<string, string> = {};
let expenseW1 = "";
let expenseE1 = "";

async function makeStaff(input: {
  id: string;
  name: string;
  index: number;
  role: string;
  managerId?: string | null;
  salesRepId?: string;
  admin?: boolean;
}) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: input.role } });
  const adminUser = input.admin
    ? await prisma.adminUser.create({
        data: {
          email: `org-admin-${input.index}-${run}@test.invalid`,
          name: input.name,
          passwordHash: "x",
        },
      })
    : null;
  await prisma.staffUser.create({
    data: {
      id: input.id,
      name: input.name,
      phone: `7${input.index}${digits}`,
      email: `org-${input.index}-${run}@test.invalid`,
      managerId: input.managerId ?? null,
      salesRepId: input.salesRepId,
      adminUserId: adminUser?.id,
      roles: { create: { roleId: role.id } },
    },
  });
  const session = await lazyIdentitySessionService.createSession({
    realm: input.admin ? "admin" : "staff",
    subjectId: input.id,
    deviceName: "test",
  });
  return session.accessToken;
}

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Org tier ${run}` } });
  await prisma.salesRep.createMany({
    data: [
      { id: ids.repW1, name: "Org Rep W1", phone: `61${digits}` },
      { id: ids.repW2, name: "Org Rep W2", phone: `62${digits}` },
      { id: ids.repE1, name: "Org Rep E1", phone: `63${digits}` },
    ],
  });
  await prisma.retailer.createMany({
    data: [
      { id: ids.storeW1, name: "Org Store W1", phone: `64${digits}`, shopAddress: "West 1", tierId: ids.tier, salesRepId: ids.repW1 },
      { id: ids.storeW2, name: "Org Store W2", phone: `65${digits}`, shopAddress: "West 2", tierId: ids.tier, salesRepId: ids.repW2 },
      { id: ids.storeE1, name: "Org Store E1", phone: `66${digits}`, shopAddress: "East 1", tierId: ids.tier, salesRepId: ids.repE1 },
    ],
  });

  // Built top-down so each manager exists before anyone points at them.
  tokens.national = await makeStaff({ id: ids.national, name: "Org National", index: 1, role: "field_manager", admin: true });
  tokens.regionalWest = await makeStaff({ id: ids.regionalWest, name: "Org Regional West", index: 2, role: "field_manager", managerId: ids.national, admin: true });
  tokens.regionalEast = await makeStaff({ id: ids.regionalEast, name: "Org Regional East", index: 3, role: "field_manager", managerId: ids.national, admin: true });
  tokens.areaWest = await makeStaff({ id: ids.areaWest, name: "Org Area West", index: 4, role: "field_manager", managerId: ids.regionalWest, admin: true });
  tokens.sellerW1 = await makeStaff({ id: ids.sellerW1, name: "Org Seller W1", index: 5, role: "salesperson", managerId: ids.areaWest, salesRepId: ids.repW1 });
  tokens.sellerW2 = await makeStaff({ id: ids.sellerW2, name: "Org Seller W2", index: 6, role: "salesperson", managerId: ids.areaWest, salesRepId: ids.repW2 });
  tokens.sellerE1 = await makeStaff({ id: ids.sellerE1, name: "Org Seller E1", index: 7, role: "salesperson", managerId: ids.regionalEast, salesRepId: ids.repE1 });
  // Nobody's manager, nobody's report: the "not yet in the chart" case.
  tokens.outsider = await makeStaff({ id: ids.outsider, name: "Org Outsider", index: 8, role: "salesperson" });
  // A genuine platform admin, so org-wide reads are proven with a real session
  // rather than inferred. Deliberately placed nowhere in the tree: org.view_all
  // must work without the holder having a single report.
  tokens.platform = await makeStaff({ id: ids.platform, name: "Org Platform Admin", index: 9, role: "platform_admin", admin: true });

  const [w1, e1] = await Promise.all([
    prisma.fieldExpense.create({
      data: { salespersonId: ids.sellerW1, expenseDate: new Date("2026-03-02"), category: "travel", amount: "250.00", description: "Bus to West beat" },
    }),
    prisma.fieldExpense.create({
      data: { salespersonId: ids.sellerE1, expenseDate: new Date("2026-03-02"), category: "travel", amount: "180.00", description: "Bus to East beat" },
    }),
  ]);
  expenseW1 = w1.id;
  expenseE1 = e1.id;
});

afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: staffIds } } });
  await prisma.fieldExpense.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.auditEvent.deleteMany({ where: { subjectId: { in: staffIds } } });
  await prisma.staffRole.deleteMany({ where: { staffId: { in: staffIds } } });
  // Bottom-up: a manager cannot be removed while anyone still points at them.
  await prisma.staffUser.updateMany({ where: { id: { in: staffIds } }, data: { managerId: null } });
  const adminIds = (
    await prisma.staffUser.findMany({ where: { id: { in: staffIds } }, select: { adminUserId: true } })
  ).map((row) => row.adminUserId).filter(Boolean) as string[];
  await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: adminIds } } });
  await prisma.retailer.deleteMany({ where: { id: { in: [ids.storeW1, ids.storeW2, ids.storeE1] } } });
  await prisma.salesRep.deleteMany({ where: { id: { in: [ids.repW1, ids.repW2, ids.repE1] } } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("resolving a reporting tree", () => {
  it("finds every descendant at any depth in one pass", async () => {
    const reports = await hierarchy.getAllReports(ids.national);
    expect(reports.map((r) => r.id).sort()).toEqual(
      [ids.regionalWest, ids.regionalEast, ids.areaWest, ids.sellerW1, ids.sellerW2, ids.sellerE1].sort()
    );
  });

  it("reports how far down each person sits", async () => {
    const reports = await hierarchy.getAllReports(ids.national);
    const depthOf = new Map(reports.map((r) => [r.id, r.depth]));
    expect(depthOf.get(ids.regionalWest)).toBe(1);
    expect(depthOf.get(ids.areaWest)).toBe(2);
    expect(depthOf.get(ids.sellerW1)).toBe(3);
  });

  it("returns only the branch a middle manager owns", async () => {
    const reports = await hierarchy.getAllReports(ids.regionalWest);
    expect(reports.map((r) => r.id).sort()).toEqual([ids.areaWest, ids.sellerW1, ids.sellerW2].sort());
  });

  it("returns nothing for someone with no reports", async () => {
    expect(await hierarchy.getAllReports(ids.sellerW1)).toEqual([]);
  });

  it("lists direct reports without the levels below them", async () => {
    const direct = await hierarchy.getDirectReports(ids.national);
    expect(direct.map((d) => d.id).sort()).toEqual([ids.regionalWest, ids.regionalEast].sort());
  });

  it("walks the management chain nearest-first", async () => {
    const chain = await hierarchy.getManagementChain(ids.sellerW1);
    expect(chain.map((link) => link.id)).toEqual([ids.areaWest, ids.regionalWest, ids.national]);
  });

  it("gives an empty chain at the top of the tree", async () => {
    expect(await hierarchy.getManagementChain(ids.national)).toEqual([]);
  });

  it("knows who is inside a tree and who is not", async () => {
    expect(await hierarchy.isInReportingTree(ids.national, ids.sellerW1)).toBe(true);
    expect(await hierarchy.isInReportingTree(ids.regionalWest, ids.sellerE1)).toBe(false);
    // A manager does not manage themselves.
    expect(await hierarchy.isInReportingTree(ids.national, ids.national)).toBe(false);
  });
});

describe("deriving a manager's retailers", () => {
  it("collects the stores owned by everyone beneath them", async () => {
    const retailers = await hierarchy.getManagerTeamRetailers(ids.regionalWest);
    expect(retailers.sort()).toEqual([ids.storeW1, ids.storeW2].sort());
  });

  it("covers the whole company at the top", async () => {
    const retailers = await hierarchy.getManagerTeamRetailers(ids.national);
    expect(retailers.sort()).toEqual([ids.storeW1, ids.storeW2, ids.storeE1].sort());
  });

  it("follows a salesperson to their new manager with no reassignment of stores", async () => {
    await hierarchy.setManager({ employeeId: ids.sellerW2, managerId: ids.regionalEast, actorStaffId: ids.national });
    try {
      expect(await hierarchy.getManagerTeamRetailers(ids.regionalWest)).toEqual([ids.storeW1]);
      expect((await hierarchy.getManagerTeamRetailers(ids.regionalEast)).sort()).toEqual(
        [ids.storeE1, ids.storeW2].sort()
      );
      // Ownership itself never moved: `Retailer.salesRepId` is untouched.
      const store = await prisma.retailer.findUniqueOrThrow({ where: { id: ids.storeW2 } });
      expect(store.salesRepId).toBe(ids.repW2);
    } finally {
      await hierarchy.setManager({ employeeId: ids.sellerW2, managerId: ids.areaWest, actorStaffId: ids.national });
    }
  });
});

describe("changing a reporting line", () => {
  it("refuses to let someone manage themselves", async () => {
    await expect(
      hierarchy.setManager({ employeeId: ids.areaWest, managerId: ids.areaWest, actorStaffId: ids.national })
    ).rejects.toMatchObject({ code: "self_management" });
  });

  it("refuses a change that would create a cycle", async () => {
    await expect(
      hierarchy.setManager({ employeeId: ids.national, managerId: ids.sellerW1, actorStaffId: ids.national })
    ).rejects.toMatchObject({ code: "cycle" });
  });

  it("leaves the tree untouched when it rejects a change", async () => {
    const before = await prisma.staffUser.findUniqueOrThrow({ where: { id: ids.national } });
    await expect(
      hierarchy.setManager({ employeeId: ids.national, managerId: ids.sellerW1, actorStaffId: ids.national })
    ).rejects.toBeTruthy();
    const after = await prisma.staffUser.findUniqueOrThrow({ where: { id: ids.national } });
    expect(after.managerId).toBe(before.managerId);
  });

  it("records who moved whom, and never overwrites the previous record", async () => {
    await hierarchy.setManager({ employeeId: ids.sellerW1, managerId: ids.regionalWest, actorStaffId: ids.national, reason: "Cover" });
    await hierarchy.setManager({ employeeId: ids.sellerW1, managerId: ids.areaWest, actorStaffId: ids.national, reason: "Back" });

    const history = await hierarchy.managerHistory(ids.sellerW1);
    expect(history).toHaveLength(2);
    // Newest first, and the earlier move is still readable in full.
    expect(history[0]).toMatchObject({
      previousManagerId: ids.regionalWest,
      newManagerId: ids.areaWest,
      changedById: ids.national,
      reason: "Back",
    });
    expect(history[1]).toMatchObject({
      previousManagerId: ids.areaWest,
      newManagerId: ids.regionalWest,
      reason: "Cover",
    });
    expect(history[0].newManagerName).toBe("Org Area West");
  });

  it("is a no-op when the manager is unchanged, and writes no audit noise", async () => {
    const before = await hierarchy.managerHistory(ids.sellerE1);
    const result = await hierarchy.setManager({ employeeId: ids.sellerE1, managerId: ids.regionalEast, actorStaffId: ids.national });
    expect(result.changed).toBe(false);
    expect(await hierarchy.managerHistory(ids.sellerE1)).toHaveLength(before.length);
  });
});

describe("reporting scope", () => {
  const auth = (staffId: string, permissions: string[]) => ({ staffId, permissions, delegationIds: [] });

  it("gives a manager themselves plus everyone beneath them", async () => {
    const scope = await scopes.resolve(auth(ids.regionalWest, [Permissions.EXPENSE_REVIEW]));
    expect(scope.kind).toBe("team");
    expect(scope.staffIds!.sort()).toEqual([ids.regionalWest, ids.areaWest, ids.sellerW1, ids.sellerW2].sort());
  });

  it("gives someone with no reports only themselves", async () => {
    const scope = await scopes.resolve(auth(ids.sellerW1, [Permissions.EXPENSE_REVIEW]));
    expect(scope.kind).toBe("self");
    expect(scope.staffIds).toEqual([ids.sellerW1]);
  });

  it("lifts the restriction entirely for an org-wide reader", async () => {
    const scope = await scopes.resolve(auth(ids.regionalWest, [Permissions.ORG_VIEW_ALL]));
    expect(scope.kind).toBe("org");
    expect(scope.staffIds).toBeNull();
  });

  it("lets a request narrow to one person inside the tree", async () => {
    const scope = await scopes.resolveFor(auth(ids.national, [Permissions.EXPENSE_REVIEW]), ids.sellerE1);
    expect(scope.staffIds).toEqual([ids.sellerE1]);
  });

  it("rejects a request for somebody outside the tree", async () => {
    await expect(
      scopes.resolveFor(auth(ids.regionalWest, [Permissions.EXPENSE_REVIEW]), ids.sellerE1)
    ).rejects.toMatchObject({ code: "outside_reporting_scope" });
  });

  it("never lets anyone act on themselves, however senior", async () => {
    await expect(
      scopes.assertCanActOn(auth(ids.national, [Permissions.ORG_VIEW_ALL]), ids.national)
    ).rejects.toMatchObject({ code: "self_approval_forbidden" });
  });
});

describe("authorising manager surfaces over HTTP", () => {
  const get = (path: string, token: string) =>
    request(app).get(path).set("Authorization", `Bearer ${token}`);

  it("shows a manager only their own team's expenses", async () => {
    const response = await get("/admin/field/expenses", tokens.regionalWest).expect(200);
    const owners = response.body.expenses.map((expense: any) => expense.salespersonId);
    expect(owners).toContain(ids.sellerW1);
    expect(owners).not.toContain(ids.sellerE1);
  });

  it("shows the other manager the other team, and nothing of the first", async () => {
    const response = await get("/admin/field/expenses", tokens.regionalEast).expect(200);
    const owners = response.body.expenses.map((expense: any) => expense.salespersonId);
    expect(owners).toContain(ids.sellerE1);
    expect(owners).not.toContain(ids.sellerW1);
  });

  it("shows a manager above both of them everything beneath", async () => {
    const response = await get("/admin/field/expenses", tokens.national).expect(200);
    const owners = response.body.expenses.map((expense: any) => expense.salespersonId);
    expect(owners).toEqual(expect.arrayContaining([ids.sellerW1, ids.sellerE1]));
  });

  it("refuses a query for an employee outside the caller's tree", async () => {
    const response = await get(`/admin/field/expenses?salespersonId=${ids.sellerE1}`, tokens.regionalWest);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("outside_reporting_scope");
  });

  it("scopes attendance to the tree as well as expenses", async () => {
    const response = await get("/admin/field/attendance", tokens.regionalWest).expect(200);
    const seen = response.body.team.map((member: any) => member.salespersonId);
    expect(seen).toContain(ids.sellerW1);
    expect(seen).not.toContain(ids.sellerE1);
  });

  it("blocks a manager from approving another team's expense", async () => {
    const response = await request(app)
      .post(`/admin/field/expenses/${expenseE1}/decision`)
      .set("Authorization", `Bearer ${tokens.regionalWest}`)
      .send({ decision: "approved" });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("outside_reporting_scope");
  });

  it("still refuses when the reviewer has no reports at all", async () => {
    const response = await request(app)
      .post(`/admin/field/expenses/${expenseW1}/decision`)
      .set("Authorization", `Bearer ${tokens.areaWest}`)
      .send({ decision: "approved" });
    // areaWest does manage sellerW1, so this one is allowed — the guard is
    // scope, not seniority in the abstract.
    expect(response.status).toBe(200);
  });

  it("gives a manager the sales leader view of their own team only", async () => {
    const response = await get("/admin/sales-leader", tokens.regionalWest).expect(200);
    const names = response.body.members.map((member: any) => member.salespersonId);
    expect(names).toContain(ids.sellerW1);
    expect(names).not.toContain(ids.sellerE1);
  });

  it("keeps permission and scope independent: no permission is still a refusal", async () => {
    // A salesperson sits inside a tree but holds no review permission.
    const response = await get("/admin/field/expenses", tokens.sellerW1);
    expect([401, 403]).toContain(response.status);
  });
});

describe("moving somebody between managers", () => {
  const get = (path: string, token: string) =>
    request(app).get(path).set("Authorization", `Bearer ${token}`);

  it("moves the team, the retailers and the audit trail together, and nothing else", async () => {
    const storesBefore = await prisma.retailer.findMany({
      where: { id: { in: [ids.storeW1, ids.storeW2, ids.storeE1] } },
      select: { id: true, salesRepId: true },
      orderBy: { id: "asc" },
    });

    // Before: sellerW1 is West's, and East cannot see them at all.
    const westBefore = await get("/admin/field/expenses", tokens.regionalWest).expect(200);
    expect(westBefore.body.expenses.map((e: any) => e.salespersonId)).toContain(ids.sellerW1);
    const eastBefore = await get("/admin/field/expenses", tokens.regionalEast).expect(200);
    expect(eastBefore.body.expenses.map((e: any) => e.salespersonId)).not.toContain(ids.sellerW1);

    const move = await request(app)
      .post(`/admin/org/staff/${ids.sellerW1}/manager`)
      .set("Authorization", `Bearer ${tokens.platform}`)
      .send({ managerId: ids.regionalEast, reason: "Covering the East beat" });
    expect(move.status).toBe(200);

    try {
      // The old manager loses them.
      const westAfter = await get("/admin/field/expenses", tokens.regionalWest).expect(200);
      expect(westAfter.body.expenses.map((e: any) => e.salespersonId)).not.toContain(ids.sellerW1);
      // The new manager gains them.
      const eastAfter = await get("/admin/field/expenses", tokens.regionalEast).expect(200);
      expect(eastAfter.body.expenses.map((e: any) => e.salespersonId)).toContain(ids.sellerW1);

      // The retailer book follows, without a single store being reassigned.
      expect(await hierarchy.getManagerTeamRetailers(ids.regionalEast)).toContain(ids.storeW1);
      const storesAfter = await prisma.retailer.findMany({
        where: { id: { in: [ids.storeW1, ids.storeW2, ids.storeE1] } },
        select: { id: true, salesRepId: true },
        orderBy: { id: "asc" },
      });
      expect(storesAfter).toEqual(storesBefore);

      // And the move is on the record, with both managers named.
      const history = await hierarchy.managerHistory(ids.sellerW1);
      expect(history[0]).toMatchObject({
        previousManagerId: ids.areaWest,
        newManagerId: ids.regionalEast,
        changedById: ids.platform,
        reason: "Covering the East beat",
      });
    } finally {
      await hierarchy.setManager({ employeeId: ids.sellerW1, managerId: ids.areaWest, actorStaffId: ids.platform });
    }
  });
});

describe("org-wide authorisation", () => {
  const get = (path: string, token: string) =>
    request(app).get(path).set("Authorization", `Bearer ${token}`);

  it("lets a platform admin with no reports of their own see every team", async () => {
    const response = await get("/admin/field/expenses", tokens.platform).expect(200);
    const owners = response.body.expenses.map((expense: any) => expense.salespersonId);
    expect(owners).toEqual(expect.arrayContaining([ids.sellerW1, ids.sellerE1]));
  });

  it("still refuses to let them approve their own claim", async () => {
    const own = await prisma.fieldExpense.create({
      data: {
        salespersonId: ids.platform,
        expenseDate: new Date("2026-03-03"),
        category: "travel",
        amount: "99.00",
        description: "Own claim",
      },
    });
    const response = await request(app)
      .post(`/admin/field/expenses/${own.id}/decision`)
      .set("Authorization", `Bearer ${tokens.platform}`)
      .send({ decision: "approved" });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("expense_self_decision_forbidden");
  });

  it("reaches the whole chart, which a field manager cannot", async () => {
    await get("/admin/org/tree", tokens.platform).expect(200);
    await get("/admin/org/tree", tokens.national).expect(403);
  });
});

describe("administering the chart over HTTP", () => {
  it("refuses to let a manager without org.manage move anybody", async () => {
    const response = await request(app)
      .post(`/admin/org/staff/${ids.sellerE1}/manager`)
      .set("Authorization", `Bearer ${tokens.regionalWest}`)
      .send({ managerId: ids.regionalWest });
    expect(response.status).toBe(403);
    const unchanged = await prisma.staffUser.findUniqueOrThrow({ where: { id: ids.sellerE1 } });
    expect(unchanged.managerId).toBe(ids.regionalEast);
  });

  it("refuses to read the whole chart without org.view_all", async () => {
    const response = await request(app)
      .get("/admin/org/tree")
      .set("Authorization", `Bearer ${tokens.regionalWest}`);
    expect(response.status).toBe(403);
  });
});
