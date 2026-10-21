export function formatOrderRef(order?: {
  sapExternalReference?: string | null;
  orderNo?: number | null;
} | null): string {
  if (!order) return "—";
  if (order.sapExternalReference) return order.sapExternalReference;
  if (order.orderNo == null) return "—";
  return `GGN-${String(order.orderNo).padStart(8, "0")}`;
}
