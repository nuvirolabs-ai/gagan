/**
 * Presentation grouping for the catalogue.
 *
 * The order and inventory unit is the SKU — a `Variant` — and nothing here
 * changes that. This only decides which SKUs a shopper should see on one card
 * instead of hunting through three near-identical products for the pack they
 * want.
 *
 * The catalogue currently carries pack sizes two different ways: some products
 * hold several variants, and some pack sizes are separate products sharing one
 * ERP material. Both shapes are folded into the same result so the apps do not
 * have to know which is which.
 */

export interface GroupableVariant {
  id: string;
  unitSize: string;
  unit: string;
  unitsPerCase: number;
  price: number | null;
  isOverride?: boolean;
  pricePerKg?: number | null;
  caseWeightKg?: number;
  availability?: unknown;
}

export interface GroupableProduct {
  id: string;
  name: string;
  category: string;
  imageUrl?: string | null;
  description?: string | null;
  sapMaterialId?: string | null;
  variants: GroupableVariant[];
}

export interface SkuOption extends GroupableVariant {
  /** The product this SKU belongs to — unchanged, and still its ERP identity. */
  productId: string;
  productName: string;
  /** What the pack chip shows: "1 kg", "500 ml". */
  packLabel: string;
  /** The fuller description for the detail screen: "1 kg × 30". */
  packDetail: string;
}

export interface ProductGroup {
  /** Stable across requests; derived from the grouping key, not a stored id. */
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  description: string | null;
  /** Every product folded into this card, for traceability. */
  productIds: string[];
  skus: SkuOption[];
  /** True when this card genuinely offers a choice of pack. */
  hasMultiplePacks: boolean;
}

/**
 * Two products are the same logical product only when the ERP already says so
 * *and* they sit in the same category. Grouping on the material alone would
 * merge anything a material happens to be shared by; requiring the category as
 * well keeps the rule conservative.
 *
 * A product with no ERP material is never grouped with anything.
 */
export function groupingKeyFor(product: GroupableProduct): string {
  const material = product.sapMaterialId?.trim();
  return material ? `material:${product.category}:${material}` : `product:${product.id}`;
}

/**
 * The name the card shows. When several products are folded together their
 * names usually share a stem — "Gagan Toor Dal | 1 KG", "| 5 KG" — so the
 * common stem is the product and the rest is the pack.
 */
export function commonProductName(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0].trim();

  let prefix = names[0];
  for (const name of names.slice(1)) {
    let index = 0;
    while (index < prefix.length && index < name.length && prefix[index] === name[index]) index += 1;
    prefix = prefix.slice(0, index);
  }

  const trimmed = prefix.replace(/[\s|,\-–—/(]+$/u, "").trim();
  // A stem that has eaten the name is no name at all; fall back to the
  // shortest full name rather than showing a fragment.
  if (trimmed.length < 3) {
    return [...names].sort((a, b) => a.length - b.length)[0].trim();
  }
  return trimmed;
}

/**
 * Packs read smallest-first, which is how a shopper expects to scan them.
 * Sizes are converted to a common unit before comparing, because "500 ml" is
 * smaller than "1 L" however the raw numbers read.
 */
export function comparePacks(a: SkuOption, b: SkuOption): number {
  const sizeA = normalisedSize(a.unitSize);
  const sizeB = normalisedSize(b.unitSize);
  if (sizeA != null && sizeB != null && sizeA !== sizeB) return sizeA - sizeB;
  const weightA = a.caseWeightKg ?? null;
  const weightB = b.caseWeightKg ?? null;
  if (weightA != null && weightB != null && weightA !== weightB) return weightA - weightB;
  return a.packLabel.localeCompare(b.packLabel);
}

/** Sub-units are scaled to their base so magnitudes are comparable. */
const UNIT_SCALE: Record<string, number> = {
  mg: 0.000001,
  g: 0.001,
  gm: 0.001,
  gram: 0.001,
  kg: 1,
  ml: 0.001,
  l: 1,
  ltr: 1,
  litre: 1,
  liter: 1,
};

export function normalisedSize(unitSize: string): number | null {
  const match = unitSize.trim().match(/^([\d.]+)\s*([a-zA-Z]*)/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const scale = UNIT_SCALE[match[2].toLowerCase()] ?? 1;
  return amount * scale;
}

export function groupCatalog(products: readonly GroupableProduct[]): ProductGroup[] {
  const groups = new Map<string, GroupableProduct[]>();
  for (const product of products) {
    const key = groupingKeyFor(product);
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  const result: ProductGroup[] = [];
  for (const [key, members] of groups) {
    const skus: SkuOption[] = members.flatMap((product) =>
      product.variants.map((variant) => ({
        ...variant,
        productId: product.id,
        productName: product.name,
        packLabel: variant.unitSize,
        packDetail:
          variant.unitsPerCase > 1
            ? `${variant.unitSize} × ${variant.unitsPerCase}`
            : variant.unitSize,
      }))
    );
    skus.sort(comparePacks);

    // The first member with imagery and copy carries the card, so a group
    // never shows an empty tile because one pack lacks a photo.
    const withImage = members.find((product) => product.imageUrl) ?? members[0];
    const withDescription = members.find((product) => product.description) ?? members[0];

    result.push({
      id: key,
      name: commonProductName(members.map((product) => product.name)),
      category: members[0].category,
      imageUrl: withImage.imageUrl ?? null,
      description: withDescription.description ?? null,
      productIds: members.map((product) => product.id),
      skus,
      hasMultiplePacks: skus.length > 1,
    });
  }

  return result;
}

/** Finds the group a SKU belongs to, for deep links from an order line. */
export function groupContainingSku(
  groups: readonly ProductGroup[],
  variantId: string
): ProductGroup | null {
  return groups.find((group) => group.skus.some((sku) => sku.id === variantId)) ?? null;
}
