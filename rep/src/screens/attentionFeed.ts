/**
 * Presentation-only merge of overdue collections and opportunity actions.
 * The APIs stay separate; this stops the same overdue collection appearing
 * twice when the opportunity engine also emits COLLECTION_DUE for that store.
 */
export function visibleAttentionItems<
  TRetailer extends { id: string; name: string; overdue?: number },
  TAction extends { type: string; retailerId: string; headline: string; why?: string },
  TFollowUp extends { id: string; retailer?: { id: string; name: string } | null; notes?: string | null },
>(input: { overdueRetailers: TRetailer[]; opportunityActions: TAction[]; followUps?: TFollowUp[]; limit?: number }) {
  const limit = input.limit ?? 3;
  const overdueIds = new Set<string>();
  const items: Array<{
    key: string;
    retailerId: string;
    title: string;
    subtitle?: string;
    overdue?: number;
    source: "overdue" | "opportunity" | "follow_up";
    type?: string;
  }> = [];

  for (const retailer of input.overdueRetailers) {
    if (items.length >= limit) break;
    if (overdueIds.has(retailer.id)) continue;
    overdueIds.add(retailer.id);
    items.push({
      key: `overdue-${retailer.id}`,
      retailerId: retailer.id,
      title: retailer.name,
      overdue: retailer.overdue,
      source: "overdue",
    });
  }

  for (const action of input.opportunityActions) {
    if (items.length >= limit) break;
    if (action.type === "COLLECTION_DUE" && overdueIds.has(action.retailerId)) continue;
    items.push({
      key: `${action.type}-${action.retailerId}`,
      retailerId: action.retailerId,
      title: action.headline,
      subtitle: action.why,
      source: "opportunity",
      type: action.type,
    });
  }

  for (const followUp of input.followUps ?? []) {
    if (items.length >= limit) break;
    const retailerId = followUp.retailer?.id;
    if (!retailerId || overdueIds.has(retailerId) || items.some((item) => item.retailerId === retailerId)) continue;
    items.push({
      key: `follow-up-${followUp.id}`,
      retailerId,
      title: followUp.retailer?.name ?? "Customer follow-up",
      subtitle: followUp.notes ?? "Follow-up due",
      source: "follow_up",
      type: "FOLLOW_UP_DUE",
    });
  }

  return items;
}
