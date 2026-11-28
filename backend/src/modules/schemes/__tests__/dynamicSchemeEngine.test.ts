import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { evaluateDynamicSchemesForOrder } from "../dynamicSchemeEngine";

const now = new Date();
const activeWindow = {
  startsAt: new Date(now.getTime() - 60_000),
  endsAt: new Date(now.getTime() + 86_400_000),
  active: true,
  targetAudience: "all_retailers",
  targetTierId: null,
  targetTerritory: null,
  qualifyingVariantId: null,
  qualifyingWeightKg: null,
  minQuantity: null,
  freeVariantId: null,
  targetAmount: new Prisma.Decimal(0),
  discountAmount: new Prisma.Decimal(0),
};

function makeRiceCatalog() {
  const broken = {
    id: "v-broken-30",
    productId: "p-broken",
    unitSize: "30 kg",
    unitsPerCase: 1,
    unitWeightKg: new Prisma.Decimal(30),
    routingClass: null,
    product: { id: "p-broken", name: "Gagan Basmati Rice Broken", category: "RICE" },
  };
  const classic5x4 = {
    id: "v-classic-5x4",
    productId: "p-classic",
    unitSize: "5 kg",
    unitsPerCase: 4,
    unitWeightKg: new Prisma.Decimal(5),
    routingClass: null,
    product: { id: "p-classic", name: "Gagan Basmati Rice Classic", category: "RICE" },
  };
  const regular = {
    id: "v-regular-30",
    productId: "p-regular",
    unitSize: "30 kg",
    unitsPerCase: 1,
    unitWeightKg: new Prisma.Decimal(30),
    routingClass: null,
    product: { id: "p-regular", name: "Gagan Basmati Rice Regular", category: "RICE" },
  };
  const excellent = {
    id: "v-excellent-30",
    productId: "p-excellent",
    unitSize: "30 kg",
    unitsPerCase: 1,
    unitWeightKg: new Prisma.Decimal(30),
    routingClass: null,
    product: { id: "p-excellent", name: "Gagan Basmati Rice Excellent", category: "RICE" },
  };
  return { broken, classic5x4, regular, excellent };
}

function makeFakeTx(schemes: any[], allVariants: any[]) {
  return {
    scheme: {
      findMany: vi.fn().mockResolvedValue(schemes),
    },
    variant: {
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        const pid = where?.productId;
        const ors: any[] = where?.OR ?? [];
        return (
          allVariants.find((v) => {
            if (pid && v.productId !== pid) return false;
            return ors.some((cond) => {
              if (cond.unitWeightKg != null) return Number(v.unitWeightKg) === Number(cond.unitWeightKg);
              if (cond.unitSize?.contains) {
                return String(v.unitSize || "").toLowerCase().includes(String(cond.unitSize.contains).toLowerCase());
              }
              return false;
            });
          }) ?? null
        );
      }),
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => allVariants.find((v) => v.id === where?.id) ?? null),
    },
  } as any;
}

