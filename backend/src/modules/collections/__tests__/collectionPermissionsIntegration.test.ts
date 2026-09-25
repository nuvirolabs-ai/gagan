import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { requireAdminIdentity } from "../../../lib/adminAuth";
import { lazyIdentitySessionService } from "../../identity/sessionRuntime";
import { createRequireSession } from "../../identity/sessionAuth";
import { createCollectionRouter } from "../collectionRoutes";

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  otherRetailer: randomUUID(),
  collector: randomUUID(),
  unprivileged: randomUUID(),
  manager: randomUUID(),
  accounts: randomUUID(),
  managerAdmin: randomUUID(),
  accountsAdmin: randomUUID(),
};

const app = express();
app.use(express.json());
app.use("/rep", createCollectionRouter({ authenticate: createRequireSession("staff", lazyIdentitySessionService) }));
app.use("/admin", createCollectionRouter({ authenticate: requireAdminIdentity }));

let collectorToken = "";
let unprivilegedToken = "";
let managerToken = "";
let accountsToken = "";

beforeAll(async () => {
  const [tier, collectorRole, platformAdminRole, accountsRole] = await Promise.all([
    prisma.tier.create({ data: { id: ids.tier, name: `collection-permissions-${ids.tier}` } }),
    prisma.role.findUniqueOrThrow({ where: { name: "field_collector" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "accounts" } }),
  ]);

  await Promise.all([
    prisma.retailer.create({ data: { id: ids.retailer, name: "North Star Collection Test", phone: `6${Date.now().toString().slice(-9)}`, shopAddress: "Local test address", tierId: tier.id } }),
    prisma.retailer.create({ data: { id: ids.otherRetailer, name: "South Star Collection Test", phone: `5${Date.now().toString().slice(-9)}`, shopAddress: "Local test address", tierId: tier.id } }),
    prisma.staffUser.create({
      data: {
        id: ids.collector,
        name: "Assigned Collector",
        phone: `7${Date.now().toString().slice(-9)}`,
        email: `${ids.collector}@test.invalid`,
        roles: { create: { roleId: collectorRole.id } },
      },
    }),
    prisma.staffUser.create({ data: { id: ids.unprivileged, name: "Unprivileged Collector", phone: `4${Date.now().toString().slice(-9)}`, email: `${ids.unprivileged}@test.invalid` } }),
  ]);

  await prisma.adminUser.createMany({
    data: [
      { id: ids.managerAdmin, email: `${ids.managerAdmin}@test.invalid`, name: "Staff Manager", passwordHash: "test-only" },
      { id: ids.accountsAdmin, email: `${ids.accountsAdmin}@test.invalid`, name: "Accounts Only", passwordHash: "test-only" },
    ],
  });
  await Promise.all([
    prisma.staffUser.create({
      data: {
        id: ids.manager,
        name: "Staff Manager",
        phone: `8${Date.now().toString().slice(-9)}`,
        email: `${ids.manager}@test.invalid`,
        adminUserId: ids.managerAdmin,
        roles: { create: { roleId: platformAdminRole.id } },
      },
    }),
    prisma.staffUser.create({
      data: {
        id: ids.accounts,
        name: "Accounts Only",
        phone: `9${Date.now().toString().slice(-9)}`,
        email: `${ids.accounts}@test.invalid`,
        adminUserId: ids.accountsAdmin,
        roles: { create: { roleId: accountsRole.id } },
      },
    }),
  ]);

  const sessions = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.collector, deviceName: "collection-permissions-test" }),
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.unprivileged, deviceName: "collection-permissions-test" }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.manager, deviceName: "collection-permissions-test" }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.accounts, deviceName: "collection-permissions-test" }),
  ]);
  [collectorToken, unprivilegedToken, managerToken, accountsToken] = sessions.map(({ accessToken }) => accessToken);
});

afterAll(async () => {
  await prisma.collectionAssignment.deleteMany({ where: { collectorStaffId: ids.collector } });
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.collector, ids.unprivileged, ids.manager, ids.accounts] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [ids.collector, ids.unprivileged, ids.manager, ids.accounts] } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [ids.managerAdmin, ids.accountsAdmin] } } });
  await prisma.retailer.deleteMany({ where: { id: { in: [ids.retailer, ids.otherRetailer] } } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
});

describe("collection assignment authorization", () => {
  it("allows staff managers to grant and revoke retailer access while rejecting direct unauthorized collection calls", async () => {
    const collectionPayload = (retailerId: string) => ({
      retailerId,
      amount: 10,
      method: "cash",
      reference: "AUTH-CHECK-001",
      idempotencyKey: randomUUID(),
    });

    await request(app)
      .post("/rep/collections")
      .set("Authorization", `Bearer ${collectorToken}`)
      .send(collectionPayload(ids.retailer))
      .expect(403, { error: "collection_assignment_required" });

    await request(app)
      .post("/rep/collections")
      .set("Authorization", `Bearer ${unprivilegedToken}`)
      .send(collectionPayload(ids.retailer))
      .expect(403, { error: "permission_required", details: { permission: "collection.submit" } });

    await request(app)
      .post("/admin/collections/assignments")
      .set("Authorization", `Bearer ${accountsToken}`)
      .send({ collectorStaffId: ids.collector, retailerId: ids.retailer })
      .expect(403, { error: "permission_required", details: { permission: "staff.manage" } });

    await request(app)
      .get(`/admin/collections/collectors/${ids.collector}/assignments`)
      .set("Authorization", `Bearer ${accountsToken}`)
      .expect(403, { error: "permission_required", details: { permission: "staff.manage" } });

    const choices = await request(app)
      .get(`/admin/collections/assignment-retailers?collectorStaffId=${ids.collector}&search=North%20Star`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(choices.body.retailers).toEqual([{ id: ids.retailer, name: "North Star Collection Test", phone: expect.any(String) }]);

    const assigned = await request(app)
      .post("/admin/collections/assignments")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ collectorStaffId: ids.collector, retailerId: ids.retailer })
      .expect(201);
    expect(assigned.body.assignment).toMatchObject({ active: true, collectorStaffId: ids.collector, retailerId: ids.retailer });

    const availableAfterGrant = await request(app)
      .get(`/admin/collections/assignment-retailers?collectorStaffId=${ids.collector}&search=Star`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(availableAfterGrant.body.retailers).toEqual([{ id: ids.otherRetailer, name: "South Star Collection Test", phone: expect.any(String) }]);

    const assignmentList = await request(app)
      .get(`/admin/collections/collectors/${ids.collector}/assignments`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(assignmentList.body.assignments).toHaveLength(1);
    expect(assignmentList.body.assignments[0]).toMatchObject({ id: assigned.body.assignment.id, retailer: { name: "North Star Collection Test" } });

    const collectorRetailers = await request(app)
      .get("/rep/collections/assigned-retailers")
      .set("Authorization", `Bearer ${collectorToken}`)
      .expect(200);
    expect(collectorRetailers.body.retailers).toHaveLength(1);
    expect(collectorRetailers.body.retailers[0].retailer.id).toBe(ids.retailer);

    const repeated = await request(app)
      .post("/admin/collections/assignments")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ collectorStaffId: ids.collector, retailerId: ids.retailer })
      .expect(201);
    expect(repeated.body.assignment.id).toBe(assigned.body.assignment.id);

    await request(app)
      .delete(`/admin/collections/assignments/${assigned.body.assignment.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    await request(app)
      .post("/rep/collections")
      .set("Authorization", `Bearer ${collectorToken}`)
      .send(collectionPayload(ids.retailer))
      .expect(403, { error: "collection_assignment_required" });
  });
});
