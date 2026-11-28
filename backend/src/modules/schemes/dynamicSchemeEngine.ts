import { Prisma, type PrismaClient } from "@prisma/client";

export interface DynamicFreeGoodsItem {
  schemeId: string;
  schemeCode: string;
  schemeName: string;
  schemeHeadline?: string;
  schemeDescription: string;
  variantId: string;
  variantName: string;
  packDescription: string;
  qtyOrdered: number; // number of bags / dispatch cases
  packUnitKg?: number;
  freeWeightKg?: number;
  qualifyingVariantIds: string[];
  routingClass: string | null;
}

export interface DynamicSchemeEvaluationResult {
  freeItems: DynamicFreeGoodsItem[];
  appliedDiscounts: Array<{
    schemeId: string;
    schemeName: string;
    discountAmount: number;
  }>;
  qualifiedSchemes?: Array<{
    schemeId: string;
    schemeName: string;
    headline: string;
    ruleType: string;
    summary: string;
  }>;
}

type SchemeVariantRecord = {
  id: string;
  productId: string;
  unitsPerCase: number;
  unitWeightKg: Prisma.Decimal;
  unitSize?: string;
  routingClass?: string | null;
  product: { id: string; name: string; category: string };
};

type QualifyingLine = {
  variantId: string;
  qty: number;
  caseWeightKg: number;
  totalWeightKg: number;
  pricePerCase: number;
  pricePerKg: number;
  productId: string;
  productName: string;
  variant: SchemeVariantRecord;
};

export function matchesCategory(productCategory: string, productName: string, targetCategory: string): boolean {
  const cat = (productCategory || "").toLowerCase();
  const name = (productName || "").toLowerCase();
  const target = (targetCategory || "").toLowerCase().trim();

  if (target === "all" || !target) return true;
  if (cat.includes(target) || name.includes(target)) return true;
  if (target === "rice" && (cat.includes("chawal") || name.includes("basmati") || name.includes("sehmat"))) return true;
  if (target === "daal" && (cat.includes("pulse") || name.includes("toor") || name.includes("moong") || name.includes("chana"))) return true;
  if (target === "oil" && (cat.includes("tel") || name.includes("mustard") || name.includes("soyabean"))) return true;
  return false;
}

function buildQualifyingLines(
  items: Array<{ variantId: string; qty: number }>,
  variantMap: Map<string, SchemeVariantRecord>,
  effectivePricePerCase: Map<string, number>,
  filterFn: (variant: SchemeVariantRecord) => boolean
): QualifyingLine[] {
  const out: QualifyingLine[] = [];
  for (const item of items) {
    const variant = variantMap.get(item.variantId);
    if (!variant || !filterFn(variant)) continue;
    const caseWeightKg = Number(variant.unitWeightKg) * (variant.unitsPerCase || 1);
    const totalWeightKg = caseWeightKg * item.qty;
    const pricePerCase = effectivePricePerCase.get(variant.id) ?? 0;
    const pricePerKg = caseWeightKg > 0 ? pricePerCase / caseWeightKg : Infinity;
    out.push({
      variantId: variant.id,
      qty: item.qty,
      caseWeightKg,
      totalWeightKg,
      pricePerCase,
      pricePerKg,
      productId: variant.productId,
      productName: variant.product.name,
      variant,
    });
  }
  return out;
}

