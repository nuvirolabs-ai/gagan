import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { saveCatalogueSku, CatalogueSkuError, type CatalogueSkuInput } from "../saveCatalogueSku";
import { discountFromPrice, priceFromDiscount, resolveTierPrice } from "../cataloguePricing";
import { catalogueStatusWhere, retailerCommercialFields, withInventoryOrderability, catalogueOrderingState } from "../catalogueVisibility";
import { validProductCatalogueIdentity, validVariantCatalogueIdentity } from "../catalogueIdentity";
import { validateOrderInventory, InventoryValidationError } from "../../inventory/inventoryService";
import { applyImport, previewImport } from "../../imports/importService";

const run = randomUUID();
const actor = `sku-${run}`;
const createdProductIds: string[] = [];

function input(overrides: Partial<CatalogueSkuInput> = {}): CatalogueSkuInput {
  return {
    productName: `Gagan Single Row ${run}`,
    brandName: "Gagan",
    groupName: "Toor Dal",
    category: "Daal",
    packSize: "1",
    unit: "kg",
    unitsPerCase: 30,
    outerPack: "Bag",
    purchaseRate: 3000,
    purchaseRateBasis: "case",
    listRate: 3300,
    sellingRateBasis: "case",
    tiers: [],
    gstPercent: 5,
    routingClass: "LAXMI_TOOR",
    openingStockCases: 100,
    warehouseCode: "WH-001",
    active: true,
    ...overrides,
  };
}

async function priced(overrides: Partial<CatalogueSkuInput> = {}) {
  const tiers = await prisma.tier.findMany({ orderBy: { name: "asc" } });
  const body = input({
    tiers: tiers.map((tier) => ({ tierId: tier.id, price: tier.name.toLowerCase() === "gold" ? 3120 : tier.name.toLowerCase() === "silver" ? 3240 : 3300 })),
    ...overrides,
  });
  if (overrides.tiers) body.tiers = overrides.tiers;
  return body;
}

describe("catalogue pricing", () => {
  it("derives a tier price from discount and rejects a contradictory pair", () => {
    expect(priceFromDiscount(500, 10)).toBe(450);
    expect(discountFromPrice(500, 450)).toBe(10);
    expect(priceFromDiscount(500, 12)).toBe(440);
    expect(resolveTierPrice(500, null, 10)).toEqual({ ok: true, price: 450 });
    expect(resolveTierPrice(500, 450, 10).ok).toBe(true);
    expect(resolveTierPrice(500, 440, 10)).toMatchObject({ ok: false, code: "tier_price_discount_conflict" });
  });
});

