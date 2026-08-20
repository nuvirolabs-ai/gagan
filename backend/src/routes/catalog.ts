import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";

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

function shapeVariant(v: any, resolve: ReturnType<typeof priceResolver>) {
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
  };
}

router.get("/catalog", requireAuth, async (req: AuthedRequest, res) => {
  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const [products, priceList, overrides, config] = await Promise.all([
    prisma.product.findMany({ include: { variants: true }, orderBy: { createdAt: "asc" } }),
    prisma.priceList.findMany({ where: { tierId: retailer.tierId } }),
    prisma.priceOverride.findMany({ where: { retailerId: retailer.id } }),
    prisma.appConfig.findUnique({ where: { id: "singleton" } }),
  ]);

  const resolve = priceResolver(priceList, overrides);

  const catalog = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    imageUrl: product.imageUrl,
    variants: product.variants.map((v) => shapeVariant(v, resolve)),
  }));

  const categories = [...new Set(products.map((p) => p.category))].sort();

  res.json({
    catalog,
    categories,
    tier: retailer.tierId,
    config: {
      freeDeliveryThreshold: Number(config?.freeDeliveryThreshold ?? 0),
      minOrderValue: Number(config?.minOrderValue ?? 0),
      supportPhone: config?.supportPhone ?? null,
    },
  });
});

router.get("/products/:id", requireAuth, async (req: AuthedRequest, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { variants: true },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const retailer = await prisma.retailer.findUnique({ where: { id: req.retailerId } });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const variantIds = product.variants.map((v) => v.id);
  const [priceList, overrides, config] = await Promise.all([
    prisma.priceList.findMany({ where: { tierId: retailer.tierId, variantId: { in: variantIds } } }),
    prisma.priceOverride.findMany({ where: { retailerId: retailer.id, variantId: { in: variantIds } } }),
    prisma.appConfig.findUnique({ where: { id: "singleton" } }),
  ]);

  const resolve = priceResolver(priceList, overrides);

  res.json({
    id: product.id,
    name: product.name,
    category: product.category,
    imageUrl: product.imageUrl,
    variants: product.variants.map((v) => shapeVariant(v, resolve)),
    config: {
      freeDeliveryThreshold: Number(config?.freeDeliveryThreshold ?? 0),
      minOrderValue: Number(config?.minOrderValue ?? 0),
    },
  });
});

export default router;
