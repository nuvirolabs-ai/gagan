import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";

const run = randomUUID();
const app = createApp();
const ids = {
  tier: randomUUID(),
  product: randomUUID(),
  variant: randomUUID(),
  retailer: randomUUID(),
  confirmed: randomUUID(),
  packed: randomUUID(),
  placed: randomUUID(),
};
const createdOperators: Array<{ adminId: string; staffId: string }> = [];
const createdCatalog: { role: boolean; permission: boolean; warehouseGrant: boolean; adminGrant: boolean } = {
  role: false,
  permission: false,
  warehouseGrant: false,
  adminGrant: false,
};
let warehouseToken = "";
let salespersonToken = "";
let adminToken = "";
let warehouseStaffId = "";

async function tokenFor(roleName: string) {
  const adminId = randomUUID();
  const staffId = randomUUID();
  const email = `${randomUUID()}@test.invalid`;
  const password = randomUUID();
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  await prisma.adminUser.create({
    data: { id: adminId, email, name: `Warehouse test ${roleName}`, passwordHash: await bcrypt.hash(password, 10) },
  });
  await prisma.staffUser.create({
    data: {
      id: staffId,
      email,
      phone: `test-${staffId}`,
      name: `Warehouse test ${roleName}`,
      adminUserId: adminId,
      roles: { create: { roleId: role.id } },
    },
  });
  createdOperators.push({ adminId, staffId });
  const login = await request(app).post("/admin/auth/login").send({ email, password });
  expect(login.status).toBe(200);
  return { token: login.body.accessToken as string, staffId };
}

async function createOrder(status: "placed" | "confirmed" | "packed", id: string) {
  return prisma.order.create({
    data: {
      id,
      retailerId: ids.retailer,
      status,
      orderTotal: 9876,
      items: { create: [{ variantId: ids.variant, qtyOrdered: 3, unitPrice: 3292 }] },
    },
  });
}

