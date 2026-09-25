import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";

const run = randomUUID();
const ids = {
  tier: `segment-tier-${run}`,
  rep: `segment-rep-${run}`,
  retailer: `segment-retailer-${run}`,
  staff: `segment-staff-${run}`,
  adminUser: `segment-admin-${run}`,
  adminStaff: `segment-admin-staff-${run}`,
  accountsUser: `segment-accounts-${run}`,
  accountsStaff: `segment-accounts-staff-${run}`,
};
const phone = (suffix: string) => `${suffix}${run.replace(/\D/g, "").slice(0, 8).padEnd(8, suffix)}`;
let repToken = "";
let adminToken = "";
let accountsToken = "";
let retailerToken = "";

beforeAll(async () => {
  const [platformAdminRole, salespersonRole, accountsRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "salesperson" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "accounts" } }),
  ]);
  await prisma.tier.create({ data: { id: ids.tier, name: `Segment test tier ${run}` } });
  const rep = await prisma.salesRep.create({ data: { id: ids.rep, name: "Segment test rep", phone: phone("91") } });
  const retailer = await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: "Segment test retailer",
      phone: phone("92"),
      shopAddress: "Local test address",
      tierId: ids.tier,
      salesRepId: rep.id,
    },
  });
  await prisma.adminUser.createMany({
    data: [
      { id: ids.adminUser, email: `admin-${run}@test.invalid`, name: "Segment admin", passwordHash: "test-only" },
      { id: ids.accountsUser, email: `accounts-${run}@test.invalid`, name: "Segment accounts", passwordHash: "test-only" },
    ],
  });
  await Promise.all([
    prisma.staffUser.create({
      data: {
        id: ids.staff,
        name: "Segment salesperson",
        phone: phone("93"),
        email: `rep-${run}@test.invalid`,
        salesRepId: rep.id,
        roles: { create: { roleId: salespersonRole.id } },
      },
    }),
    prisma.staffUser.create({
      data: {
        id: ids.adminStaff,
        name: "Segment admin",
        phone: phone("94"),
        email: `admin-${run}@test.invalid`,
        adminUserId: ids.adminUser,
        roles: { create: { roleId: platformAdminRole.id } },
      },
    }),
    prisma.staffUser.create({
      data: {
        id: ids.accountsStaff,
        name: "Segment accounts",
        phone: phone("95"),
        email: `accounts-staff-${run}@test.invalid`,
        adminUserId: ids.accountsUser,
        roles: { create: { roleId: accountsRole.id } },
      },
    }),
  ]);
  const [repSession, adminSession, accountsSession, retailerSession] = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staff, deviceName: "segment-test" }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.adminStaff, deviceName: "segment-test" }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.accountsStaff, deviceName: "segment-test" }),
    lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: retailer.id, deviceName: "segment-test" }),
  ]);
  repToken = repSession.accessToken;
  adminToken = adminSession.accessToken;
  accountsToken = accountsSession.accessToken;
  retailerToken = retailerSession.accessToken;
});

afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.staff, ids.adminStaff, ids.accountsStaff, ids.retailer] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [ids.staff, ids.adminStaff, ids.accountsStaff] } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [ids.adminUser, ids.accountsUser] } } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.salesRep.deleteMany({ where: { id: ids.rep } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
});

describe("retailer internal segmentation", () => {
  const app = createApp();

  it("lets Admin assign an internal segment without changing the commercial tier", async () => {
    const assigned = await request(app)
      .post(`/admin/retailers/${ids.retailer}/internal-segment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ internalSegment: "A" })
      .expect(200);

    expect(assigned.body.retailer).toMatchObject({ id: ids.retailer, internalSegment: "A", tierId: ids.tier });

    const listed = await request(app)
      .get("/admin/retailers")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.retailers).toEqual(
      expect.arrayContaining([expect.objectContaining({
        id: ids.retailer,
        internalSegment: "A",
        tier: expect.objectContaining({ id: ids.tier }),
      })])
    );

    await request(app)
      .post(`/admin/retailers/${ids.retailer}/internal-segment`)
      .set("Authorization", `Bearer ${accountsToken}`)
      .send({ internalSegment: "C" })
      .expect(403);

    await request(app)
      .post(`/admin/retailers/${ids.retailer}/internal-segment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ internalSegment: "D" })
      .expect(400);

    const cleared = await request(app)
      .post(`/admin/retailers/${ids.retailer}/internal-segment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ internalSegment: null })
      .expect(200);
    expect(cleared.body.retailer.internalSegment).toBeNull();
  });

  it("shows the internal segment only to the assigned salesperson, not the retailer", async () => {
    await request(app)
      .post(`/admin/retailers/${ids.retailer}/internal-segment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ internalSegment: "B" })
      .expect(200);

    const repList = await request(app).get("/rep/retailers").set("Authorization", `Bearer ${repToken}`).expect(200);
    expect(repList.body.retailers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.retailer, internalSegment: "B" })])
    );

    const repDetail = await request(app)
      .get(`/rep/retailers/${ids.retailer}`)
      .set("Authorization", `Bearer ${repToken}`)
      .expect(200);
    expect(repDetail.body.retailer.internalSegment).toBe("B");

    const retailerIdentity = await request(app).get("/auth/me").set("Authorization", `Bearer ${retailerToken}`).expect(200);
    expect(retailerIdentity.body.retailer).not.toHaveProperty("internalSegment");

    const retailerHome = await request(app).get("/home").set("Authorization", `Bearer ${retailerToken}`).expect(200);
    expect(retailerHome.body.retailer).not.toHaveProperty("internalSegment");
  });
});
