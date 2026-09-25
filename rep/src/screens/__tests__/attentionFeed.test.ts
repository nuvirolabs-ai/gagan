import { describe, expect, it } from "vitest";
import { visibleAttentionItems } from "../attentionFeed";

describe("visibleAttentionItems", () => {
  it("explains and de-duplicates overdue, opportunity, issue and follow-up work", () => {
    const items = visibleAttentionItems({
      overdueRetailers: [{ id: "r1", name: "Sharma Store", overdue: 18400 }],
      opportunityActions: [
        { type: "COLLECTION_DUE", retailerId: "r1", headline: "Collect from Sharma Store" },
        { type: "ORDER_DUE", retailerId: "r2", headline: "Order due at Kaveri Mart", why: "Usual cycle is today" },
      ],
      serviceIssues: [{ id: "i1", retailer: { id: "r3", name: "Patel Mart" }, description: "Damaged carton" }],
      followUps: [{ id: "a1", retailer: { id: "r4", name: "Arora Store" }, notes: "Follow up on price list" }],
    });

    expect(items.map((item) => item.retailerId)).toEqual(["r1", "r2", "r3"]);
    expect(items[0].source).toBe("overdue");
    expect(items[2]).toMatchObject({ source: "service_issue", subtitle: "Damaged carton" });

    const followUpItems = visibleAttentionItems({
      overdueRetailers: [],
      opportunityActions: [],
      followUps: [{ id: "a2", retailer: { id: "r5", name: "Mehta Store" }, notes: "Confirm new range" }],
    });
    expect(followUpItems[0]).toMatchObject({ source: "follow_up", subtitle: "Confirm new range" });
  });
});