describe("Dynamic Trade Scheme Engine", () => {
  it("applies ZERO scheme benefits when schemes are deleted or inactive", async () => {
    const { broken, classic5x4, regular, excellent } = makeRiceCatalog();
    const tx = makeFakeTx([], [broken, classic5x4, regular, excellent]);
    const priceMap = new Map([
      [broken.id, 1539],
      [classic5x4.id, 1891],
      [regular.id, 1810],
      [excellent.id, 2907],
    ]);

    const res = await evaluateDynamicSchemesForOrder(
      tx,
      [
        { variantId: broken.id, qty: 2 },
        { variantId: classic5x4.id, qty: 3 },
        { variantId: regular.id, qty: 4 },
        { variantId: excellent.id, qty: 1 },
      ],
      [broken, classic5x4, regular, excellent],
      priceMap
    );

    expect(res.freeItems).toEqual([]);
    expect(res.appliedDiscounts).toEqual([]);
  });

  it("evaluates bag-wise category schemes strictly by bag count rather than KG weight", async () => {
    const { broken, classic5x4, regular } = makeRiceCatalog();
    const bagScheme = {
      ...activeWindow,
      id: "scheme-bag-10",
      name: "Buy 10 Bags Rice Get 1 Bag Free",
      headline: "Buy 10 Bags, Get 1 Bag Free",
      description: null,
      ruleType: "category_bags",
      qualifyingCategory: "Rice",
      minQuantity: 10,
      rewardType: "lowest_priced_category_sku",
      rewardValue: new Prisma.Decimal(1),
      freePackagingUnits: "bags",
    };

    // 10 bags of 20 kg = 200 kg (< 210 kg, yet 10 bags -> MUST qualify!)
    const tx = makeFakeTx([bagScheme], [broken, classic5x4, regular]);
    const priceMap = new Map([
      [broken.id, 1539],
      [classic5x4.id, 1891],
      [regular.id, 1810],
    ]);

    const res = await evaluateDynamicSchemesForOrder(
      tx,
      [
        { variantId: broken.id, qty: 2 },
        { variantId: classic5x4.id, qty: 8 },
      ],
      [broken, classic5x4, regular],
      priceMap
    );
    expect(res.freeItems).toHaveLength(1);
    expect(res.freeItems[0].variantId).toBe(broken.id);
    expect(res.freeItems[0].qtyOrdered).toBe(1);
    expect(res.freeItems[0].schemeCode).toBe("CATEGORY_BAGS_FREE_SKU");

    // 6 bags of 30 kg = 180 kg (or even 7 bags = 210 kg -> 7 < 10 bags -> MUST NOT qualify!)
    const resTooFewBags = await evaluateDynamicSchemesForOrder(
      tx,
      [{ variantId: broken.id, qty: 7 }],
      [broken, classic5x4, regular],
      priceMap
    );
    expect(resTooFewBags.freeItems).toEqual([]);
  });

  it("never skips the lowest-priced purchased SKU (Broken ₹51/kg) in favor of pricier 5kg SKUs (Classic ₹94/kg)", async () => {
    const { broken, classic5x4, regular, excellent } = makeRiceCatalog();
    const weightScheme = {
      ...activeWindow,
      id: "scheme-weight-210",
      name: "Rice 210 KG Scheme",
      headline: "Buy 210 kg, Get 10 kg Free",
      description: null,
      ruleType: "category_weight",
      qualifyingCategory: "Rice",
      qualifyingWeightKg: new Prisma.Decimal(210),
      rewardType: "lowest_priced_category_sku",
      rewardValue: new Prisma.Decimal(10),
      freePackagingUnits: "5,1",
    };

    const tx = makeFakeTx([weightScheme], [broken, classic5x4, regular, excellent]);
    const priceMap = new Map([
      [broken.id, 1539],
      [classic5x4.id, 1891],
      [regular.id, 1810],
      [excellent.id, 2907],
    ]);

    const res = await evaluateDynamicSchemesForOrder(
      tx,
      [
        { variantId: broken.id, qty: 2 },
        { variantId: classic5x4.id, qty: 3 },
        { variantId: regular.id, qty: 4 },
        { variantId: excellent.id, qty: 1 },
      ],
      [broken, classic5x4, regular, excellent],
      priceMap
    );

    expect(res.freeItems).toHaveLength(1);
    expect(res.freeItems[0].variantId).toBe(broken.id);
    expect(res.freeItems[0].variantName).toBe("Gagan Basmati Rice Broken");
    expect(res.freeItems[0].freeWeightKg).toBe(10);
  });

  it("does not multiply 5kg x 4 master bag cases into 40kg when granting 10kg free", async () => {
    const { classic5x4, excellent } = makeRiceCatalog();
    const weightScheme = {
      ...activeWindow,
      id: "scheme-weight-classic",
      name: "Rice 210 KG Scheme",
      headline: "Buy 210 kg, Get 10 kg Free",
      description: null,
      ruleType: "category_weight",
      qualifyingCategory: "Rice",
      qualifyingWeightKg: new Prisma.Decimal(210),
      rewardType: "lowest_priced_category_sku",
      rewardValue: new Prisma.Decimal(10),
      freePackagingUnits: "5,1",
    };

    const tx = makeFakeTx([weightScheme], [classic5x4, excellent]);
    const priceMap = new Map([
      [classic5x4.id, 1891],
      [excellent.id, 2907],
    ]);

    const res = await evaluateDynamicSchemesForOrder(
      tx,
      [
        { variantId: classic5x4.id, qty: 6 }, // 120 kg
        { variantId: excellent.id, qty: 3 }, // 90 kg -> total 210 kg
      ],
      [classic5x4, excellent],
      priceMap
    );

    expect(res.freeItems).toHaveLength(1);
    expect(res.freeItems[0].variantId).toBe(classic5x4.id);
    expect(res.freeItems[0].freeWeightKg).toBe(10);
    // 1 dispatch allocation representing 2 x 5 kg pouches (10 kg), NOT qtyOrdered=2 master cases (40 kg)
    expect(res.freeItems[0].qtyOrdered).toBe(1);
    expect(res.freeItems[0].packUnitKg).toBe(10);
    expect(res.freeItems[0].packDescription).toContain("2 × 5 KG");
  });
});
