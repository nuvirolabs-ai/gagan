type OrderAmount = {
  orderTotal: string | number | null;
  commercialSnapshot?: unknown;
  items?: Array<{ unitPrice: string | number | null; qtyOrdered: number | null }>;
};

export function hasOrderAmountMismatch(order: OrderAmount): boolean {
  if (order.commercialSnapshot != null || !order.items?.length || order.orderTotal == null) return false;
  const total = Number(order.orderTotal);
  if (!Number.isFinite(total)) return false;
  let itemCents = 0;
  for (const item of order.items) {
    if (item.unitPrice == null || item.qtyOrdered == null) return false;
    const price = Number(item.unitPrice);
    const quantity = Number(item.qtyOrdered);
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) return false;
    itemCents += Math.round(price * 100) * quantity;
  }
  return Math.abs(Math.round(total * 100) - itemCents) > 1;
}
