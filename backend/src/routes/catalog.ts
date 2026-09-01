import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { DEFAULT_WAREHOUSE_CODE, INVENTORY_STALE_AFTER_MS } from "../modules/inventory/inventoryService";
import { publicMediaUrl } from "../lib/media";
import { groupCatalog } from "../modules/catalog/catalogGrouping";

const router = Router();

/** Resolve a retailer's effective price for a variant: override beats tier price. */
function priceResolver(
  priceList: { variantId: string; price: unknown }[],
  overrides: { variantId: string; price: unknown }[]
) {
  const tierPrices = new Map(priceList.map((p) => [p.variantId, Number(p.price)]));
  const overridePrices = new Map(overrides.map((o) => [o.variantId, Number(o.price)]));
  return (variantId: string) => {
    const override = overridePrices.get(variantId);
    return {
      price: override ?? tierPrices.get(variantId) ?? null,
      isOverride: override != null,
    };
  };
}

function shapeVariant(v: any, resolve: ReturnType<typeof priceResolver>, inventory?: any) {
  const { price, isOverride } = resolve(v.id);
  const caseWeightKg = Number(v.unitWeightKg) * v.unitsPerCase;
  return {
    id: v.id,
    unitSize: v.unitSize,
    unit: v.unit,
    unitsPerCase: v.unitsPerCase,
    caseWeightKg,
    price,
    isOverride,
    // Retailers compare commodities on rate per kg, and it's what the invoice
    // is priced on, so send it rather than making each client re-derive it.
    pricePerKg: price != null && caseWeightKg > 0 ? Math.round((price / caseWeightKg) * 100) / 100 : null,
    availability: inventory
      ? {
          available: Number(inventory.available),
          warehouseCode: inventory.warehouseCode,
          status:
            Date.now() - new Date(inventory.syncedAt).getTime() > INVENTORY_STALE_AFTER_MS
              ? "stale"
              : inventory.status,
          syncedAt: inventory.syncedAt,
        }
      : { available: null, warehouseCode: DEFAULT_WAREHOUSE_CODE, status: "unknown", syncedAt: null },
  };
}

router.get("/catalog", requireAuth, async (req: AuthedRequest, res) => {
  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const [products, priceList, overrides, config, inventory] = await Promise.all([
    prisma.product.findMany({ include: { variants: true }, orderBy: { createdAt: "asc" } }),
    prisma.priceList.findMany({ where: { tierId: retailer.tierId } }),
    prisma.priceOverride.findMany({ where: { retailerId: retailer.id } }),
    prisma.appConfig.findUnique({ where: { id: "singleton" } }),
    prisma.inventorySnapshot.findMany({ where: { warehouseCode: DEFAULT_WAREHOUSE_CODE } }),
  ]);

  const resolve = priceResolver(priceList, overrides);
  const inventoryByMaterial = new Map(inventory.map((snapshot) => [snapshot.sapMaterialId, snapshot]));

  const catalog = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    imageUrl: publicMediaUrl(req, product.imageUrl),
    description: product.description,
    variants: product.variants.map((v) => shapeVariant(v, resolve, product.sapMaterialId ? inventoryByMaterial.get(product.sapMaterialId) : undefined)),
  }));

  const categories = [...new Set(products.map((p) => p.category))].sort();

  // Pack sizes reach the catalogue two ways: several variants on one product,
  // and separate products sharing an ERP material. Grouping folds both into one
  // card per logical product so a shopper picks a pack instead of hunting for
  // the same product three times. The SKU stays the order unit throughout.
  const groups = groupCatalog(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      imageUrl: publicMediaUrl(req, product.imageUrl),
      description: product.description,
      sapMaterialId: product.sapMaterialId,
      variants: product.variants.map((v) =>
        shapeVariant(v, resolve, product.sapMaterialId ? inventoryByMaterial.get(product.sapMaterialId) : undefined)
      ),
    }))
  );

  res.json({
    catalog,
    groups,
    categories,
    tier: retailer.tierId,
    config: {
      freeDeliveryThreshold: Number(config?.freeDeliveryThreshold ?? 0),
      minOrderValue: Number(config?.minOrderValue ?? 0),
      supportPhone: config?.supportPhone ?? null,
    },
  });
});

/**
 * One logical product, with every pack it is sold in.
 *
 * The id may be any product in the group: a shopper following an old link, an
 * order line or a search result lands on the same card, with the pack they
 * asked for preselected, rather than on a near-duplicate page.
 */
router.get("/products/:id", requireAuth, async (req: AuthedRequest, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { variants: true },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  // Siblings are the other pack sizes the ERP calls the same material.
  const siblings = product.sapMaterialId
    ? await prisma.product.findMany({
        where: { sapMaterialId: product.sapMaterialId, category: product.category },
        include: { variants: true },
        orderBy: { createdAt: "asc" },
      })
    : [product];
  const members = siblings.length > 0 ? siblings : [product];

  const variantIds = members.flatMap((member) => member.variants.map((v) => v.id));
  const [priceList, overrides, config, inventory] = await Promise.all([
    prisma.priceList.findMany({ where: { tierId: retailer.tierId, variantId: { in: variantIds } } }),
    prisma.priceOverride.findMany({ where: { retailerId: retailer.id, variantId: { in: variantIds } } }),
    prisma.appConfig.findUnique({ where: { id: "singleton" } }),
    prisma.inventorySnapshot.findMany({ where: { warehouseCode: DEFAULT_WAREHOUSE_CODE } }),
  ]);

  const resolve = priceResolver(priceList, overrides);
  const inventoryByMaterial = new Map(inventory.map((snapshot) => [snapshot.sapMaterialId, snapshot]));

  const [group] = groupCatalog(
    members.map((member) => ({
      id: member.id,
      name: member.name,
      category: member.category,
      imageUrl: publicMediaUrl(req, member.imageUrl),
      description: member.description,
      sapMaterialId: member.sapMaterialId,
      variants: member.variants.map((v) =>
        shapeVariant(v, resolve, member.sapMaterialId ? inventoryByMaterial.get(member.sapMaterialId) : undefined)
      ),
    }))
  );

  const requestedSku = group.skus.find((sku) => sku.productId === product.id) ?? group.skus[0] ?? null;

  res.json({
    // The requested product's own identity is unchanged, so existing links and
    // order lines keep resolving exactly as before.
    id: product.id,
    name: group.name,
    category: product.category,
    imageUrl: group.imageUrl,
    description: group.description,
    variants: group.skus,
    /** Which pack to show selected when the screen opens. */
    selectedVariantId: requestedSku?.id ?? null,
    group: {
      id: group.id,
      productIds: group.productIds,
      hasMultiplePacks: group.hasMultiplePacks,
    },
    config: {
      freeDeliveryThreshold: Number(config?.freeDeliveryThreshold ?? 0),
      minOrderValue: Number(config?.minOrderValue ?? 0),
    },
  });
});

export default router;