async function resolveLowestPricedFreeReward(
  tx: Prisma.TransactionClient,
  scheme: {
    id: string;
    name: string;
    headline: string;
    description: string | null;
    rewardValue: Prisma.Decimal | null;
    freePackagingUnits: string | null;
  },
  matchingItems: QualifyingLine[],
  multiplier: number,
  isBagBasis: boolean
): Promise<DynamicFreeGoodsItem | null> {
  if (matchingItems.length === 0 || multiplier <= 0) return null;

  const pkgMode = (scheme.freePackagingUnits || (isBagBasis ? "bags" : "5,1")).trim().toLowerCase();
  const rewardValue = Number(scheme.rewardValue) || (pkgMode === "bags" ? 1 : 10);

  // Sort ascending: bag-wise prefers lowest ₹/bag (or tied ₹/kg); weight-wise prefers lowest ₹/kg.
  const sorted = [...matchingItems].sort((a, b) =>
    pkgMode === "bags"
      ? a.pricePerCase - b.pricePerCase || a.pricePerKg - b.pricePerKg
      : a.pricePerKg - b.pricePerKg || a.pricePerCase - b.pricePerCase
  );

  const cheapestLine = sorted[0];
  const minMetric = pkgMode === "bags" ? cheapestLine.pricePerCase : cheapestLine.pricePerKg;
  const tiedCheapest = sorted.filter((l) =>
    pkgMode === "bags" ? Math.abs(l.pricePerCase - minMetric) < 0.01 : Math.abs(l.pricePerKg - minMetric) < 0.01
  );

  // 1. Bag reward mode: exact cheapest purchased SKU in full bags.
  if (pkgMode === "bags") {
    const freeBags = Math.max(1, Math.round(multiplier * rewardValue));
    const v = cheapestLine.variant;
    const packLabel = v.unitSize ? `${v.unitSize} × ${v.unitsPerCase || 1}` : "1 Bag";
    const totalKg = Number((freeBags * cheapestLine.caseWeightKg).toFixed(3));
    return {
      schemeId: scheme.id,
      schemeCode: isBagBasis ? "CATEGORY_BAGS_FREE_SKU" : "CATEGORY_WEIGHT_FREE_SKU",
      schemeName: scheme.name,
      schemeHeadline: scheme.headline,
      schemeDescription:
        scheme.description ||
        `${freeBags} free bag${freeBags === 1 ? "" : "s"} of ${cheapestLine.productName} (${packLabel})`,
      variantId: cheapestLine.variantId,
      variantName: cheapestLine.productName,
      packDescription: `${freeBags} Bag${freeBags === 1 ? "" : "s"} (${packLabel})`,
      qtyOrdered: freeBags,
      packUnitKg: cheapestLine.caseWeightKg,
      freeWeightKg: totalKg,
      qualifyingVariantIds: matchingItems.map((m) => m.variantId),
      routingClass: v.routingClass ?? null,
    };
  }

  const freeWeightKg = multiplier * rewardValue;

  // 2. Weight reward mode: check if any of the tied-cheapest purchased products offer allowed small packaging
  //    WITHOUT jumping to a more expensive product (e.g. never skip ₹51/kg Broken for ₹94/kg Classic).
  const allowedPacks =
    pkgMode === "any"
      ? []
      : pkgMode
          .split(",")
          .map((p) => parseFloat(p.trim()))
          .filter((p) => !isNaN(p) && p > 0)
          .sort((a, b) => b - a);

  let selectedVariant: {
    id: string;
    unitSize: string;
    unitsPerCase: number;
    unitWeightKg: Prisma.Decimal;
    routingClass: string | null;
    product: { name: string };
  } | null = null;
  let chosenPackKg: number | null = null;

  if (allowedPacks.length > 0 && tx.variant?.findFirst) {
    for (const candidateItem of tiedCheapest) {
      for (const packKg of allowedPacks) {
        const candidate = await tx.variant.findFirst({
          where: {
            productId: candidateItem.productId,
            catalogStatus: "active",
            OR: [
              { unitWeightKg: packKg },
              { unitSize: { contains: `${packKg} KG`, mode: "insensitive" } },
            ],
          },
          include: { product: true },
        });
        if (candidate) {
          selectedVariant = candidate;
          chosenPackKg = packKg;
          break;
        }
      }
      if (selectedVariant) break;
    }
  }

  // Fallback directly to the cheapest purchased variant itself (never substitute a more expensive product).
  if (!selectedVariant) {
    const fallbackCaseKg = cheapestLine.caseWeightKg || 1;
    const isExactCases = freeWeightKg >= fallbackCaseKg && Math.abs(freeWeightKg % fallbackCaseKg) < 0.001;
    const qtyOrdered = isExactCases ? Math.round(freeWeightKg / fallbackCaseKg) : 1;
    const effectiveWeight = isExactCases ? freeWeightKg : freeWeightKg;
    const packDesc = cheapestLine.variant.unitSize
      ? `${effectiveWeight} KG Free (${cheapestLine.productName} · ${cheapestLine.variant.unitSize})`
      : `${effectiveWeight} KG Free (${cheapestLine.productName})`;

    return {
      schemeId: scheme.id,
      schemeCode: isBagBasis ? "CATEGORY_BAGS_FREE_SKU" : "CATEGORY_WEIGHT_FREE_SKU",
      schemeName: scheme.name,
      schemeHeadline: scheme.headline,
      schemeDescription: scheme.description || `${effectiveWeight} KG Free ${cheapestLine.productName}`,
      variantId: cheapestLine.variantId,
      variantName: cheapestLine.productName,
      packDescription: packDesc,
      qtyOrdered,
      packUnitKg: isExactCases ? fallbackCaseKg : effectiveWeight,
      freeWeightKg: effectiveWeight,
      qualifyingVariantIds: matchingItems.map((m) => m.variantId),
      routingClass: cheapestLine.variant.routingClass ?? null,
    };
  }

  const variantCaseKg = Number(selectedVariant.unitWeightKg) * (selectedVariant.unitsPerCase || 1);
  const unitKg = chosenPackKg || Number(selectedVariant.unitWeightKg) || 1;
  const retailPouchCount = Math.max(1, Math.round(freeWeightKg / unitKg));
  // Guard against multiplying qtyOrdered by unitsPerCase (e.g. 5kg x 4 = 20kg bag must not emit qtyOrdered=2 -> 40kg).
  const fullCases = variantCaseKg > 0 && freeWeightKg >= variantCaseKg ? Math.floor(freeWeightKg / variantCaseKg) : 0;
  const exactFullCases = variantCaseKg > 0 && Math.abs(freeWeightKg % variantCaseKg) < 0.001;
  const qtyOrdered = exactFullCases && fullCases >= 1 ? fullCases : Math.max(1, fullCases || 1);
  const packDescription =
    qtyOrdered === 1 && !exactFullCases
      ? `${retailPouchCount} × ${unitKg} KG pouches (${freeWeightKg} KG Free)`
      : `${qtyOrdered} Bag${qtyOrdered === 1 ? "" : "s"} (${selectedVariant.unitSize} × ${selectedVariant.unitsPerCase || 1} = ${freeWeightKg} KG Free)`;

  return {
    schemeId: scheme.id,
    schemeCode: isBagBasis ? "CATEGORY_BAGS_FREE_SKU" : "CATEGORY_WEIGHT_FREE_SKU",
    schemeName: scheme.name,
    schemeHeadline: scheme.headline,
    schemeDescription: scheme.description || `${freeWeightKg} KG Free ${selectedVariant.product.name}`,
    variantId: selectedVariant.id,
    variantName: selectedVariant.product.name,
    packDescription,
    qtyOrdered,
    packUnitKg: exactFullCases ? variantCaseKg : freeWeightKg,
    freeWeightKg,
    qualifyingVariantIds: matchingItems.map((m) => m.variantId),
    routingClass: selectedVariant.routingClass ?? null,
  };
}

