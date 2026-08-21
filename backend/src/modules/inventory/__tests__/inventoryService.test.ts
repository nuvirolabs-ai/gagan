import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import {
  DEFAULT_WAREHOUSE_CODE,
  inventoryForVariant,
  upsertInventorySnapshot,
  validateOrderInventory,
} from "../inventoryService";

const run = randomUUID();
const ids = { tier: `inventory-tier-${run}`, product: `inventory-product-${run}`, variant: `inventory-variant-${run}` };

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Inventory tier ${run}` } });
  await prisma.product.create({ data: { id: ids.product, name: `Inventory product ${run}`, category: "test", sapMaterialId: `MAT-${run}` } });
  await prisma.variant.create({ data: { id: ids.variant, productId: ids.product, unitSize: "1", unit: "case", unitsPerCase: 1, unitWeightKg: 1 } });
});

afterAll(async () => {
  await prisma.inventorySnapshot.deleteMany({ where: { productId: ids.product } });
  await prisma.variant.deleteMany({ where: { productId: ids.product } });
  await prisma.product.delete({ where: { id: ids.product } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("inventory availability", () => {
  it("allows sufficient and exact stock", async () => {
    await upsertInventorySnapshot(prisma, { productId: ids.product, variantId: ids.variant, sapMaterialId: `MAT-${run}`, warehouseCode: DEFAULT_WAREHOUSE_CODE, onHand: 5, committed: 1, syncedAt: new Date() });
    await expect(validateOrderInventory(prisma, [{ variantId: ids.variant, qty: 4 }])).resolves.toEqual(undefined);
    await expect(validateOrderInventory(prisma, [{ variantId: ids.variant, qty: 0 }])).resolves.toEqual(undefined);
  });

  it("rejects insufficient, missing, and stale stock", async () => {
    await expect(validateOrderInventory(prisma, [{ variantId: ids.variant, qty: 5 }])).rejects.toMatchObject({ code: "insufficient_inventory" });

    const missingProduct = await prisma.product.create({ data: { name: `Missing inventory ${run}`, category: "test" } });
    const missingVariant = await prisma.variant.create({ data: { productId: missingProduct.id, unitSize: "2", unit: "case", unitsPerCase: 1, unitWeightKg: 1 } });
    await expect(validateOrderInventory(prisma, [{ variantId: missingVariant.id, qty: 1 }])).rejects.toMatchObject({ code: "inventory_unavailable" });
    await prisma.variant.delete({ where: { id: missingVariant.id } });
    await prisma.product.delete({ where: { id: missingProduct.id } });

    await upsertInventorySnapshot(prisma, { productId: ids.product, variantId: ids.variant, sapMaterialId: `MAT-${run}`, warehouseCode: DEFAULT_WAREHOUSE_CODE, onHand: 5, committed: 0, syncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
    await expect(validateOrderInventory(prisma, [{ variantId: ids.variant, qty: 1 }])).rejects.toMatchObject({ code: "inventory_stale" });
  });

  it("is warehouse-aware and reports status", async () => {
    await upsertInventorySnapshot(prisma, { productId: ids.product, variantId: ids.variant, sapMaterialId: `MAT-${run}`, warehouseCode: "WH-002", onHand: 2, committed: 0, syncedAt: new Date() });
    const snapshot = await inventoryForVariant(prisma, ids.variant, new Date(), "WH-002");
    expect(snapshot).toMatchObject({ warehouseCode: "WH-002", available: 2, status: "low" });
  });
});
