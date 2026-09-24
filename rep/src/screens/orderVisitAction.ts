type OrderContext = { retailerId: string; createdAt: string | Date };
type VisitContext = { id: string; retailerId: string; checkedInAt: string | Date; checkedOutAt?: string | Date | null };

export type OrderVisitAction =
  | { kind: "continue_visit"; visitId: string }
  | { kind: "visit_not_completed" }
  | { kind: "next_retailer" };

/** Order placement is an activity, never a visit-completion event. */
export function nextOrderVisitAction(order: OrderContext, visits: VisitContext[]): OrderVisitAction {
  const placedAt = new Date(order.createdAt).getTime();
  if (!Number.isFinite(placedAt)) return { kind: "visit_not_completed" };
  const matching = visits
    .filter((visit) => visit.retailerId === order.retailerId && new Date(visit.checkedInAt).getTime() <= placedAt)
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
  const active = matching.find((visit) => !visit.checkedOutAt);
  if (active) return { kind: "continue_visit", visitId: active.id };
  const completed = matching.some((visit) => visit.checkedOutAt && new Date(visit.checkedOutAt).getTime() >= placedAt);
  return completed ? { kind: "next_retailer" } : { kind: "visit_not_completed" };
}
