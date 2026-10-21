import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { DEFAULT_WAREHOUSE_CODE, INVENTORY_STALE_AFTER_MS, selectInventorySnapshot } from "../modules/inventory/inventoryService";
import { publicMediaUrl } from "../lib/media";
import { groupCatalog } from "../modules/catalog/catalogGrouping";
import { catalogueImageState, catalogueOrderingState, catalogueStatusWhere, retailerCommercialFields, withInventoryOrderability } from "../modules/catalog/catalogueVisibility";

const router = Router();

/** Resolve a retailer's effective price for a variant: override beats tier price. */
function priceResolver(
  priceList: { variantId: string; price: unknown; rateBasis?:string }[],
  overrides: { variantId: string; price: unknown; rateBasis?:string }[]
) {
  const tierPrices = new Map(priceList.map((p) => [p.variantId, Number(p.price)]));
  const overridePrices = new Map(overrides.map((o) => [o.variantId, Number(o.price)]));
  return (variantId: string) => {
    const override = overridePrices.get(variantId);
    return {
      price: override ?? tierPrices.get(variantId) ?? null,
      isOverride: override != null,
      rateBasis: (overrides.find(p=>p.variantId===variantId) ?? priceList.find(p=>p.variantId===variantId))?.rateBasis ?? "case",
    };
  };
}

function shapeVariant(v: any, resolve: ReturnType<typeof priceResolver>, inventory?: any, req?: AuthedRequest, fallbackImageUrl?: string | null, discount = 0, discountType: "flat" | "percent" = "flat") {
  const { price:rate, isOverride,rateBasis } = resolve(v.id);
  const caseWeightKg = Number(v.unitWeightKg) * v.unitsPerCase;
  const basePrice = rate === null ? null : rateBasis === "quintal" ? Math.round(rate * caseWeightKg) / 100 : rate;
  let effectivePrice = basePrice;
  if (basePrice != null && discount > 0) {
    if (discountType === "percent") {
      const pct = Math.min(100, Math.max(0, discount));
      effectivePrice = Math.round((basePrice * (1 - pct / 100)) * 100) / 100;
    } else {
      effectivePrice = Math.max(0, Math.round((basePrice - discount) * 100) / 100);
    }
  }
  const availability = {
    available: 999999,
    warehouseCode: DEFAULT_WAREHOUSE_CODE,
    status: "available",
    syncedAt: new Date(),
  };
  return {
    id: v.id,
    imageUrl: req ? publicMediaUrl(req, v.imageUrl ?? fallbackImageUrl) : (v.imageUrl ?? fallbackImageUrl),
    unitSize: v.unitSize,
    unit: v.unit,
    unitsPerCase: v.unitsPerCase,
    caseWeightKg,
    commercialRate:rate,rateBasis,...retailerCommercialFields(v),
    discount,
    discountType,
    originalPrice: basePrice,
    price: effectivePrice,
    isOverride,
    catalogStatus: v.catalogStatus,
    ...withInventoryOrderability(catalogueOrderingState(v.catalogStatus, v.gstPercent?.toString() ?? null, v.gstPendingOrderAllowed), availability),
    ...catalogueImageState(v),
    rateLabel: (() => {
      if (rate === null) return null;
      const gst = v.gstPercent == null ? null : Number(v.gstPercent);
      const gstLabel = gst != null && Number.isFinite(gst) ? (gst === 0 ? "Including 0% GST (Nil)" : `Including ${gst}% GST`) : "Excluding GST";
      return `${rateBasis === "quintal" ? "per quintal" : "per case"} · ${gstLabel}`;
    })(),
    pricePerKg: effectivePrice != null && caseWeightKg > 0 ? Math.round((effectivePrice / caseWeightKg) * 100) / 100 : null,
    availability,
  };
}

router.get("/catalog", requireAuth, async (req: AuthedRequest, res) => {
  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const [products, priceList, overrides, config, inventory, drafts] = await Promise.all([
    prisma.product.findMany({
      where: { catalogStatus: catalogueStatusWhere(), variants: { some: { catalogStatus: catalogueStatusWhere() } } },
      include: { variants: { where: { catalogStatus: catalogueStatusWhere() } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.priceList.findMany({ where: { tierId: retailer.tierId } }),
    prisma.priceOverride.findMany({ where: { retailerId: retailer.id } }),
    prisma.appConfig.findUnique({ where: { id: "singleton" } }),
    prisma.inventorySnapshot.findMany({ where: { warehouseCode: DEFAULT_WAREHOUSE_CODE } }),
    prisma.catalogOrderingDraft.findMany(),
  ]);

  const resolve = priceResolver(priceList, overrides);
  const draftsMap = new Map((drafts || []).map((d) => {
    const val = (d.values as any) || {};
    return [d.variantId, {
      discount: Number(val.discount || 0),
      discountType: (val.discountType === "percent" ? "percent" : "flat") as "flat" | "percent",
    }];
  }));

  const catalog = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    imageUrl: publicMediaUrl(req, product.imageUrl),
    description: product.description,
    variants: product.variants.map((v) => {
      const draft = draftsMap.get(v.id);
      return shapeVariant(v, resolve, selectInventorySnapshot(product, v, inventory), req, product.imageUrl, draft?.discount ?? 0, draft?.discountType ?? "flat");
    }),
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
      variants: product.variants.map((v) => {
        const draft = draftsMap.get(v.id);
        return shapeVariant(v, resolve, selectInventorySnapshot(product, v, inventory), req, product.imageUrl, draft?.discount ?? 0, draft?.discountType ?? "flat");
      }),
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
    where: { id: req.params.id, catalogStatus: { in: ["active", "published"] } },
    include: { variants: { where: { catalogStatus: { in: ["active", "published"] } } } },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  // Siblings are the other pack sizes the ERP calls the same material.
  const siblings = product.sapMaterialId
    ? await prisma.product.findMany({
        where: { sapMaterialId: product.sapMaterialId, category: product.category, catalogStatus: { in: ["active", "published"] }, variants: { some: { catalogStatus: { in: ["active", "published"] } } } },
        include: { variants: { where: { catalogStatus: { in: ["active", "published"] } } } },
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

  const [group] = groupCatalog(
    members.map((member) => ({
      id: member.id,
      name: member.name,
      category: member.category,
      imageUrl: publicMediaUrl(req, member.imageUrl),
      description: member.description,
      sapMaterialId: member.sapMaterialId,
      variants: member.variants.map((v) =>
        shapeVariant(v, resolve, selectInventorySnapshot(member, v, inventory), req)
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
