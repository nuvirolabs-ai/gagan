import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";

const run = randomUUID();
const app = createApp();

let retailerId = "";
let retailerToken = "";
let salesRepId = "";
let staffId = "";
let repToken = "";
let productId = "";
let variantGst5Id = "";
let variantGst0Id = "";
let variantGstNullId = "";

beforeAll(async () => {
  const tier = await prisma.tier.findFirstOrThrow();

  const repRole = await prisma.role.findFirst({ where: { name: "salesperson" } }) ?? await prisma.role.findFirst({ where: { name: "sales_rep" } });
  const repPhone = `91${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "1")}`;
  const salesRep = await prisma.salesRep.create({
    data: {
      id: randomUUID(),
      name: `Rep GST ${run}`,
      phone: repPhone,
    },
  });
  salesRepId = salesRep.id;

  const salesperson = await prisma.staffUser.create({
    data: {
      id: randomUUID(),
      email: `rep-gst-${run}@test.invalid`,
      name: `Rep GST ${run}`,
      phone: repPhone,
      salesRepId: salesRep.id,
      roles: repRole ? { create: { roleId: repRole.id } } : undefined,
    },
  });
  staffId = salesperson.id;

  const retailer = await prisma.retailer.create({
    data: {
      id: randomUUID(),
      name: `Retailer GST ${run}`,
      phone: `92${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "2")}`,
      shopAddress: "123 Market Road",
      tierId: tier.id,
      salesRepId: salesRep.id,
    },
  });
  retailerId = retailer.id;

  const retailerSession = await lazyIdentitySessionService.createSession({
    realm: "retailer",
    subjectId: retailerId,
  });
  retailerToken = retailerSession.accessToken;

  const repSession = await lazyIdentitySessionService.createSession({
    realm: "staff",
    subjectId: staffId,
  });
  repToken = repSession.accessToken;

  const product = await prisma.product.create({
    data: {
      id: randomUUID(),
      name: `Basmati Rice GST Test ${run}`,
      category: "Rice",
      catalogStatus: "active",
      variants: {
        create: [
          {
            unitSize: "1 kg",
            unit: "kg",
            unitsPerCase: 20,
            unitWeightKg: 1,
            catalogStatus: "active",
            listRate: 9950,
            listRateBasis: "quintal",
            sellingEntity: "jain_traders",
            gstPercent: 5,
            gstPendingOrderAllowed: false,
          },
          {
            unitSize: "5 kg",
            unit: "kg",
            unitsPerCase: 4,
            unitWeightKg: 5,
            catalogStatus: "active",
            listRate: 9950,
            listRateBasis: "quintal",
            sellingEntity: "jain_traders",
            gstPercent: 0,
            gstPendingOrderAllowed: false,
          },
          {
            unitSize: "10 kg",
            unit: "kg",
            unitsPerCase: 4,
            unitWeightKg: 10,
            catalogStatus: "active",
            listRate: 9750,
            listRateBasis: "quintal",
            routingClass: "LAXMI_TOOR",
            gstPercent: null,
            gstPendingOrderAllowed: true,
          },
        ],
      },
    },
    include: { variants: true },
  });
  productId = product.id;
  variantGst5Id = product.variants.find((v) => v.gstPercent !== null && Number(v.gstPercent) === 5)!.id;
  variantGst0Id = product.variants.find((v) => v.gstPercent !== null && Number(v.gstPercent) === 0)!.id;
  variantGstNullId = product.variants.find((v) => v.gstPercent == null)!.id;

  for (const v of product.variants) {
    await prisma.priceList.upsert({
      where: { tierId_variantId: { tierId: tier.id, variantId: v.id } },
      update: { price: Number(v.listRate), rateBasis: v.listRateBasis ?? "quintal" },
      create: {
        tierId: tier.id,
        variantId: v.id,
        productId: product.id,
        price: Number(v.listRate),
        rateBasis: v.listRateBasis ?? "quintal",
      },
    });
  }
});

afterAll(async () => {
  if (productId) {
    await prisma.priceList.deleteMany({ where: { productId } });
    await prisma.variant.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  if (retailerId) {
    await prisma.retailer.deleteMany({ where: { id: retailerId } });
  }
  if (staffId) {
    await prisma.staffRole.deleteMany({ where: { staffId } });
    await prisma.staffUser.deleteMany({ where: { id: staffId } });
  }
  if (salesRepId) {
    await prisma.salesRep.deleteMany({ where: { id: salesRepId } });
  }
});

describe("Catalog GST rateLabel & gstPercent presentation", () => {
  it("GET /catalog returns correct gstPercent and rateLabel for 5%, 0% and null GST", async () => {
    const res = await request(app)
      .get("/catalog")
      .set("Authorization", `Bearer ${retailerToken}`);

    expect(res.status).toBe(200);

    const group = res.body.groups.find((g: any) => g.productIds?.includes(productId) || g.id === productId);
    expect(group).toBeDefined();

    const sku5 = group.skus.find((s: any) => s.id === variantGst5Id);
    expect(sku5).toBeDefined();
    expect(sku5.gstPercent).toBe(5);
    expect(sku5.rateLabel).toBe("per quintal · Including 5% GST");

    const sku0 = group.skus.find((s: any) => s.id === variantGst0Id);
    expect(sku0).toBeDefined();
    expect(sku0.gstPercent).toBe(0);
    expect(sku0.rateLabel).toBe("per quintal · Including 0% GST (Nil)");

    const skuNull = group.skus.find((s: any) => s.id === variantGstNullId);
    expect(skuNull).toBeDefined();
    expect(skuNull.gstPercent).toBeNull();
    expect(skuNull.rateLabel).toBe("per quintal · Excluding GST");
  });

  it("GET /home returns gstPercent and rateLabel in productGroups and quickOrder", async () => {
    const res = await request(app)
      .get("/home")
      .set("Authorization", `Bearer ${retailerToken}`);

    expect(res.status).toBe(200);

    const group = res.body.productGroups.find((g: any) => g.productIds?.includes(productId) || g.id === productId);
    expect(group).toBeDefined();

    const sku5 = group.skus.find((s: any) => s.id === variantGst5Id);
    expect(sku5.gstPercent).toBe(5);
    expect(sku5.rateLabel).toBe("per quintal · Including 5% GST");
  });

  it("GET /rep/retailers/:id/catalog returns gstPercent and rateLabel for salesperson", async () => {
    const res = await request(app)
      .get(`/rep/retailers/${retailerId}/catalog`)
      .set("Authorization", `Bearer ${repToken}`);

    expect(res.status).toBe(200);

    const group = res.body.groups.find((g: any) => g.productIds?.includes(productId) || g.id === productId);
    expect(group).toBeDefined();

    const sku5 = group.skus.find((s: any) => s.id === variantGst5Id);
    expect(sku5.gstPercent).toBe(5);
    expect(sku5.rateLabel).toBe("per quintal · Including 5% GST");

    const sku0 = group.skus.find((s: any) => s.id === variantGst0Id);
    expect(sku0.gstPercent).toBe(0);
    expect(sku0.rateLabel).toBe("per quintal · Including 0% GST (Nil)");

    const skuNull = group.skus.find((s: any) => s.id === variantGstNullId);
    expect(skuNull.gstPercent).toBeNull();
    expect(skuNull.rateLabel).toBe("per quintal · Excluding GST");
  });
});
