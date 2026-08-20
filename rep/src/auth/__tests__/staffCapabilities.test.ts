import { describe, expect, it } from "vitest";
import { staffCapabilities } from "../staffCapabilities";

describe("role-aware staff shell", () => {
  it("shows only server-authorized work areas", () => {
    expect(staffCapabilities(["collection.submit"])).toEqual({
      canOrderForRetailers: false,
      canCollect: true,
      canApprove: false,
      canReviewRatings: false,
    });
    expect(staffCapabilities(["order.create_for_retailer"])).toEqual({
      canOrderForRetailers: true,
      canCollect: false,
      canApprove: false,
      canReviewRatings: false,
    });
    expect(staffCapabilities([])).toEqual({
      canOrderForRetailers: false,
      canCollect: false,
      canApprove: false,
      canReviewRatings: false,
    });
    expect(staffCapabilities(["approval.second_invoice"])).toMatchObject({ canApprove: true });
    expect(staffCapabilities(["credit.rating_confirm"])).toMatchObject({ canReviewRatings: true });
  });
});
