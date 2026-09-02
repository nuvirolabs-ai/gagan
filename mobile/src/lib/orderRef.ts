/**
 * Human and SAP-facing order number. The outbox stores
 * `GGN-` + 8-digit `orderNo`; the UI must quote the same string.
 */
export function formatOrderRef(order: {
  sapExternalReference?: string | null;
  orderNo?: number | null;
}): string {
  if (order.sapExternalReference) return order.sapExternalReference;
  if (order.orderNo == null) return "—";
  return `GGN-${String(order.orderNo).padStart(8, "0")}`;
}
