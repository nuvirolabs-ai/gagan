import { describe, expect, it } from "vitest";
import { visibleAttentionItems } from "../attentionFeed";

describe("visibleAttentionItems", () => {
  it("keeps one overdue row when the same store also has COLLECTION_DUE", () => {
    const items = visibleAttentionItems({
      overdueRetailers: [{ id: "mahesh", name: "Mahesh Store", overdue: 40500 }],
      opportunityActions: [
        {
          type: "COLLECTION_DUE",
          retailerId: "mahesh",
          headline: "Mahesh Store",
          why: "₹40,500 overdue",
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      retailerId: "mahesh",
      source: "overdue",
      title: "Mahesh Store",
      overdue: 40500,
    });
  });

  it("still shows a different opportunity for the same store", () => {
    const items = visibleAttentionItems({
      overdueRetailers: [{ id: "mahesh", name: "Mahesh Store", overdue: 40500 }],
      opportunityActions: [
        {
          type: "VISIT_OVERDUE",
          retailerId: "mahesh",
          headline: "Visit Mahesh Store",
          why: "No visit this week",
        },
      ],
    });

    expect(items.map((item) => item.source)).toEqual(["overdue", "opportunity"]);
    expect(items[1].type).toBe("VISIT_OVERDUE");
  });
});