async function resolveFixedFreeVariantReward(
  tx: Prisma.TransactionClient,
  scheme: {
    id: string;
    name: string;
    headline: string;
    description: string | null;
    rewardValue: Prisma.Decimal | null;
    freeVariantId: string | null;
  },
  schemeCode: string,
  qualifyingVariantIds: string[],
  multiplier: number
): Promise<DynamicFreeGoodsItem | null> {
  if (!scheme.freeVariantId || multiplier <= 0) return null;
  const freeVariant = await tx.variant.findUnique({
    where: { id: scheme.freeVariantId },
    include: { product: true },
  });
  if (!freeVariant) return null;

  const perSlab = Number(scheme.rewardValue);
  const freeCount = multiplier * (Number.isFinite(perSlab) && perSlab > 0 ? Math.round(perSlab) : 1);
  if (freeCount <= 0) return null;

  const caseWeightKg = Number(freeVariant.unitWeightKg) * (freeVariant.unitsPerCase || 1);
  const packLabel = freeVariant.unitSize ? `${freeVariant.unitSize} × ${freeVariant.unitsPerCase || 1}` : "Standard";
  return {
    schemeId: scheme.id,
    schemeCode,
    schemeName: scheme.name,
    schemeHeadline: scheme.headline,
    schemeDescription: scheme.description || `${freeCount} Bag${freeCount === 1 ? "" : "s"} Free ${freeVariant.product.name}`,
    variantId: freeVariant.id,
    variantName: freeVariant.product.name,
    packDescription: `${freeCount} Bag${freeCount === 1 ? "" : "s"} (${packLabel} · FOC)`,
    qtyOrdered: freeCount,
    packUnitKg: caseWeightKg,
    freeWeightKg: Number((freeCount * caseWeightKg).toFixed(3)),
    qualifyingVariantIds,
    routingClass: freeVariant.routingClass ?? null,
  };
}

