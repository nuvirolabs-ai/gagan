import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";

const run = randomUUID();
const adminUserId = randomUUID();
const staffId = randomUUID();
const app = createApp();
let token = "";

let testProductId = "";
let testVariantId1 = "";
let testVariantId2 = "";

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
  await prisma.adminUser.create({
    data: {
      id: adminUserId,
      email: `adm-status-del-${run}@test.invalid`,
      name: "Status Delete Admin",
      passwordHash: "test-only",
    },
  });
  await prisma.staffUser.create({
    data: {
      id: staffId,
      adminUserId,
      name: "Status Delete Staff",
      phone: `87${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "4")}`,
      email: `adm-status-del-staff-${run}@test.invalid`,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  const session = await lazyIdentitySessionService.createSession({
    realm: "admin",
    subjectId: staffId,
  });
  token = session.accessToken;

  const product = await prisma.product.create({
    data: {
      name: `Status Test Product ${run}`,
      category: "Test Category",
      catalogStatus: "active",
      variants: {
        create: [
          {
            unitSize: "10 kg",
            unit: "kg",
            unitsPerCase: 1,
            unitWeightKg: 10,
            catalogStatus: "active",
            listRate: 1000,
            listRateBasis: "case",
            gstPercent: 0,
            routingClass: "LAXMI_TOOR",
          },
          {
            unitSize: "25 kg",
            unit: "kg",
            unitsPerCase: 1,
            unitWeightKg: 25,
            catalogStatus: "active",
            listRate: 2500,
            listRateBasis: "case",
            gstPercent: 0,
            routingClass: "LAXMI_TOOR",
          },
        ],
      },
    },
    include: { variants: true },
  });

  testProductId = product.id;
  testVariantId1 = product.variants[0].id;
  testVariantId2 = product.variants[1].id;
});

afterAll(async () => {
  await prisma.staffRole.deleteMany({ where: { staffId } });
  await prisma.staffUser.deleteMany({ where: { id: staffId } });
  await prisma.adminUser.deleteMany({ where: { id: adminUserId } });
  await prisma.priceList.deleteMany({ where: { variantId: { in: [testVariantId1, testVariantId2] } } });
  await prisma.variant.deleteMany({ where: { productId: testProductId } });
  await prisma.product.deleteMany({ where: { id: testProductId } });
});

describe("Admin Catalog: Product & Variant Status (Active/Inactive) & Delete", () => {
  it("deactivates a product and all its variants via PUT /admin/products/:id/status", async () => {
    const res = await request(app)
      .put(`/admin/products/${testProductId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.catalogStatus).toBe("inactive");

    const v1 = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId1 } });
    const v2 = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId2 } });
    expect(v1.catalogStatus).toBe("inactive");
    expect(v2.catalogStatus).toBe("inactive");

    // GET /admin/products?view=all should still return it with catalogStatus: "inactive"
    const allRes = await request(app)
      .get("/admin/products?view=all")
      .set("Authorization", `Bearer ${token}`);
    expect(allRes.status).toBe(200);
    const prod = allRes.body.products.find((p: any) => p.id === testProductId);
    expect(prod).toBeDefined();
    expect(prod.catalogStatus).toBe("inactive");
    expect(prod.variants[0].catalogStatus).toBe("inactive");
  });

  it("reactivates a product and its variants via PUT /admin/products/:id/status", async () => {
    const res = await request(app)
      .put(`/admin/products/${testProductId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "active" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.catalogStatus).toBe("active");

    const v1 = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId1 } });
    expect(v1.catalogStatus).toBe("active");
  });

  it("updates variant status via PUT /admin/variants/:id/status", async () => {
    const res = await request(app)
      .put(`/admin/variants/${testVariantId1}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.variant.catalogStatus).toBe("inactive");

    const v1 = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId1 } });
    expect(v1.catalogStatus).toBe("inactive");
    const v2 = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId2 } });
    expect(v2.catalogStatus).toBe("active");
  });

  it("deletes a variant via DELETE /admin/variants/:id", async () => {
    const res = await request(app)
      .delete(`/admin/variants/${testVariantId1}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const deletedVariant = await prisma.variant.findUnique({ where: { id: testVariantId1 } });
    expect(deletedVariant).toBeNull();

    // Remaining variant is still active
    const remaining = await prisma.variant.findUnique({ where: { id: testVariantId2 } });
    expect(remaining).not.toBeNull();
  });

  it("deletes a product via DELETE /admin/products/:id", async () => {
    const res = await request(app)
      .delete(`/admin/products/${testProductId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const prod = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(prod).toBeNull();

    // Verify GET /admin/products?view=all no longer contains it
    const allRes = await request(app)
      .get("/admin/products?view=all")
      .set("Authorization", `Bearer ${token}`);
    expect(allRes.body.products.some((p: any) => p.id === testProductId)).toBe(false);
  });
});
