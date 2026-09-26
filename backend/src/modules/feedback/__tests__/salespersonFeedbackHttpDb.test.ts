import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../identity/sessionRuntime";

const ids = {
  tier: randomUUID(), repA: randomUUID(), repB: randomUUID(),
  retailerA: randomUUID(), retailerB: randomUUID(),
  staffA: randomUUID(), staffB: randomUUID(), manager: randomUUID(), outsider: randomUUID(),
  managerAdmin: randomUUID(), outsiderAdmin: randomUUID(), role: randomUUID(),
};
let retailerToken = "";
let otherRetailerToken = "";
let managerToken = "";
let outsiderToken = "";
const app = createApp();

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.includes("feedback_slice_test")) {
    throw new Error("feedback_test_requires_isolated_local_database");
  }
  await prisma.tier.create({ data: { id: ids.tier, name: `HTTP feedback ${ids.tier}` } });
  await prisma.salesRep.createMany({ data: [
    { id: ids.repA, name: "Ravi", phone: ids.repA }, { id: ids.repB, name: "Sunil", phone: ids.repB },
  ] });
  await prisma.retailer.createMany({ data: [
    { id: ids.retailerA, name: "Mahesh Store", phone: ids.retailerA, shopAddress: "Local", tierId: ids.tier, salesRepId: ids.repA },
    { id: ids.retailerB, name: "Other Store", phone: ids.retailerB, shopAddress: "Local", tierId: ids.tier, salesRepId: ids.repB },
  ] });
  await prisma.adminUser.createMany({ data: [
    { id: ids.managerAdmin, email: `${ids.manager}@example.test`, name: "Manager", passwordHash: "test" },
    { id: ids.outsiderAdmin, email: `${ids.outsider}@example.test`, name: "Outsider", passwordHash: "test" },
  ] });
  await prisma.staffUser.createMany({ data: [
    { id: ids.staffA, name: "Ravi", phone: ids.staffA, email: `${ids.staffA}@example.test`, salesRepId: ids.repA, managerId: ids.manager },
    { id: ids.staffB, name: "Sunil", phone: ids.staffB, email: `${ids.staffB}@example.test`, salesRepId: ids.repB },
    { id: ids.manager, name: "Manager", phone: ids.manager, email: `${ids.manager}@example.test`, adminUserId: ids.managerAdmin },
    { id: ids.outsider, name: "Outsider", phone: ids.outsider, email: `${ids.outsider}@example.test`, adminUserId: ids.outsiderAdmin },
  ] });
  await prisma.role.create({ data: { id: ids.role, name: `feedback-review-${ids.role}` } });
  const permission = await prisma.permission.findUniqueOrThrow({ where: { name: "feedback.review" } });
  await prisma.rolePermission.create({ data: { roleId: ids.role, permissionId: permission.id } });
  await prisma.staffRole.create({ data: { staffId: ids.manager, roleId: ids.role } });
  const sessions = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: ids.retailerA }),
    lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: ids.retailerB }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.manager }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.outsider }),
  ]);
  [retailerToken, otherRetailerToken, managerToken, outsiderToken] = sessions.map(session => session.accessToken);
});

afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.retailerA, ids.retailerB, ids.manager, ids.outsider] } } });
  await prisma.salespersonFeedback.deleteMany({ where: { retailerId: { in: [ids.retailerA, ids.retailerB] } } });
  await prisma.staffRole.deleteMany({ where: { staffId: ids.manager } });
  await prisma.rolePermission.deleteMany({ where: { roleId: ids.role } });
  await prisma.role.delete({ where: { id: ids.role } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [ids.staffA, ids.staffB, ids.manager, ids.outsider] } } });
  await prisma.retailer.deleteMany({ where: { id: { in: [ids.retailerA, ids.retailerB] } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [ids.managerAdmin, ids.outsiderAdmin] } } });
  await prisma.salesRep.deleteMany({ where: { id: { in: [ids.repA, ids.repB] } } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("authenticated salesperson feedback API", () => {
  it("submits, reads back for its retailer, and enforces scoped Admin review", async () => {
    const payload = { description: "Helpful shop visit", clientReference: randomUUID(), expectedSalesRepId: ids.repA };
    await request(app).post("/salesperson-feedback").send(payload).expect(401);
    await request(app).get("/admin/salesperson-feedback").expect(401);
    await request(app).post("/salesperson-feedback").set("Authorization", `Bearer ${retailerToken}`)
      .send({ ...payload, salespersonStaffId: ids.staffB }).expect(400);
    const created = await request(app).post("/salesperson-feedback").set("Authorization", `Bearer ${retailerToken}`).send(payload).expect(201);
    expect(created.body.feedback).toMatchObject({ retailerId: ids.retailerA, salesRepId: ids.repA, salesRep: { name: "Ravi" } });
    const own = await request(app).get("/salesperson-feedback").set("Authorization", `Bearer ${retailerToken}`).expect(200);
    expect(own.body.assignment).toEqual({ id: ids.repA, name: "Ravi" });
    expect(own.body.feedback.map((row: any) => row.id)).toContain(created.body.feedback.id);
    const exact = await request(app).get(`/salesperson-feedback/submissions/${payload.clientReference}`).set("Authorization", `Bearer ${retailerToken}`).expect(200);
    expect(exact.body.feedback.id).toBe(created.body.feedback.id);
    await request(app).get(`/salesperson-feedback/submissions/${payload.clientReference}`).set("Authorization", `Bearer ${otherRetailerToken}`).expect(404);
    const other = await request(app).get("/salesperson-feedback").set("Authorization", `Bearer ${otherRetailerToken}`).expect(200);
    expect(other.body.feedback.map((row: any) => row.id)).not.toContain(created.body.feedback.id);
    await request(app).get("/admin/salesperson-feedback").set("Authorization", `Bearer ${outsiderToken}`).expect(403);
    const review = await request(app).get("/admin/salesperson-feedback").set("Authorization", `Bearer ${managerToken}`).expect(200);
    expect(review.body.feedback).toContainEqual(expect.objectContaining({ id: created.body.feedback.id, retailerId: ids.retailerA, salesRepId: ids.repA }));
    await request(app).get(`/admin/salesperson-feedback?salespersonId=${ids.staffB}`).set("Authorization", `Bearer ${managerToken}`).expect(403);
    await prisma.retailer.update({ where: { id: ids.retailerA }, data: { salesRepId: ids.repB } });
    const conflict = await request(app).post("/salesperson-feedback").set("Authorization", `Bearer ${retailerToken}`)
      .send({ ...payload, clientReference: randomUUID() }).expect(409);
    expect(conflict.body.error).toBe("salesperson_assignment_changed");
    const refreshed = await request(app).get("/salesperson-feedback").set("Authorization", `Bearer ${retailerToken}`).expect(200);
    expect(refreshed.body.assignment).toEqual({ id: ids.repB, name: "Sunil" });
    const replay = await request(app).post("/salesperson-feedback").set("Authorization", `Bearer ${retailerToken}`).send(payload).expect(201);
    expect(replay.body.feedback.id).toBe(created.body.feedback.id);
  });
});
