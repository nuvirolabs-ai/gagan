/**
 * Last delivered order, presented for Home "Order again".
 *
 * Qty comes from the delivered order. Price does not: Home must never
 * reuse a historic unit price as the current price.
 */

export interface LastOrderSourceItem {
  variantId: string;
  qtyOrdered: number;
  variant: {
    unitSize: string;
    unitsPerCase: number;
    product: {
      id: string;
      name: string;
      category: string;
      imageUrl: string | null;
    };
  } | null;
}

export interface LastOrderSource {
  id: string;
  createdAt: Date;
  status: string;
  items: LastOrderSourceItem[];
}

export interface LastOrderItem {
  variantId: string;
  productId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  packLabel: string;
  packDetail: string;
  qty: number;
  /** Current selling price. Never the historic order unit price. */
  price: number;
}

export interface LastOrderView {
  id: string;
  createdAt: string;
  status: string;
  items: LastOrderItem[];
}

function packDetail(unitSize: string, unitsPerCase: number): string {
  return unitsPerCase > 1 ? `${unitSize} × ${unitsPerCase}` : unitSize;
}

/**
 * Build the Home last-order slice. Unpriced or missing SKUs are dropped so
 * "Add last order" cannot put a stale or unknown price in the cart.
 */
export function presentLastOrder(
  order: LastOrderSource | null,
  currentPriceByVariant: Map<string, number | null>,
  resolveImage: (url: string | null) => string | null
): LastOrderView | null {
  if (!order) return null;

  const items: LastOrderItem[] = [];
  for (const item of order.items) {
    if (!item.variant || item.qtyOrdered <= 0) continue;
    const price = currentPriceByVariant.get(item.variantId);
    if (price == null) continue;
    items.push({
      variantId: item.variantId,
      productId: item.variant.product.id,
      name: item.variant.product.name,
      category: item.variant.product.category,
      imageUrl: resolveImage(item.variant.product.imageUrl),
      packLabel: item.variant.unitSize,
      packDetail: packDetail(item.variant.unitSize, item.variant.unitsPerCase),
      qty: item.qtyOrdered,
      price,
    });
  }

  if (items.length === 0) return null;

  return {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    items,
  };
}