export async function evaluateDynamicSchemesForOrder(
  tx: Prisma.TransactionClient,
  items: Array<{ variantId: string; qty: number }>,
  variantsWithProduct: SchemeVariantRecord[],
  effectivePricePerCase: Map<string, number>,
  retailerTierId?: string,
  retailerTerritory?: string
): Promise<DynamicSchemeEvaluationResult> {
  const now = new Date();
  const activeSchemes = await tx.scheme.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { createdAt: "desc" },
  });

  const variantMap = new Map(variantsWithProduct.map((v) => [v.id, v]));
  const freeItems: DynamicFreeGoodsItem[] = [];
  const appliedDiscounts: Array<{ schemeId: string; schemeName: string; discountAmount: number }> = [];
  const qualifiedSchemes: NonNullable<DynamicSchemeEvaluationResult["qualifiedSchemes"]> = [];

  for (const scheme of activeSchemes) {
    if (scheme.targetAudience === "tier" && scheme.targetTierId && scheme.targetTierId !== retailerTierId) {
      continue;
    }
    if (scheme.targetAudience === "territory" && scheme.targetTerritory && scheme.targetTerritory !== retailerTerritory) {
      continue;
    }

    let matchingItems: QualifyingLine[] = [];
    let multiplier = 0;
    let isBagBasis = false;
    let summary = "";

    if (scheme.ruleType === "category_weight" && scheme.qualifyingCategory && scheme.qualifyingWeightKg) {
      const targetCategory = scheme.qualifyingCategory;
      const thresholdWeightKg = Number(scheme.qualifyingWeightKg);
      matchingItems = buildQualifyingLines(
        items,
        variantMap,
        effectivePricePerCase,
        (v) =>
          matchesCategory(v.product.category, v.product.name, targetCategory) &&
          (!scheme.qualifyingVariantId || v.id === scheme.qualifyingVariantId)
      );
      const totalKg = matchingItems.reduce((sum, l) => sum + l.totalWeightKg, 0);
      if (thresholdWeightKg > 0 && totalKg >= thresholdWeightKg && matchingItems.length > 0) {
        multiplier = Math.floor(totalKg / thresholdWeightKg);
        summary = `${totalKg} kg ${targetCategory} (min ${thresholdWeightKg} kg)`;
      }
    } else if (scheme.ruleType === "category_bags" && scheme.qualifyingCategory && scheme.minQuantity) {
      isBagBasis = true;
      const targetCategory = scheme.qualifyingCategory;
      const minBags = scheme.minQuantity;
      matchingItems = buildQualifyingLines(
        items,
        variantMap,
        effectivePricePerCase,
        (v) =>
          matchesCategory(v.product.category, v.product.name, targetCategory) &&
          (!scheme.qualifyingVariantId || v.id === scheme.qualifyingVariantId)
      );
      const totalBags = matchingItems.reduce((sum, l) => sum + l.qty, 0);
      if (minBags > 0 && totalBags >= minBags && matchingItems.length > 0) {
        multiplier = Math.floor(totalBags / minBags);
        summary = `${totalBags} bag${totalBags === 1 ? "" : "s"} ${targetCategory} (min ${minBags} bags)`;
      }
    } else if (scheme.ruleType === "product_qty" && scheme.minQuantity) {
      isBagBasis = true;
      const minBags = scheme.minQuantity;
      matchingItems = buildQualifyingLines(items, variantMap, effectivePricePerCase, (v) => {
        if (scheme.qualifyingVariantId) return v.id === scheme.qualifyingVariantId;
        if (scheme.qualifyingCategory) return matchesCategory(v.product.category, v.product.name, scheme.qualifyingCategory);
        return true;
      });
      const qualifyingBags = matchingItems.reduce((sum, l) => sum + l.qty, 0);
      if (minBags > 0 && qualifyingBags >= minBags && matchingItems.length > 0) {
        multiplier = Math.floor(qualifyingBags / minBags);
        summary = `${qualifyingBags} bag${qualifyingBags === 1 ? "" : "s"} (min ${minBags} bags)`;
      }
    } else if ((scheme.ruleType === "order_value" || scheme.ruleType === "volume_slab") && Number(scheme.targetAmount) > 0) {
      const targetAmt = Number(scheme.targetAmount);
      matchingItems = buildQualifyingLines(items, variantMap, effectivePricePerCase, (v) =>
        scheme.qualifyingCategory ? matchesCategory(v.product.category, v.product.name, scheme.qualifyingCategory) : true
      );
      const subtotal = matchingItems.reduce((sum, l) => sum + l.pricePerCase * l.qty, 0);
      if (subtotal >= targetAmt && matchingItems.length > 0) {
        multiplier = 1;
        summary = `Order subtotal ₹${Math.round(subtotal)} (min ₹${Math.round(targetAmt)})`;
      }
    }

    if (multiplier <= 0) continue;

    const qualifyingIds = matchingItems.map((m) => m.variantId);
    if (scheme.rewardType === "lowest_priced_category_sku") {
      const rewardItem = await resolveLowestPricedFreeReward(tx, scheme, matchingItems, multiplier, isBagBasis);
      if (rewardItem) {
        freeItems.push(rewardItem);
        qualifiedSchemes.push({
          schemeId: scheme.id,
          schemeName: scheme.name,
          headline: scheme.headline,
          ruleType: scheme.ruleType,
          summary,
        });
      }
    } else if (scheme.rewardType === "free_goods" && scheme.freeVariantId) {
      const code =
        scheme.ruleType === "category_bags"
          ? "CATEGORY_BAGS_FIXED_SKU"
          : scheme.ruleType === "category_weight"
          ? "CATEGORY_WEIGHT_FIXED_SKU"
          : "PRODUCT_QTY_FREE_GOODS";
      const rewardItem = await resolveFixedFreeVariantReward(tx, scheme, code, qualifyingIds, multiplier);
      if (rewardItem) {
        freeItems.push(rewardItem);
        qualifiedSchemes.push({
          schemeId: scheme.id,
          schemeName: scheme.name,
          headline: scheme.headline,
          ruleType: scheme.ruleType,
          summary,
        });
      }
    } else if (scheme.rewardType === "flat_discount") {
      const amt = (Number(scheme.rewardValue ?? scheme.discountAmount) || 0) * multiplier;
      if (amt > 0) {
        appliedDiscounts.push({ schemeId: scheme.id, schemeName: scheme.name, discountAmount: amt });
        qualifiedSchemes.push({
          schemeId: scheme.id,
          schemeName: scheme.name,
          headline: scheme.headline,
          ruleType: scheme.ruleType,
          summary,
        });
      }
    } else if (scheme.rewardType === "percentage_discount") {
      const pct = Number(scheme.rewardValue) || 0;
      const base = matchingItems.reduce((sum, l) => sum + l.pricePerCase * l.qty, 0);
      const amt = Math.round(((base * pct) / 100) * 100) / 100;
      if (amt > 0) {
        appliedDiscounts.push({ schemeId: scheme.id, schemeName: scheme.name, discountAmount: amt });
        qualifiedSchemes.push({
          schemeId: scheme.id,
          schemeName: scheme.name,
          headline: scheme.headline,
          ruleType: scheme.ruleType,
          summary,
        });
      }
    }
  }

  return {
    freeItems,
    appliedDiscounts,
    qualifiedSchemes,
  };
}

