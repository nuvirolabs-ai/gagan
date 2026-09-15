export type SellingVisit = {
  id: string;
  retailerId: string;
  salespersonId: string;
  checkedInAt: string;
  checkedOutAt?: string | null;
  outcome?: string | null;
  outcomes?: string[];
};

/** The API owns visits and outcomes; missing completion reads must fail closed. */
export function currentSellingVisit(input: {
  visits: SellingVisit[];
  activities: { visitId?: string; type: string }[];
  orders: { createdAt: string }[];
  retailerId: string;
  staffId?: string;
  visitId?: string;
}) {
  const visit = input.visits.find(row =>
    row.retailerId === input.retailerId && row.salespersonId === input.staffId &&
    (!input.visitId || row.id === input.visitId) && !row.checkedOutAt);
  if (!visit || visit.outcome || visit.outcomes?.length) return null;
  if (input.activities.some(row => row.visitId === visit.id &&
    ["order_placed", "no_order", "shop_closed", "decision_maker_unavailable"].includes(row.type))) return null;
  if (input.orders.some(row => Date.parse(row.createdAt) >= Date.parse(visit.checkedInAt))) return null;
  return visit;
}

export function openCreatedOrder(
  result: { order?: { id: string }; approvalRequest?: unknown },
  replace: (screen: string, params: { orderId: string }) => void,
  acknowledge: (open: () => void) => void,
) {
  if (!result.order?.id) throw new Error("order_response_missing_id");
  const orderId = result.order.id;
  const open = () => replace("OrderDetail", { orderId });
  if (result.approvalRequest) acknowledge(open);
  else open();
}
