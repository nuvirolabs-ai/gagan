import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../../lib/prisma";
import { evaluateRiceScheme, isRiceCategoryOrName } from "../riceScheme";
import { Prisma } from "@prisma/client";

describe("Rice Scheme Evaluation", () => {
  it("detects rice categories and names correctly", () => {
    expect(isRiceCategoryOrName("Gagan Basmati Rice Rozana", "Rice")).toBe(true);
    expect(isRiceCategoryOrName("Sehmat G 11", "Rice")).toBe(true);
    expect(isRiceCategoryOrName("Gagan Toor Dal", "Pulses")).toBe(false);
  });

  it("applies Buy 210kg Rice Get 10kg Free on qualifying cart", async () => {
    // Find active Rozana 30kg variant
    const rozana30 = await prisma.variant.findFirst({
      where: {
        unitSize: "30 KG",
        product: { name: { contains: "Rozana" } },
      },
      include: { product: true, priceList: true },
    });
    expect(rozana30).toBeDefined();

    await prisma.$transaction(async (tx) => {
      // 7 bags of 30kg = 210 kg
      const items = [{ variantId: rozana30!.id, qty: 7 }];
      const variantsWithProduct = [rozana30!];
      const priceMap = new Map([[rozana30!.id, Number(rozana30!.priceList[0]?.price ?? 2685)]]);

      const result = await evaluateRiceScheme(tx, items, variantsWithProduct, priceMap);
      expect(result).not.toBeNull();
      expect(result?.eligible).toBe(true);
      expect(result?.totalRiceWeightKg).toBe(210);
      expect(result?.schemeMultiplier).toBe(1);
      expect(result?.freeWeightKg).toBe(10);
      expect(result?.packUnitKg).toBe(5);
      expect(result?.freePacksCount).toBe(2);
      expect(result?.schemeCode).toBe("RICE_210_FREE_10");
    });
  });

  it("returns null when total rice weight is less than 210kg", async () => {
    const rozana30 = await prisma.variant.findFirst({
      where: {
        unitSize: "30 KG",
        product: { name: { contains: "Rozana" } },
      },
      include: { product: true, priceList: true },
    });

    await prisma.$transaction(async (tx) => {
      // 6 bags of 30kg = 180 kg < 210 kg
      const items = [{ variantId: rozana30!.id, qty: 6 }];
      const variantsWithProduct = [rozana30!];
      const priceMap = new Map([[rozana30!.id, Number(rozana30!.priceList[0]?.price ?? 2685)]]);

      const result = await evaluateRiceScheme(tx, items, variantsWithProduct, priceMap);
      expect(result).toBeNull();
    });
  });

  it("calculates 20kg free for 420kg cart", async () => {
    const rozana30 = await prisma.variant.findFirst({
      where: {
        unitSize: "30 KG",
        product: { name: { contains: "Rozana" } },
      },
      include: { product: true, priceList: true },
    });

    await prisma.$transaction(async (tx) => {
      // 14 bags of 30kg = 420 kg
      const items = [{ variantId: rozana30!.id, qty: 14 }];
      const variantsWithProduct = [rozana30!];
      const priceMap = new Map([[rozana30!.id, Number(rozana30!.priceList[0]?.price ?? 2685)]]);

      const result = await evaluateRiceScheme(tx, items, variantsWithProduct, priceMap);
      expect(result).not.toBeNull();
      expect(result?.totalRiceWeightKg).toBe(420);
      expect(result?.schemeMultiplier).toBe(2);
      expect(result?.freeWeightKg).toBe(20);
      expect(result?.freePacksCount).toBe(4); // 4 x 5kg = 20kg
    });
  });
});