export async function previewDynamicSchemesForBasket(
  db: PrismaClient | Prisma.TransactionClient,
  retailerId: string,
  items: Array<{ variantId: string; qty: number }>
): Promise<DynamicSchemeEvaluationResult> {
  if (!items.length) return { freeItems: [], appliedDiscounts: [], qualifiedSchemes: [] };
  const retailer = await db.retailer.findUnique({
    where: { id: retailerId },
    select: { tierId: true, deliveryCity: true },
  });
  if (!retailer) return { freeItems: [], appliedDiscounts: [], qualifiedSchemes: [] };

  const ids = [...new Set(items.map((i) => i.variantId))];
  const [variants, prices, overrides] = await Promise.all([
    db.variant.findMany({
      where: { id: { in: ids }, catalogStatus: "active" },
      include: { product: true },
    }),
    db.priceList.findMany({ where: { tierId: retailer.tierId, variantId: { in: ids } } }),
    db.priceOverride.findMany({ where: { retailerId, variantId: { in: ids } } }),
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.variantId, Number(o.price)]));
  const priceMap = new Map(prices.map((p) => [p.variantId, { price: Number(p.price), basis: p.rateBasis }]));
  const effectivePricePerCase = new Map<string, number>();

  for (const v of variants) {
    const raw = overrideMap.get(v.id) ?? priceMap.get(v.id)?.price ?? 0;
    const basis = overrideMap.has(v.id) ? "case" : priceMap.get(v.id)?.basis ?? v.listRateBasis ?? "case";
    const weight = Number(v.unitWeightKg) * (v.unitsPerCase || 1);
    const casePrice = basis === "quintal" ? raw * (weight / 100) : raw;
    effectivePricePerCase.set(v.id, casePrice);
  }

  return evaluateDynamicSchemesForOrder(
    db as Prisma.TransactionClient,
    items,
    variants,
    effectivePricePerCase,
    retailer.tierId || undefined,
    retailer.deliveryCity || undefined
  );
}