describe("warehouse order API on local PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.includes("test")) {
      throw new Error("Disposable local test DB required");
    }

    let warehouseRole = await prisma.role.findUnique({ where: { name: "warehouse_operator" } });
    if (!warehouseRole) {
      warehouseRole = await prisma.role.create({
        data: { name: "warehouse_operator", description: "Local test warehouse operator" },
      });
      createdCatalog.role = true;
    }
    let permission = await prisma.permission.findUnique({ where: { name: "order.warehouse_process" } });
    if (!permission) {
      permission = await prisma.permission.create({ data: { name: "order.warehouse_process" } });
      createdCatalog.permission = true;
    }
    const warehouseGrant = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: warehouseRole.id, permissionId: permission.id } },
    });
    if (!warehouseGrant) {
      await prisma.rolePermission.create({ data: { roleId: warehouseRole.id, permissionId: permission.id } });
      createdCatalog.warehouseGrant = true;
    }
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
    const adminGrant = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
    });
    if (!adminGrant) {
      await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: permission.id } });
      createdCatalog.adminGrant = true;
    }

    await prisma.tier.create({ data: { id: ids.tier, name: `Warehouse ${run}` } });
    await prisma.product.create({ data: { id: ids.product, name: `Warehouse item ${run}`, category: "test" } });
    await prisma.variant.create({
      data: { id: ids.variant, productId: ids.product, unitSize: "1 kg", unit: "case", unitsPerCase: 12 },
    });
    await prisma.retailer.create({
      data: {
        id: ids.retailer,
        tierId: ids.tier,
        name: `Warehouse retailer ${run}`,
        phone: `wh-${run}`,
        shopAddress: "Local test fixture",
      },
    });
    await createOrder("confirmed", ids.confirmed);
    await createOrder("packed", ids.packed);
    await createOrder("placed", ids.placed);

    const warehouse = await tokenFor("warehouse_operator");
    warehouseToken = warehouse.token;
    warehouseStaffId = warehouse.staffId;
    salespersonToken = (await tokenFor("salesperson")).token;
    adminToken = (await tokenFor("platform_admin")).token;
  });

  afterAll(async () => {
    for (const { staffId } of createdOperators) {
      await prisma.deviceSession.deleteMany({ where: { subjectId: staffId } });
      await prisma.staffRole.deleteMany({ where: { staffId } });
    }
    await prisma.auditEvent.deleteMany({ where: { subjectId: { in: Object.values(ids) } } });
    await prisma.dispatchAuthorization.deleteMany({ where: { orderId: { in: [ids.confirmed, ids.packed, ids.placed] } } });
    await prisma.creditAssessment.deleteMany({ where: { orderId: { in: [ids.confirmed, ids.packed, ids.placed] } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: [ids.confirmed, ids.packed, ids.placed] } } });
    await prisma.order.deleteMany({ where: { id: { in: [ids.confirmed, ids.packed, ids.placed] } } });
    for (const { staffId, adminId } of createdOperators) {
      await prisma.staffUser.deleteMany({ where: { id: staffId } });
      await prisma.adminUser.deleteMany({ where: { id: adminId } });
    }
    await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
    await prisma.variant.deleteMany({ where: { id: ids.variant } });
    await prisma.product.deleteMany({ where: { id: ids.product } });
    await prisma.tier.deleteMany({ where: { id: ids.tier } });
    const warehouseRole = await prisma.role.findUnique({ where: { name: "warehouse_operator" } });
    const permission = await prisma.permission.findUnique({ where: { name: "order.warehouse_process" } });
    const adminRole = await prisma.role.findUnique({ where: { name: "platform_admin" } });
    if (permission && createdCatalog.adminGrant && adminRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id, permissionId: permission.id } });
    }
    if (permission && warehouseRole && createdCatalog.warehouseGrant) {
      await prisma.rolePermission.deleteMany({ where: { roleId: warehouseRole.id, permissionId: permission.id } });
    }
    if (warehouseRole && createdCatalog.role) await prisma.role.delete({ where: { id: warehouseRole.id } });
    if (permission && createdCatalog.permission) await prisma.permission.delete({ where: { id: permission.id } });
  });

  it("returns only eligible warehouse orders with line items and no commercial amounts", async () => {
    const response = await request(app)
      .get("/admin/warehouse-orders")
      .set("Authorization", `Bearer ${warehouseToken}`)
      .expect(200);

    expect(response.body.orders.map((order: any) => order.status).every((status: string) => ["confirmed", "packed"].includes(status))).toBe(true);
    expect(response.body.orders.map((order: any) => order.id)).toEqual(expect.arrayContaining([ids.confirmed, ids.packed]));
    const order = response.body.orders.find((candidate: any) => candidate.id === ids.confirmed);
    expect(order).toMatchObject({
      id: ids.confirmed,
      status: "confirmed",
      retailer: { id: ids.retailer, name: `Warehouse retailer ${run}` },
      items: [{ qtyOrdered: 3, variant: { unitSize: "1 kg", unit: "case", unitsPerCase: 12, product: { name: `Warehouse item ${run}` } } }],
    });
    expect(order).not.toHaveProperty("orderTotal");
    expect(order.items[0]).not.toHaveProperty("unitPrice");
  });

  it("does not reveal orders outside the warehouse processing window", async () => {
    await request(app)
      .get(`/admin/warehouse-orders/${ids.placed}`)
      .set("Authorization", `Bearer ${warehouseToken}`)
      .expect(404);
  });

  it("allows only warehouse-capable identities into the warehouse queue", async () => {
    await request(app)
      .get("/admin/warehouse-orders")
      .set("Authorization", `Bearer ${salespersonToken}`)
      .expect(403);
    await request(app)
      .get("/admin/orders")
      .set("Authorization", `Bearer ${warehouseToken}`)
      .expect(403);
    await request(app)
      .post(`/admin/orders/${ids.confirmed}/approve`)
      .set("Authorization", `Bearer ${warehouseToken}`)
      .expect(403);
  });

  it("exposes the new role through the existing staff role assignment catalog", async () => {
    const response = await request(app)
      .get("/admin/roles")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const role = response.body.roles.find((candidate: any) => candidate.name === "warehouse_operator");
    expect(role.permissions.map((grant: any) => grant.permission.name)).toEqual(["order.warehouse_process"]);
  });

  it("packs through the existing transition and exposes the same state to Admin", async () => {
    const policy = await prisma.creditPolicyVersion.findFirstOrThrow({ where: { active: true } });
    const assessment = await prisma.creditAssessment.create({
      data: {
        retailerId: ids.retailer,
        orderId: ids.confirmed,
        policyVersionId: policy.id,
        result: "allowed",
        projectedExposure: 100,
        snapshot: {},
        reasons: [],
      },
    });
    await prisma.dispatchAuthorization.create({
      data: { orderId: ids.confirmed, assessmentId: assessment.id, version: 1, reason: "Local warehouse test" },
    });

    const packed = await request(app)
      .post(`/admin/warehouse-orders/${ids.confirmed}/pack`)
      .set("Authorization", `Bearer ${warehouseToken}`)
      .expect(200);
    expect(packed.body.order.status).toBe("packed");
    expect(packed.body.order).not.toHaveProperty("orderTotal");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: ids.confirmed } })).status).toBe("packed");
    expect(await prisma.auditEvent.findFirst({ where: { subjectId: ids.confirmed, action: "order.packed" } }))
      .toMatchObject({ actorStaffId: warehouseStaffId });

    const adminReadback = await request(app)
      .get(`/admin/orders/${ids.confirmed}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(adminReadback.body.order.status).toBe("packed");
  });
});