describe("saveCatalogueSku", () => {
  const previousSap = process.env.SAP_MODE;
  process.env.SAP_MODE = "mock";

  afterAll(async () => {
    process.env.SAP_MODE = previousSap;
    if (!createdProductIds.length) return;
    await prisma.priceList.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.inventorySnapshot.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.auditEvent.deleteMany({ where: { OR: [{ subjectId: { in: createdProductIds } }, { actorStaffId: actor }] } });
    await prisma.variant.deleteMany({ where: { productId: { in: createdProductIds } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.importJob.deleteMany({ where: { actorStaffId: actor } });
  });

  it("saves an active SKU with identity, prices, purchase cost, GST, routing and stock", async () => {
    const saved = await saveCatalogueSku(await priced(), actor);
    createdProductIds.push(saved.productId);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: saved.productId }, include: { variants: { include: { priceList: true } } } });
    const variant = product.variants[0];
    expect(product.catalogStatus).toBe("active");
    expect(variant.catalogStatus).toBe("active");
    expect(validProductCatalogueIdentity(product.catalogKey, product.internalCode)).toBe(true);
    expect(validVariantCatalogueIdentity(variant.catalogKey, variant.internalCode)).toBe(true);
    expect(product.catalogIdentityBrand).toBe("GAGAN");
    expect(product.catalogIdentityGroup).toBe("TOOR DAL");
    expect(Number(variant.purchaseRate)).toBe(3000);
    expect(variant.purchaseRateBasis).toBe("case");
    expect(Number(variant.listRate)).toBe(3300);
    expect(variant.listRateBasis).toBe("case");
    expect(Number(variant.gstPercent)).toBe(5);
    expect(variant.routingClass).toBe("LAXMI_TOOR");
    expect(variant.sellingEntity).toBeNull();
    const tiers = await prisma.tier.findMany();
    expect(variant.priceList).toHaveLength(tiers.length);
    const gold = tiers.find((tier) => tier.name.toLowerCase() === "gold");
    const silver = tiers.find((tier) => tier.name.toLowerCase() === "silver");
    if (gold) expect(Number(variant.priceList.find((row) => row.tierId === gold.id)?.price)).toBe(3120);
    if (silver) expect(Number(variant.priceList.find((row) => row.tierId === silver.id)?.price)).toBe(3240);
    const stock = await prisma.inventorySnapshot.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(stock.sapMaterialId).toBeNull();
    expect(stock.internalMaterialId).toBe(variant.internalCode);
    expect(stock.warehouseCode).toBe("WH-001");
    expect(Number(stock.available)).toBe(100);
    expect(stock.source).toBe("staging_uat");
    const audit = await prisma.auditEvent.findFirst({ where: { subjectId: variant.id, action: "catalog.sku_saved" } });
    expect(audit).not.toBeNull();
    expect(retailerCommercialFields(variant)).not.toHaveProperty("purchaseRate");
    expect(retailerCommercialFields(variant)).not.toHaveProperty("listRate");
    for (const file of ["src/routes/catalog.ts", "src/routes/home.ts", "src/routes/rep.ts", "src/lib/orders.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("purchaseRate");
      expect(source).not.toContain("listRate");
    }
  });

  it("keeps the list rate after save, reload, and a tier-price edit", async () => {
    const saved = await saveCatalogueSku(await priced({ productName: `List reload ${run}` }), actor);
    createdProductIds.push(saved.productId);
    const reloaded = await prisma.variant.findUniqueOrThrow({ where: { id: saved.variantId }, include: { priceList: { include: { tier: true } } } });
    expect(Number(reloaded.listRate)).toBe(3300);
    expect(reloaded.listRateBasis).toBe("case");
    const gold = reloaded.priceList.find((row) => row.tier.name.toLowerCase() === "gold");
    const silver = reloaded.priceList.find((row) => row.tier.name.toLowerCase() === "silver");
    if (gold) expect(discountFromPrice(Number(reloaded.listRate), Number(gold.price))).toBe(5.45);
    if (silver) expect(discountFromPrice(Number(reloaded.listRate), Number(silver.price))).toBe(1.82);
    const editedTiers = (await priced()).tiers.map((tier) => tier.price === 3120 ? { ...tier, price: priceFromDiscount(3300, 10) } : tier);
    await saveCatalogueSku(await priced({ productName: `List reload ${run}`, variantId: saved.variantId, tiers: editedTiers, openingStockCases: null }), actor);
    const afterEdit = await prisma.variant.findUniqueOrThrow({ where: { id: saved.variantId }, include: { priceList: { include: { tier: true } } } });
    expect(Number(afterEdit.listRate)).toBe(3300);
    expect(afterEdit.listRateBasis).toBe("case");
    expect(afterEdit.catalogStatus).toBe("active");
    const editedGold = afterEdit.priceList.find((row) => row.tier.name.toLowerCase() === "gold");
    if (editedGold) expect(Number(editedGold.price)).toBe(2970);
    expect(afterEdit.priceList.every((row) => !("discountPercent" in row))).toBe(true);
  });

  it("keeps an inactive SKU out of the app catalogue", async () => {
    const saved = await saveCatalogueSku(await priced({ productName: `Hidden ${run}`, active: false, openingStockCases: 20 }), actor);
    createdProductIds.push(saved.productId);
    const visible = await prisma.product.findMany({ where: { id: saved.productId, catalogStatus: catalogueStatusWhere() } });
    expect(visible).toHaveLength(0);
    const variant = await prisma.variant.findUniqueOrThrow({ where: { id: saved.variantId } });
    expect(variant.catalogStatus).toBe("inactive");
    expect(withInventoryOrderability(catalogueOrderingState(variant.catalogStatus, "5", false), { available: 20, status: "available" }).orderable).toBe(false);
  });

  it("stays active and flips orderability with stock, without another approval", async () => {
    const saved = await saveCatalogueSku(await priced({ productName: `Stock ${run}`, openingStockCases: 0 }), actor);
    createdProductIds.push(saved.productId);
    const variant = await prisma.variant.findUniqueOrThrow({ where: { id: saved.variantId } });
    expect(variant.catalogStatus).toBe("active");
    const none = withInventoryOrderability(catalogueOrderingState("active", "5", false), { available: 0, status: "unavailable" });
    expect(none).toMatchObject({ orderable: false, orderingReason: "Out of stock" });
    await prisma.inventorySnapshot.updateMany({ where: { variantId: variant.id }, data: { onHand: 12, available: 12, status: "available" } });
    const variantAfter = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(variantAfter.catalogStatus).toBe("active");
    expect(withInventoryOrderability(catalogueOrderingState(variantAfter.catalogStatus, "5", false), { available: 12, status: "available" }).orderable).toBe(true);
    await prisma.inventorySnapshot.updateMany({ where: { variantId: variant.id }, data: { onHand: 0, available: 0, status: "unavailable" } });
    const stillActive = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(stillActive.catalogStatus).toBe("active");
    expect(withInventoryOrderability(catalogueOrderingState("active", "5", false), { available: 0, status: "unavailable" }).orderingReason).toBe("Out of stock");
    expect(withInventoryOrderability(catalogueOrderingState("active", "5", false), { available: null, status: "unknown" }).orderingReason).toBe("Stock unavailable");
    await expect(validateOrderInventory(prisma, [{ variantId: variant.id, qty: 1 }])).rejects.toBeInstanceOf(InventoryValidationError);
  });

  it("stores a blank image as the approved placeholder and an exact image as exact", async () => {
    const blank = await saveCatalogueSku(await priced({ productName: `Blank image ${run}`, openingStockCases: 1 }), actor);
    createdProductIds.push(blank.productId);
    const blankVariant = await prisma.variant.findUniqueOrThrow({ where: { id: blank.variantId } });
    expect(blankVariant.catalogImageStatus).toBe("placeholder");
    expect(blankVariant.catalogImageLabel).toBe("Image coming soon");
    expect(blankVariant.imageUrl).toBeNull();
    const exact = await saveCatalogueSku(await priced({ productName: `Exact image ${run}`, imageUrl: "https://example.test/toor.png", openingStockCases: 1 }), actor);
    createdProductIds.push(exact.productId);
    const exactVariant = await prisma.variant.findUniqueOrThrow({ where: { id: exact.variantId } });
    expect(exactVariant.catalogImageStatus).toBe("exact");
    expect(exactVariant.imageUrl).toBe("https://example.test/toor.png");
  });

  it("adds a pack without changing the product identity", async () => {
    const first = await saveCatalogueSku(await priced({ productName: `Packed ${run}`, openingStockCases: 4 }), actor);
    createdProductIds.push(first.productId);
    const before = await prisma.product.findUniqueOrThrow({ where: { id: first.productId } });
    const second = await saveCatalogueSku(await priced({ productId: first.productId, productName: `Packed ${run}`, packSize: "5", unitsPerCase: 1, openingStockCases: 2 }), actor);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: first.productId }, include: { variants: true } });
    expect(after.catalogKey).toBe(before.catalogKey);
    expect(after.internalCode).toBe(before.internalCode);
    expect(after.variants).toHaveLength(2);
    expect(after.variants.map((variant) => variant.catalogKey).every(Boolean)).toBe(true);
    expect(second.variantId).not.toBe(first.variantId);
  });

  it("rolls back the whole SKU when stock cannot be written", async () => {
    process.env.SAP_MODE = "live";
    const name = `Rollback ${run}`;
    await expect(saveCatalogueSku(await priced({ productName: name, openingStockCases: 5 }), actor)).rejects.toMatchObject({ code: "manual_stock_requires_staging_inventory" } as Partial<CatalogueSkuError>);
    process.env.SAP_MODE = "mock";
    expect(await prisma.product.findFirst({ where: { name } })).toBeNull();
  });

  it("applies a product-master row through the same save", async () => {
    const tiers = await prisma.tier.findMany({ orderBy: { name: "asc" } });
    const columns = tiers.map((tier) => `${tier.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}_price`);
    const header = ["product_name", "brand", "product_group", "category", "pack_size", "unit", "units_per_case", "outer_pack", "purchase_rate", "purchase_rate_basis", "list_rate", "selling_rate_basis", "gst_percent", ...columns, "opening_stock", "warehouse_code", "billing_rule", "active"];
    const name = `Imported ${run}`;
    const values = [name, "Gagan", "Toor Dal", "Daal", "1", "kg", "30", "Bag", "3000", "case", "3300", "case", "5", ...columns.map(() => "3300"), "8", "WH-001", "LAXMI_TOOR", "true"];
    const preview = await previewImport(prisma, { type: "products", fileName: `${run}.csv`, buffer: Buffer.from(`${header.join(",")}\n${values.join(",")}`), mode: "create_only", actorStaffId: actor });
    expect(preview.rows[0].errors).toEqual([]);
    const applied = await applyImport(prisma, preview.job.id, actor, true);
    const product = await prisma.product.findFirstOrThrow({ where: { name }, include: { variants: true } });
    createdProductIds.push(product.id);
    expect(product.catalogStatus).toBe("active");
    expect(product.variants[0].catalogKey).toBeTruthy();
    expect(Number(product.variants[0].purchaseRate)).toBe(3000);
    expect(applied.job.status).toBe("completed");
  });

  it("creates Gagan Final Single Row Test and lets stock change orderability without a status change", async () => {
    await prisma.tier.upsert({ where: { name: "Gold" }, update: {}, create: { name: "Gold" } });
    await prisma.tier.upsert({ where: { name: "Silver" }, update: {}, create: { name: "Silver" } });
    const name = "Gagan Final Single Row Test";
    const leftover = await prisma.product.findMany({ where: { name }, select: { id: true } });
    if (leftover.length) {
      const ids = leftover.map((product) => product.id);
      await prisma.priceList.deleteMany({ where: { productId: { in: ids } } });
      await prisma.inventorySnapshot.deleteMany({ where: { productId: { in: ids } } });
      await prisma.variant.deleteMany({ where: { productId: { in: ids } } });
      await prisma.product.deleteMany({ where: { id: { in: ids } } });
    }
    const saved = await saveCatalogueSku(await priced({ productName: name, openingStockCases: 100, warehouseCode: "WH-001", active: true }), actor);
    createdProductIds.push(saved.productId);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: saved.productId }, include: { variants: { include: { priceList: { include: { tier: true } } } } } });
    const variant = product.variants[0];
    expect(validProductCatalogueIdentity(product.catalogKey, product.internalCode)).toBe(true);
    expect(validVariantCatalogueIdentity(variant.catalogKey, variant.internalCode)).toBe(true);
    expect(Number(variant.purchaseRate)).toBe(3000);
    expect(variant.purchaseRateBasis).toBe("case");
    expect(Number(variant.listRate)).toBe(3300);
    expect(variant.listRateBasis).toBe("case");
    expect(Number(variant.priceList.find((row) => row.tier.name === "Gold")?.price)).toBe(3120);
    expect(Number(variant.priceList.find((row) => row.tier.name === "Silver")?.price)).toBe(3240);
    expect(Number(variant.gstPercent)).toBe(5);
    expect(variant.routingClass).toBe("LAXMI_TOOR");
    expect(product.catalogStatus).toBe("active");
    expect(variant.catalogStatus).toBe("active");
    const stock = await prisma.inventorySnapshot.findFirstOrThrow({ where: { variantId: variant.id, warehouseCode: "WH-001" } });
    expect(Number(stock.available)).toBe(100);
    expect(await prisma.auditEvent.count({ where: { subjectId: variant.id, action: "catalog.sku_saved" } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { subjectId: variant.id, action: "catalog.catalogue_published" } })).toBe(0);

    await prisma.inventorySnapshot.update({ where: { id: stock.id }, data: { onHand: 0, available: 0, status: "unavailable" } });
    const soldOut = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id }, include: { product: true } });
    expect(soldOut.catalogStatus).toBe("active");
    expect(soldOut.product.catalogStatus).toBe("active");
    expect(await prisma.product.count({ where: { id: product.id, catalogStatus: catalogueStatusWhere() } })).toBe(1);
    expect(withInventoryOrderability(catalogueOrderingState(soldOut.catalogStatus, soldOut.gstPercent?.toString() ?? null, soldOut.gstPendingOrderAllowed), { available: 0, status: "unavailable" })).toMatchObject({ orderable: false, orderingReason: "Out of stock" });

    await prisma.inventorySnapshot.update({ where: { id: stock.id }, data: { onHand: 40, available: 40, status: "available" } });
    const restocked = await prisma.variant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(restocked.catalogStatus).toBe("active");
    expect(withInventoryOrderability(catalogueOrderingState(restocked.catalogStatus, restocked.gstPercent?.toString() ?? null, restocked.gstPendingOrderAllowed), { available: 40, status: "available" }).orderable).toBe(true);
    expect(await prisma.auditEvent.count({ where: { subjectId: variant.id, action: "catalog.sku_saved" } })).toBe(1);
  });
});
