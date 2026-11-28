import { describe, it, expect } from "vitest";
import { prisma } from "../../lib/prisma";
import { createOrderForRetailer } from "../../lib/orders";
import { quoteFor } from "../../modules/commercial/service";

describe("Cluster Testing Order Features", () => {
  it("creates order with dispatchDate, remarks, transportName and applies active DB Rice Scheme when rice >= 210kg", async () => {
    const now = new Date();
    const scheme = await prisma.scheme.create({
      data: {
        name: "Cluster Test Rice 210 KG Scheme",
        headline: "Buy 210 kg Rice, Get 10 kg Free",
        targetAmount: 0,
        discountAmount: 0,
        ruleType: "category_weight",
        qualifyingCategory: "Rice",
        qualifyingWeightKg: 210,
        rewardType: "lowest_priced_category_sku",
        rewardValue: 10,
        freePackagingUnits: "5,1",
        targetAudience: "all_retailers",
        active: true,
        startsAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + 86_400_000),
      },
    });
    try {
    // 1. Find a retailer
    const retailer = await prisma.retailer.findFirst({
      where: { status: "active" },
    });
    expect(retailer).toBeDefined();

    // 2. Find a 30kg rice variant (7 cases = 210kg)
    const rice30 = await prisma.variant.findFirst({
      where: {
        unitSize: "30 KG",
        catalogStatus: "active",
        product: { category: { contains: "Rice", mode: "insensitive" } },
      },
      include: { product: true },
    });
    expect(rice30).toBeDefined();

    const idempotencyKey = `cluster-test-${Date.now()}`;
    const dispatchDate = new Date(Date.now() + 86400000 * 2).toISOString(); // 2 days later
    const remarks = "Cluster test dispatch instructions: Handle with care, deliver morning";
    const transportName = "VRL Logistics Indore";

    const quote = await quoteFor(retailer!.id, [{ variantId: rice30!.id, qty: 7 }]);
    const commercialParam = quote ? { quoteId: quote.id, revision: quote.revision } : undefined;

    const result = await createOrderForRetailer(
      retailer!.id,
      [{ variantId: rice30!.id, qty: 7 }], // 7 * 30kg = 210kg
      "rep",
      undefined,
      undefined,
      idempotencyKey,
      commercialParam,
      undefined,
      {
        dispatchDate,
        remarks,
        transportName,
      }
    );

    if (!result.ok) {
      console.log("Order error body:", result.body);
    }
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = result.order;
    expect(order.remarks).toBe(remarks);
    expect(order.transportName).toBe(transportName);
    expect(new Date(order.expectedDeliveryAt).toISOString().slice(0, 10)).toBe(dispatchDate.slice(0, 10));

    // Check that items contain the original 7 cases + 1 free item line
    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      include: { variant: { include: { product: true } } },
    });
    expect(items.length).toBe(2);

    const freeItem = items.find((i) => Number(i.unitPrice) === 0);
    expect(freeItem).toBeDefined();
    const snap = freeItem!.commercialSnapshot as any;
    expect(snap.isFreeItem).toBe(true);
    expect(snap.schemeId).toBe(scheme.id);
    expect(snap.freeWeightKg).toBe(10);
    } finally {
      await prisma.scheme.delete({ where: { id: scheme.id } }).catch(() => {});
    }
  });

  it("handles order with no dispatch date (defaults to null meaning any time/same day)", async () => {
    const retailer = await prisma.retailer.findFirst({
      where: { status: "active" },
    });
    const nonRiceVariant = await prisma.variant.findFirst({
      where: {
        catalogStatus: "active",
        product: { category: "Daal" },
      },
    });
    expect(retailer).toBeDefined();
    expect(nonRiceVariant).toBeDefined();

    const idempotencyKey = `cluster-test-nodate-${Date.now()}`;
    const quote = await quoteFor(retailer!.id, [{ variantId: nonRiceVariant!.id, qty: 1 }]);
    const commercialParam = quote ? { quoteId: quote.id, revision: quote.revision } : undefined;

    const result = await createOrderForRetailer(
      retailer!.id,
      [{ variantId: nonRiceVariant!.id, qty: 1 }],
      "retailer",
      undefined,
      undefined,
      idempotencyKey,
      commercialParam,
      undefined,
      {
        dispatchDate: null,
        remarks: "Urgent dispatch",
        transportName: "Self Pickup",
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.order.expectedDeliveryAt).toBeNull();
    expect(result.order.remarks).toBe("Urgent dispatch");
    expect(result.order.transportName).toBe("Self Pickup");
  });
});
