export function orderSourceLabel(order: {
  source?: string | null;
  placedBy?: string | null;
  creatorName?: string | null;
}) {
  return order.source === "SALESPERSON_APP" || order.placedBy === "rep"
    ? `Order punched by ${order.creatorName ?? "Salesperson"}`
    : "Order placed via Retailer App";
}

export function orderCreatedAtLabel(order: { createdAt?: string | Date | null }) {
  return order.createdAt
    ? new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Time unavailable";
}

export function proposalIntentSourceLabel(intent: {
  source?: string | null;
  creatorName?: string | null;
}) {
  return intent.source === "SALESPERSON_APP"
    ? `Order punched by ${intent.creatorName ?? "Salesperson"}`
    : "Order placed via Retailer App";
}
