import { Prisma } from "@prisma/client";
import { evaluateRiceScheme, RiceSchemeEvaluation } from "./riceScheme";

export interface DynamicFreeGoodsItem {
  schemeId: string;
  schemeCode: string;
  schemeName: string;
  schemeDescription: string;
  variantId: string;
  variantName: string;
  packDescription: string;
  qtyOrdered: number; // number of cases / packs
  packUnitKg?: number;
  freeWeightKg?: number;
}

export interface DynamicSchemeEvaluationResult {
  freeItems: DynamicFreeGoodsItem[];
  appliedDiscounts: Array<{
    schemeId: string;
    schemeName: string;
    discountAmount: number;
  }>;
  riceScheme?: RiceSchemeEvaluation;
}

function matchesCategory(productCategory: string, productName: string, targetCategory: string): boolean {
  const cat = (productCategory || "").toLowerCase();
  const name = (productName || "").toLowerCase();
  const target = (targetCategory || "").toLowerCase();

  if (target === "all" || !target) return true;
  if (cat.includes(target) || name.includes(target)) return true;
  if (target === "rice" && (cat.includes("chawal") || name.includes("basmati") || name.includes("sehmat"))) return true;
  if (target === "daal" && (cat.includes("pulse") || name.includes("toor") || name.includes("moong") || name.includes("chana"))) return true;
  if (target === "oil" && (cat.includes("tel") || name.includes("mustard") || name.includes("soyabean"))) return true;
  return false;
}

