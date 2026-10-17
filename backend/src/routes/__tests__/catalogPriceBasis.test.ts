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
let testVariantId = "";
let tierIds: string[] = [];

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
  await prisma.adminUser.create({
    data: {
      id: adminUserId,
      email: `adm-price-basis-${run}@test.invalid`,
      name: "Price Basis Test Admin",
      passwordHash: "test-only",
    },
  });
  await prisma.staffUser.create({
    data: {
      id: staffId,
      adminUserId,
      name: "Price Basis Staff",
      phone: `88${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "3")}`,
      email: `adm-price-basis-staff-${run}@test.invalid`,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  const session = await lazyIdentitySessionService.createSession({
    realm: "admin",
    subjectId: staffId,
  });
  token = session.accessToken;

  const tiers = await prisma.tier.findMany();
  tierIds = tiers.map((t) => t.id);

  const product = await prisma.product.create({
    data: {
      name: `Dal Quintal Test ${run}`,
      category: "Daal",
      catalogStatus: "active",
      variants: {
        create: {
          unitSize: "30 kg",
          unit: "kg",
          unitsPerCase: 1,
          unitWeightKg: 30,
          catalogStatus: "active",
          listRate: 5400,
          listRateBasis: "case",
          gstPercent: 0,
          routingClass: "LAXMI_TOOR",
        },
      },
    },
    include: { variants: true },
  });

  testProductId = product.id;
  testVariantId = product.variants[0].id;

  for (const tierId of tierIds) {
    await prisma.priceList.create({
      data: {
        tierId,
        variantId: testVariantId,
        productId: testProductId,
        price: 5400,
        rateBasis: "case",
      },
    });
  }
});

afterAll(async () => {
  if (testVariantId) {
    await prisma.priceList.deleteMany({ where: { variantId: testVariantId } });
    await prisma.variant.deleteMany({ where: { id: testVariantId } });
  }
  if (testProductId) {
    await prisma.product.deleteMany({ where: { id: testProductId } });
  }
  if (staffId) {
    await prisma.staffRole.deleteMany({ where: { staffId } });
    await prisma.staffUser.deleteMany({ where: { id: staffId } });
  }
  if (adminUserId) {
    await prisma.adminUser.deleteMany({ where: { id: adminUserId } });
  }
});

describe("Admin Catalog: Quick-edit Price & Rate Basis (case vs quintal)", () => {
  it("saves quintal rateBasis and price, updating both Variant and all PriceList entries", async () => {
    // 1. Initial state: price 5400, rateBasis: case
    const initialVariant = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId } });
    expect(Number(initialVariant.listRate)).toBe(5400);
    expect(initialVariant.listRateBasis).toBe("case");

    // 2. Perform quick-edit to ₹18,000 / quintal (equivalent to ₹180/kg)
    const res = await request(app)
      .put(`/admin/variants/${testVariantId}/quick-edit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        price: 18000,
        rateBasis: "quintal",
        packSize: "30",
        unit: "kg",
        unitsPerCase: 1,
        gstPercent: 0,
        routingClass: "LAXMI_TOOR",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 3. Verify Variant model in DB
    const updatedVariant = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId } });
    expect(Number(updatedVariant.listRate)).toBe(18000);
    expect(updatedVariant.listRateBasis).toBe("quintal");

    // 4. Verify all PriceList entries in DB have price: 18000 and rateBasis: "quintal"
    const priceLists = await prisma.priceList.findMany({ where: { variantId: testVariantId } });
    expect(priceLists.length).toBeGreaterThan(0);
    for (const pl of priceLists) {
      expect(Number(pl.price)).toBe(18000);
      expect(pl.rateBasis).toBe("quintal");
    }

    // 5. Verify GET /admin/products returns prices with rateBasis: "quintal"
    const catalogRes = await request(app)
      .get("/admin/products?view=all")
      .set("Authorization", `Bearer ${token}`);

    expect(catalogRes.status).toBe(200);
    const prod = catalogRes.body.products.find((p: any) => p.id === testProductId);
    expect(prod).toBeDefined();
    const v = prod.variants.find((item: any) => item.id === testVariantId);
    expect(v).toBeDefined();
    expect(v.listRate).toBe(18000);
    expect(v.listRateBasis).toBe("quintal");
    for (const p of v.prices) {
      expect(p.price).toBe(18000);
      expect(p.rateBasis).toBe("quintal");
    }
  });

  it("switches back to case rateBasis and updates price without leaving stale quintal basis", async () => {
    const res = await request(app)
      .put(`/admin/variants/${testVariantId}/quick-edit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        price: 5500,
        rateBasis: "case",
        packSize: "30",
        unit: "kg",
        unitsPerCase: 1,
        gstPercent: 0,
        routingClass: "LAXMI_TOOR",
      });

    expect(res.status).toBe(200);

    const updatedVariant = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId } });
    expect(Number(updatedVariant.listRate)).toBe(5500);
    expect(updatedVariant.listRateBasis).toBe("case");

    const priceLists = await prisma.priceList.findMany({ where: { variantId: testVariantId } });
    for (const pl of priceLists) {
      expect(Number(pl.price)).toBe(5500);
      expect(pl.rateBasis).toBe("case");
    }
  });

  it("POST /admin/price-list updates rateBasis across tiers and on Variant", async () => {
    const res = await request(app)
      .post("/admin/price-list")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tierId: tierIds[0],
        variantId: testVariantId,
        price: 19500,
        rateBasis: "quintal",
      });

    expect(res.status).toBe(200);

    const updatedVariant = await prisma.variant.findUniqueOrThrow({ where: { id: testVariantId } });
    expect(Number(updatedVariant.listRate)).toBe(19500);
    expect(updatedVariant.listRateBasis).toBe("quintal");

    const priceLists = await prisma.priceList.findMany({ where: { variantId: testVariantId } });
    for (const pl of priceLists) {
      expect(Number(pl.price)).toBe(19500);
      expect(pl.rateBasis).toBe("quintal");
    }
  });
});
