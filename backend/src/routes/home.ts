import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { financialSummaryFor } from "../modules/finance/financialSummary";
import { publicMediaUrl } from "../lib/media";
import { groupCatalog } from "../modules/catalog/catalogGrouping";

const router = Router();

const ACTIVE_ORDER_STATUSES = ["placed", "confirmed", "packed", "out_for_delivery"] as const;

// Everything the Home screen needs in one call — the design shows eight distinct
// data regions and separate endpoints would mean eight round-trips on open.
router.get("/home", requireAuth, async (req: AuthedRequest, res) => {
  const retailer = await prisma.retailer.findUnique({
    where: { id: req.retailerId },
    include: { salesRep: true, tier: true },
  });
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const now = new Date();
  const financialSummary = await financialSummaryFor(prisma, retailer.id, now);
  if (!financialSummary) return res.status(404).json({ error: "Retailer not found" });

  const [config, featuredScheme, activeSchemeCount, unreadCount, activeOrder, priceList, products] =
    await Promise.all([
      prisma.appConfig.findUnique({ where: { id: "singleton" } }),
      prisma.scheme.findFirst({
        where: { featured: true, active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      }),
      prisma.scheme.count({
        where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      }),
      prisma.notification.count({ where: { retailerId: retailer.id, read: false } }),
      prisma.order.findFirst({
        where: { retailerId: retailer.id, status: { in: [...ACTIVE_ORDER_STATUSES] } },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      }),
      prisma.priceList.findMany({ where: { tierId: retailer.tierId } }),
      prisma.product.findMany({ include: { variants: true }, orderBy: { createdAt: "asc" } }),
    ]);

  const overrides = await prisma.priceOverride.findMany({ where: { retailerId: retailer.id } });
  const priceByVariant = new Map(priceList.map((p) => [p.variantId, p.price]));
  const overrideByVariant = new Map(overrides.map((o) => [o.variantId, o.price]));

  const quickOrder = products.flatMap((product) =>
    product.variants.slice(0, 1).map((v) => ({
      productId: product.id,
      variantId: v.id,
      name: product.name,
      category: product.category,
      imageUrl: publicMediaUrl(req, product.imageUrl),
      unitSize: v.unitSize,
      unitsPerCase: v.unitsPerCase,
      casePrice: overrideByVariant.get(v.id) ?? priceByVariant.get(v.id) ?? null,
    }))
  );

  // Home shows products, not one card per pack: three Toor Dal pack products
  // used to fill the shelf three times over. Grouped, each logical product
  // appears once with its packs to choose from.
  const productGroups = groupCatalog(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      imageUrl: publicMediaUrl(req, product.imageUrl),
      description: product.description,
      sapMaterialId: product.sapMaterialId,
      variants: product.variants.map((v) => ({
        id: v.id,
        unitSize: v.unitSize,
        unit: v.unit,
        unitsPerCase: v.unitsPerCase,
        caseWeightKg: Number(v.unitWeightKg) * v.unitsPerCase,
        price: Number(overrideByVariant.get(v.id) ?? priceByVariant.get(v.id) ?? 0) || null,
        isOverride: overrideByVariant.get(v.id) != null,
      })),
    }))
  );

  // Scheme progress counts delivered value only — a scheme is earned on what was
  // actually fulfilled, so in-flight orders don't inflate it (and cancellations
  // can't claw back an already-unlocked discount).
  let schemeProgress = 0;
  if (featuredScheme) {
    const agg = await prisma.order.aggregate({
      _sum: { orderTotal: true },
      where: {
        retailerId: retailer.id,
        status: "delivered",
        createdAt: { gte: featuredScheme.startsAt, lte: featuredScheme.endsAt },
      },
    });
    schemeProgress = Number(agg._sum.orderTotal ?? 0);
  }

  const creditLimit = financialSummary.creditLimit;
  const used = financialSummary.creditUsed;

  res.json({
    retailer: {
      id: retailer.id,
      name: retailer.name,
      phone: retailer.phone,
      tier: retailer.tier.name,
    },
    salesRep: retailer.salesRep
      ? { name: retailer.salesRep.name, phone: retailer.salesRep.phone, photoUrl: retailer.salesRep.photoUrl }
      : null,
    credit: {
      outstanding: used,
      overdue: financialSummary.overdue,
      creditLimit,
      used,
      available: financialSummary.availableCredit,
      utilisationPct: creditLimit > 0 ? Math.round((used / creditLimit) * 100) : 0,
    },
    financialSummary,
    scheme: featuredScheme
      ? {
          name: featuredScheme.name,
          headline: featuredScheme.headline,
          targetAmount: Number(featuredScheme.targetAmount),
          discountAmount: Number(featuredScheme.discountAmount),
          progress: schemeProgress,
          remaining: Math.max(Number(featuredScheme.targetAmount) - schemeProgress, 0),
        }
      : null,
    quickOrder,
    productGroups,
    categories: [...new Set(products.map((product) => product.category))].sort(),
    activeOrder: activeOrder
      ? {
          id: activeOrder.id,
          orderNo: activeOrder.orderNo,
          status: activeOrder.status,
          orderTotal: Number(activeOrder.orderTotal),
          itemCount: activeOrder.items.length,
          createdAt: activeOrder.createdAt,
          expectedDeliveryAt: activeOrder.expectedDeliveryAt,
        }
      : null,
    config: {
      freeDeliveryThreshold: Number(config?.freeDeliveryThreshold ?? 0),
      minOrderValue: Number(config?.minOrderValue ?? 0),
      supportPhone: config?.supportPhone ?? null,
    },
    badges: { notifications: unreadCount, activeOffers: activeSchemeCount },
  });
});

export default router;