export async function evaluateDynamicSchemesForOrder(
  tx: Prisma.TransactionClient,
  items: Array<{ variantId: string; qty: number }>,
  variantsWithProduct: Array<{
    id: string;
    productId: string;
    unitsPerCase: number;
    unitWeightKg: Prisma.Decimal;
    unitSize?: string;
    product: { id: string; name: string; category: string };
  }>,
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

  let handledRiceViaDb = false;

  for (const scheme of activeSchemes) {
    // Audience filter
    if (scheme.targetAudience === "tier" && scheme.targetTierId && scheme.targetTierId !== retailerTierId) {
      continue;
    }
    if (scheme.targetAudience === "territory" && scheme.targetTerritory && scheme.targetTerritory !== retailerTerritory) {
      continue;
    }

    // 1. Category Total Weight Schemes (e.g. Buy 210 kg Rice -> Get 10 kg Free)
    if (scheme.ruleType === "category_weight" && scheme.qualifyingCategory && scheme.qualifyingWeightKg) {
      const targetCategory = scheme.qualifyingCategory;
      const thresholdWeightKg = Number(scheme.qualifyingWeightKg);

      const matchingItems: Array<{
        variantId: string;
        qty: number;
        caseWeightKg: number;
        totalWeightKg: number;
        pricePerKg: number;
        productId: string;
        productName: string;
      }> = [];

      let totalCategoryWeightKg = 0;

      for (const item of items) {
        const variant = variantMap.get(item.variantId);
        if (!variant) continue;
        if (!matchesCategory(variant.product.category, variant.product.name, targetCategory)) continue;

        const caseWeightKg = Number(variant.unitWeightKg) * variant.unitsPerCase;
        const itemTotalWeight = caseWeightKg * item.qty;
        totalCategoryWeightKg += itemTotalWeight;

        const casePrice = effectivePricePerCase.get(variant.id) ?? 0;
        const pricePerKg = caseWeightKg > 0 ? casePrice / caseWeightKg : Infinity;

        matchingItems.push({
          variantId: variant.id,
          qty: item.qty,
          caseWeightKg,
          totalWeightKg: itemTotalWeight,
          pricePerKg,
          productId: variant.productId,
          productName: variant.product.name,
        });
      }

      if (totalCategoryWeightKg >= thresholdWeightKg && matchingItems.length > 0) {
        const multiplier = Math.floor(totalCategoryWeightKg / thresholdWeightKg);

        if (scheme.rewardType === "lowest_priced_category_sku") {
          // Sort items by lowest price per kg
          matchingItems.sort((a, b) => a.pricePerKg - b.pricePerKg);
          const freeWeightKg = multiplier * (Number(scheme.rewardValue) || 10);

          // Allowed pack units (e.g. "1,5" -> parse to numbers [5, 1])
          const allowedPacks = (scheme.freePackagingUnits || "5,1")
            .split(",")
            .map((p) => parseFloat(p.trim()))
            .filter((p) => !isNaN(p) && p > 0)
            .sort((a, b) => b - a); // Try larger pack first (e.g. 5kg, then 1kg)

          let selectedVariant: {
            id: string;
            unitSize: string;
            unitsPerCase: number;
            unitWeightKg: Prisma.Decimal;
            product: { name: string };
          } | null = null;
          let chosenPackKg = allowedPacks[0] || 5;

          for (const item of matchingItems) {
            for (const packKg of allowedPacks) {
              const candidate = await tx.variant.findFirst({
                where: {
                  productId: item.productId,
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

          // Fallback if ordered products lack 5kg/1kg: pick lowest priced catalog variant in category
          if (!selectedVariant) {
            for (const packKg of allowedPacks) {
              const catalogVariant = await tx.variant.findFirst({
                where: {
                  catalogStatus: "active",
                  OR: [
                    { unitWeightKg: packKg },
                    { unitSize: { contains: `${packKg} KG`, mode: "insensitive" } },
                  ],
                  product: {
                    category: { contains: targetCategory, mode: "insensitive" },
                  },
                },
                include: { product: true },
              });
              if (catalogVariant) {
                selectedVariant = catalogVariant;
                chosenPackKg = packKg;
                break;
              }
            }
          }

          if (selectedVariant) {
            const freePacksCount = Math.max(1, Math.round(freeWeightKg / chosenPackKg));
            freeItems.push({
              schemeId: scheme.id,
              schemeCode: "CATEGORY_WEIGHT_FREE_SKU",
              schemeName: scheme.name,
              schemeDescription: scheme.description || `${freeWeightKg} KG Free ${selectedVariant.product.name}`,
              variantId: selectedVariant.id,
              variantName: selectedVariant.product.name,
              packDescription: `${freePacksCount} × ${chosenPackKg} KG (${freeWeightKg} KG Free Goods)`,
              qtyOrdered: freePacksCount,
              packUnitKg: chosenPackKg,
              freeWeightKg,
            });

            if (targetCategory.toLowerCase().includes("rice")) {
              handledRiceViaDb = true;
            }
          }
        } else if (scheme.rewardType === "free_goods" && scheme.freeVariantId) {
          const freeVariant = await tx.variant.findUnique({
            where: { id: scheme.freeVariantId },
            include: { product: true },
          });
          if (freeVariant) {
            const freeCount = multiplier * (Number(scheme.rewardValue) || 1);
            freeItems.push({
              schemeId: scheme.id,
              schemeCode: "CATEGORY_WEIGHT_FIXED_SKU",
              schemeName: scheme.name,
              schemeDescription: scheme.description || `${freeCount} Cases Free ${freeVariant.product.name}`,
              variantId: freeVariant.id,
              variantName: freeVariant.product.name,
              packDescription: `${freeCount} Cases Free Goods (FOC)`,
              qtyOrdered: freeCount,
            });
          }
        }
      }
    }

    // 2. Product Quantity Schemes (Buy X Cases -> Get Y Cases Free)
    else if (scheme.ruleType === "product_qty" && scheme.minQuantity && scheme.freeVariantId) {
      let qualifyingCount = 0;
      for (const item of items) {
        if (!scheme.qualifyingVariantId || item.variantId === scheme.qualifyingVariantId) {
          qualifyingCount += item.qty;
        }
      }

      if (qualifyingCount >= scheme.minQuantity) {
        const multiplier = Math.floor(qualifyingCount / scheme.minQuantity);
        const freeCount = multiplier * (Number(scheme.rewardValue) || 1);
        const freeVariant = await tx.variant.findUnique({
          where: { id: scheme.freeVariantId },
          include: { product: true },
        });

        if (freeVariant && freeCount > 0) {
          freeItems.push({
            schemeId: scheme.id,
            schemeCode: "PRODUCT_QTY_FREE_GOODS",
            schemeName: scheme.name,
            schemeDescription: scheme.description || `${freeCount} Case(s) Free ${freeVariant.product.name}`,
            variantId: freeVariant.id,
            variantName: freeVariant.product.name,
            packDescription: `${freeCount} Case(s) (FOC Scheme)`,
            qtyOrdered: freeCount,
          });
        }
      }
    }
  }

  // 3. Fallback: If no DB scheme handled Rice, evaluate riceScheme.ts for cluster testing safety
  let riceEval: RiceSchemeEvaluation | null = null;
  if (!handledRiceViaDb) {
    riceEval = await evaluateRiceScheme(tx, items, variantsWithProduct, effectivePricePerCase);
    if (riceEval) {
      freeItems.push({
        schemeId: "system-rice-scheme",
        schemeCode: riceEval.schemeCode,
        schemeName: riceEval.schemeName,
        schemeDescription: riceEval.schemeDescription,
        variantId: riceEval.freeVariantId,
        variantName: riceEval.freeVariantName,
        packDescription: `${riceEval.freePacksCount} × ${riceEval.packUnitKg} KG (${riceEval.freeWeightKg} KG Free Rice)`,
        qtyOrdered: riceEval.freePacksCount,
        packUnitKg: riceEval.packUnitKg,
        freeWeightKg: riceEval.freeWeightKg,
      });
    }
  }

  return {
    freeItems,
    appliedDiscounts,
    riceScheme: riceEval || undefined,
  };
}
