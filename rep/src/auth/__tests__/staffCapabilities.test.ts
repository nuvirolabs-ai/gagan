import { describe, expect, it } from "vitest";
import { staffCapabilities, workspaceTabs } from "../staffCapabilities";

const NONE = {
  canOrderForRetailers: false,
  canCollect: false,
  canApprove: false,
  canReviewRatings: false,
  canRunFieldDay: false,
  canViewTeamPerformance: false,
  canManageAttendance: false,
  canLogActivity: false,
  canCompleteTasks: false,
  canSubmitExpenses: false,
  canRaiseIssues: false,
  canSeeCustomerMap: false,
  canProposeRetailers: false,
  canRespondToSurveys: false,
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
    expect(staffCapabilities(["survey.respond"])).toMatchObject({ canRespondToSurveys: true });
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

  it("keeps Market Surveys navigation permission-aware", () => {
    expect(staffCapabilities([]).canRespondToSurveys).toBe(false);
    expect(staffCapabilities(["survey.respond"]).canRespondToSurveys).toBe(true);
  });

  it("exposes team performance only with its server permission and preserves personal capabilities", () => {
    expect(staffCapabilities(["performance.view_team"]).canViewTeamPerformance).toBe(true);
    expect(staffCapabilities(["route.execute", "performance.view_team"])).toMatchObject({
      canRunFieldDay: true,
      canViewTeamPerformance: true,
    });
    expect(staffCapabilities(["route.execute"]).canViewTeamPerformance).toBe(false);
  });

  it("keeps selling leaders personal-first and manager-only distinct", () => {
    const personal = ["order.create_for_retailer", "route.execute"];
    expect(workspaceTabs("sales", personal)).toEqual(["Today", "Retailers", "Activity", "More"]);
    expect(workspaceTabs("sales_leader", [...personal, "performance.view_team"])).toEqual(["Today", "Retailers", "Activity", "Team", "More"]);
    expect(workspaceTabs("manager_only", ["performance.view_team"])).toEqual(["Team", "More"]);
    expect(workspaceTabs("setup_required", [...personal, "performance.view_team"])).toEqual(["Setup", "More"]);
    expect(workspaceTabs("sales_leader", personal)).not.toContain("Team");
  });
});
