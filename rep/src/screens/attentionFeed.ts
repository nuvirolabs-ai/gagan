/**
 * Presentation-only merge of overdue collections and opportunity actions.
 * The APIs stay separate; this stops the same overdue collection appearing
 * twice when the opportunity engine also emits COLLECTION_DUE for that store.
 */
export function visibleAttentionItems<
  TRetailer extends { id: string; name: string; overdue?: number },
  TAction extends { type: string; retailerId: string; headline: string; why?: string },
>(input: { overdueRetailers: TRetailer[]; opportunityActions: TAction[]; limit?: number }) {
  const limit = input.limit ?? 3;
  const overdueIds = new Set<string>();
  const items: Array<{
    key: string;
    retailerId: string;
    title: string;
    subtitle?: string;
    overdue?: number;
    source: "overdue" | "opportunity";
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

  return items;
}
