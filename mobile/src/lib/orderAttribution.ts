export function orderAttributionLabel(order: {
  source?: string | null;
  placedBy?: string | null;
  creatorName?: string | null;
}) {
  return order.source === "SALESPERSON_APP" || order.placedBy === "rep"
    ? `Order punched by ${order.creatorName ?? "Salesperson"}`
    : "Order placed via Retailer App";
}
