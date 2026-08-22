import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";

const run = randomUUID();
const ids = { tier: `tenant-tier-${run}`, retailerA: `tenant-retailer-a-${run}`, retailerB: `tenant-retailer-b-${run}`, repA: `tenant-rep-a-${run}`, repB: `tenant-rep-b-${run}`, staffA: `tenant-staff-a-${run}`, staffB: `tenant-staff-b-${run}`, orderB: `tenant-order-b-${run}` };
let retailerAToken = "";
let retailerBToken = "";
let repAToken = "";

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Tenant tier ${run}` } });
  const [repA, repB] = await Promise.all([
    prisma.salesRep.create({ data: { id: ids.repA, name: "Rep A", phone: `91${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "1")}` } }),
    prisma.salesRep.create({ data: { id: ids.repB, name: "Rep B", phone: `92${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "2")}` } }),
  ]);
  const [retailerA, retailerB] = await Promise.all([
    prisma.retailer.create({ data: { id: ids.retailerA, name: "Retailer A", phone: `93${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "3")}`, shopAddress: "A", tierId: ids.tier, salesRepId: repA.id } }),
    prisma.retailer.create({ data: { id: ids.retailerB, name: "Retailer B", phone: `94${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "4")}`, shopAddress: "B", tierId: ids.tier, salesRepId: repB.id } }),
  ]);
  const salespersonRole = await prisma.role.findUniqueOrThrow({ where: { name: "salesperson" } });
  await Promise.all([
    prisma.staffUser.create({ data: { id: ids.staffA, name: "Staff A", phone: `95${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "5")}`, email: `tenant-a-${run}@test.invalid`, salesRepId: repA.id, roles: { create: { roleId: salespersonRole.id } } } }),
    prisma.staffUser.create({ data: { id: ids.staffB, name: "Staff B", phone: `96${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "6")}`, email: `tenant-b-${run}@test.invalid`, salesRepId: repB.id, roles: { create: { roleId: salespersonRole.id } } } }),
  ]);
  const order = await prisma.order.create({ data: { id: ids.orderB, retailerId: retailerB.id, orderTotal: 3_000 } });
  const [retailerASession, retailerBSession, repASession] = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: retailerA.id, deviceName: "test" }),
    lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: retailerB.id, deviceName: "test" }),
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staffA, deviceName: "test" }),
  ]);
  retailerAToken = retailerASession.accessToken;
  retailerBToken = retailerBSession.accessToken;
  repAToken = repASession.accessToken;
  expect(order.retailerId).toBe(retailerB.id);
});

afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.retailerA, ids.retailerB, ids.staffA] } } });
  await prisma.order.delete({ where: { id: ids.orderB } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [ids.staffA, ids.staffB] } } });
  await prisma.retailer.deleteMany({ where: { id: { in: [ids.retailerA, ids.retailerB] } } });
  await prisma.salesRep.deleteMany({ where: { id: { in: [ids.repA, ids.repB] } } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("tenant isolation", () => {
  const app = createApp();

  it("prevents retailer A from reading retailer B order and ledger", async () => {
    await request(app).get(`/orders/${ids.orderB}`).set("Authorization", `Bearer ${retailerAToken}`).expect(404);
    await request(app).get(`/ledger/${ids.retailerB}`).set("Authorization", `Bearer ${retailerAToken}`).expect(403);
  });

  it("prevents salesperson A from reading or ordering for retailer B", async () => {
    await request(app).get(`/rep/retailers/${ids.retailerB}`).set("Authorization", `Bearer ${repAToken}`).expect(404);
    await request(app).post("/rep/orders").set("Authorization", `Bearer ${repAToken}`).set("Idempotency-Key", `tenant-${run}`).send({ retailerId: ids.retailerB, items: [{ variantId: randomUUID(), qty: 1 }] }).expect(404);
    await request(app).get(`/orders/${ids.orderB}`).set("Authorization", `Bearer ${retailerBToken}`).expect(200);
  });
});
