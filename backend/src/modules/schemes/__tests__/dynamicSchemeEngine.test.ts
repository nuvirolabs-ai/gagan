import { describe, it, expect } from "vitest";
import { prisma } from "../../../lib/prisma";
import { evaluateDynamicSchemesForOrder } from "../dynamicSchemeEngine";
import { createOrderForRetailer } from "../../../lib/orders";
import { quoteFor } from "../../commercial/service";

describe("Dynamic Trade Scheme Engine", () => {
  it("evaluates a database-backed category weight scheme with lowest priced SKU", async () => {
    // 1. Create or ensure a category weight scheme in DB
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    const testScheme = await prisma.scheme.create({
      data: {
        name: "Test Dynamic Rice Promotion",
        headline: "Buy 210 kg Rice Get 10 kg Free",
        description: "Dynamic test scheme from DB",
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
        startsAt: now,
        endsAt: nextMonth,
      },
    });

    try {
      // 2. Find a rice variant
      const rice30 = await prisma.variant.findFirst({
        where: {
          unitSize: "30 KG",
          catalogStatus: "active",
          product: { category: { contains: "Rice", mode: "insensitive" } },
        },
        include: { product: true },
      });
      expect(rice30).toBeDefined();

      const retailer = await prisma.retailer.findFirst({ where: { status: "active" } });
      expect(retailer).toBeDefined();

      const quote = await quoteFor(retailer!.id, [{ variantId: rice30!.id, qty: 7 }]);
      const commercialParam = quote ? { quoteId: quote.id, revision: quote.revision } : undefined;

      // 3. Order 7 cases of 30kg rice = 210kg
      const orderRes = await createOrderForRetailer(
        retailer!.id,
        [{ variantId: rice30!.id, qty: 7 }],
        "rep",
        undefined,
        undefined,
        `dynamic-test-${Date.now()}`,
        commercialParam
      );

      if (!orderRes.ok) {
        console.log("Order failed with:", (orderRes as any).body || orderRes);
      }
      expect(orderRes.ok).toBe(true);
      if (!orderRes.ok) return;

      const items = await prisma.orderItem.findMany({
        where: { orderId: orderRes.order.id },
      });

      // Original 7 cases + 1 free goods line item
      expect(items.length).toBe(2);
      const freeItem = items.find((i) => Number(i.unitPrice) === 0);
      expect(freeItem).toBeDefined();
      const snap = freeItem!.commercialSnapshot as any;
      expect(snap.isFreeItem).toBe(true);
      expect(snap.freeWeightKg).toBe(10);
      expect(snap.packUnitKg).toBe(5); // 5kg bags preferred
      expect(freeItem!.qtyOrdered).toBe(2); // 2 x 5kg = 10kg
    } finally {
      // Clean up test scheme
      await prisma.scheme.delete({ where: { id: testScheme.id } }).catch(() => {});
    }
  });
});
