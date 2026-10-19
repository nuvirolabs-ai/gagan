import { Prisma } from "@prisma/client";

export interface RiceSchemeEvaluation {
  eligible: boolean;
  totalRiceWeightKg: number;
  schemeMultiplier: number;
  freeWeightKg: number;
  packUnitKg: 5 | 1;
  freePacksCount: number;
  freeVariantId: string;
  freeVariantName: string;
  freeVariantPack: string;
  schemeCode: string;
  schemeName: string;
  schemeDescription: string;
}

export function isRiceCategoryOrName(name: string, category: string): boolean {
  const cat = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();
  return (
    cat.includes("rice") ||
    n.includes("rice") ||
    cat === "chawal" ||
    n.includes("basmati") ||
    n.includes("sehmat")
  );
}

export async function evaluateRiceScheme(
  tx: Prisma.TransactionClient,
  items: Array<{ variantId: string; qty: number }>,
  variantsWithProduct: Array<{
    id: string;
    productId: string;
    unitsPerCase: number;
    unitWeightKg: Prisma.Decimal;
    product: { id: string; name: string; category: string };
  }>,
  effectivePricePerCase: Map<string, number>
): Promise<RiceSchemeEvaluation | null> {
  const variantMap = new Map(variantsWithProduct.map((v) => [v.id, v]));

  // 1. Identify rice items and calculate total weight
  const riceItems: Array<{
    variantId: string;
    qty: number;
    caseWeightKg: number;
    totalWeightKg: number;
    pricePerKg: number;
    productId: string;
    productName: string;
  }> = [];

  let totalRiceWeightKg = 0;

  for (const item of items) {
    const variant = variantMap.get(item.variantId);
    if (!variant) continue;
    if (!isRiceCategoryOrName(variant.product.name, variant.product.category)) continue;

    const caseWeightKg = Number(variant.unitWeightKg) * variant.unitsPerCase;
    const itemTotalWeight = caseWeightKg * item.qty;
    totalRiceWeightKg += itemTotalWeight;

    const casePrice = effectivePricePerCase.get(variant.id) ?? 0;
    const pricePerKg = caseWeightKg > 0 ? casePrice / caseWeightKg : Infinity;

    riceItems.push({
      variantId: variant.id,
      qty: item.qty,
      caseWeightKg,
      totalWeightKg: itemTotalWeight,
      pricePerKg,
      productId: variant.productId,
      productName: variant.product.name,
    });
  }

  // Scheme requires at least 210 kg
  if (totalRiceWeightKg < 210 || riceItems.length === 0) {
    return null;
  }

  const schemeMultiplier = Math.floor(totalRiceWeightKg / 210);
  const freeWeightKg = schemeMultiplier * 10;

  // 2. Sort purchased rice items by lowest price per kg
  riceItems.sort((a, b) => a.pricePerKg - b.pricePerKg);

  // 3. Find packaging for the free item:
  // "The free rice can be provided only in 1 kg or 5 kg packaging."
  // Try 5 kg packaging first (e.g. 2 bags of 5 kg = 10 kg).
  // Check each purchased rice product in order of lowest price per kg to see if it has 5kg or 1kg variant.
  let selectedVariant: {
    id: string;
    unitSize: string;
    unitsPerCase: number;
    unitWeightKg: Prisma.Decimal;
    product: { name: string };
  } | null = null;
  let packUnitKg: 5 | 1 = 5;

  for (const item of riceItems) {
    // Check 5kg first for this product
    const variant5kg = await tx.variant.findFirst({
      where: {
        productId: item.productId,
        catalogStatus: "active",
        OR: [
          { unitWeightKg: 5 },
          { unitSize: { contains: "5 KG", mode: "insensitive" } },
        ],
      },
      include: { product: true },
    });
    if (variant5kg) {
      selectedVariant = variant5kg;
      packUnitKg = 5;
      break;
    }

    // Check 1kg for this product
    const variant1kg = await tx.variant.findFirst({
      where: {
        productId: item.productId,
        catalogStatus: "active",
        OR: [
          { unitWeightKg: 1 },
          { unitSize: { contains: "1 KG", mode: "insensitive" } },
        ],
      },
      include: { product: true },
    });
    if (variant1kg) {
      selectedVariant = variant1kg;
      packUnitKg = 1;
      break;
    }
  }

  // If none of the purchased products have 1kg or 5kg packaging (e.g. only 30kg SKUs),
  // fallback to the lowest priced active 5kg rice variant in the catalog, or 1kg.
  if (!selectedVariant) {
    const fallback5kg = await tx.variant.findFirst({
      where: {
        catalogStatus: "active",
        product: {
          catalogStatus: "active",
          OR: [
            { category: { contains: "Rice", mode: "insensitive" } },
            { name: { contains: "Rice", mode: "insensitive" } },
          ],
        },
        OR: [
          { unitWeightKg: 5 },
          { unitSize: { contains: "5 KG", mode: "insensitive" } },
        ],
      },
      include: { product: true, priceList: true },
      orderBy: { priceList: { _count: "desc" } },
    });
    if (fallback5kg) {
      selectedVariant = fallback5kg;
      packUnitKg = 5;
    } else {
      const fallback1kg = await tx.variant.findFirst({
        where: {
          catalogStatus: "active",
          product: {
            catalogStatus: "active",
            OR: [
              { category: { contains: "Rice", mode: "insensitive" } },
              { name: { contains: "Rice", mode: "insensitive" } },
            ],
          },
          OR: [
            { unitWeightKg: 1 },
            { unitSize: { contains: "1 KG", mode: "insensitive" } },
          ],
        },
        include: { product: true },
      });
      if (fallback1kg) {
        selectedVariant = fallback1kg;
        packUnitKg = 1;
      }
    }
  }

  if (!selectedVariant) {
    return null;
  }

  const freePacksCount = Math.round(freeWeightKg / packUnitKg);
  const packDescription = `${freePacksCount} × ${packUnitKg} KG (${freeWeightKg} KG Free Rice)`;

  return {
    eligible: true,
    totalRiceWeightKg,
    schemeMultiplier,
    freeWeightKg,
    packUnitKg,
    freePacksCount,
    freeVariantId: selectedVariant.id,
    freeVariantName: selectedVariant.product.name,
    freeVariantPack: `${packUnitKg} KG`,
    schemeCode: "RICE_210_FREE_10",
    schemeName: "Rice Scheme (Buy 210kg Get 10kg Free)",
    schemeDescription: `Buy 210 kg rice, get 10 kg free. Order contains ${totalRiceWeightKg} kg rice -> Qualified for ${packDescription}.`,
  };
}
