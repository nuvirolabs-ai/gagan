import { describe, expect, it } from "vitest";
import { staffCapabilities } from "../staffCapabilities";

const NONE = {
  canOrderForRetailers: false,
  canCollect: false,
  canApprove: false,
  canReviewRatings: false,
  canRunFieldDay: false,
  canManageAttendance: false,
  canLogActivity: false,
  canCompleteTasks: false,
  canSubmitExpenses: false,
  canRaiseIssues: false,
  canSeeCustomerMap: false,
  canProposeRetailers: false,
};

describe("role-aware staff shell", () => {
  it("shows only server-authorized work areas", () => {
    expect(staffCapabilities(["collection.submit"])).toEqual({ ...NONE, canCollect: true });
    expect(staffCapabilities(["order.create_for_retailer"])).toEqual({
      ...NONE,
      canOrderForRetailers: true,
    });
    expect(staffCapabilities([])).toEqual(NONE);
    expect(staffCapabilities(["approval.second_invoice"])).toMatchObject({ canApprove: true });
    expect(staffCapabilities(["legal.decide"])).toMatchObject({ canApprove: true });
    expect(staffCapabilities(["credit.rating_confirm"])).toMatchObject({ canReviewRatings: true });
  });

  it("opens the field day only for the permissions that back it", () => {
    expect(staffCapabilities(["route.execute"])).toMatchObject({ canRunFieldDay: true });
    expect(staffCapabilities(["attendance.manage_self"])).toMatchObject({
      canManageAttendance: true,
      canRunFieldDay: false,
    });
    expect(staffCapabilities(["expense.submit"])).toMatchObject({ canSubmitExpenses: true });
    expect(staffCapabilities(["issue.raise"])).toMatchObject({ canRaiseIssues: true });
    expect(staffCapabilities(["location.view"])).toMatchObject({ canSeeCustomerMap: true });
    expect(staffCapabilities(["retailer.propose"])).toMatchObject({ canProposeRetailers: true });
  });

  it("gives a full salesperson the whole field workspace", () => {
    const salesperson = staffCapabilities([
      "order.create_for_retailer",
      "attendance.manage_self",
      "route.execute",
      "activity.log",
      "task.complete",
      "expense.submit",
      "issue.raise",
      "location.view",
      "retailer.propose",
    ]);
    expect(salesperson).toMatchObject({
      canOrderForRetailers: true,
      canRunFieldDay: true,
      canManageAttendance: true,
      canLogActivity: true,
      canCompleteTasks: true,
      canSubmitExpenses: true,
      canRaiseIssues: true,
      canSeeCustomerMap: true,
      canProposeRetailers: true,
    });
    // A salesperson still approves nothing.
    expect(salesperson.canApprove).toBe(false);
  });
});
