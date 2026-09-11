import { describe, expect, it } from "vitest";
import { visibleAttentionItems } from "../attentionFeed";

describe("visibleAttentionItems", () => {
  it("explains and de-duplicates overdue, opportunity and follow-up work", () => {
    const items = visibleAttentionItems({
      overdueRetailers: [{ id: "r1", name: "Sharma Store", overdue: 18400 }],
      opportunityActions: [
        { type: "COLLECTION_DUE", retailerId: "r1", headline: "Collect from Sharma Store" },
        { type: "ORDER_DUE", retailerId: "r2", headline: "Order due at Kaveri Mart", why: "Usual cycle is today" },
      ],
      followUps: [{ id: "a1", retailer: { id: "r3", name: "Patel Mart" }, notes: "Follow up on price list" }],
    });

    expect(items.map((item) => item.retailerId)).toEqual(["r1", "r2", "r3"]);
    expect(items[0].source).toBe("overdue");
    expect(items[2]).toMatchObject({ source: "follow_up", subtitle: "Follow up on price list" });
  });
});
