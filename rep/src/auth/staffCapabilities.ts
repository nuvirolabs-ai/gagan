export const StaffPermissions = {
  ORDER_CREATE_FOR_RETAILER: "order.create_for_retailer",
  COLLECTION_SUBMIT: "collection.submit",
  APPROVAL_SECOND_INVOICE: "approval.second_invoice",
  APPROVAL_THIRD_INVOICE: "approval.third_invoice",
  COLLECTION_CONFIRM: "collection.confirm",
  CREDIT_RATING_CONFIRM: "credit.rating_confirm",
  LEGAL_DECIDE: "legal.decide",
  ATTENDANCE_MANAGE_SELF: "attendance.manage_self",
  ROUTE_EXECUTE: "route.execute",
  ROUTE_MANAGE_SELF: "route.manage_self",
  PERFORMANCE_VIEW_TEAM: "performance.view_team",
  ACTIVITY_LOG: "activity.log",
  TASK_COMPLETE: "task.complete",
  EXPENSE_SUBMIT: "expense.submit",
  ISSUE_RAISE: "issue.raise",
  LOCATION_VIEW: "location.view",
  RETAILER_PROPOSE: "retailer.propose",
  SURVEY_RESPOND: "survey.respond",
} as const;

export function staffCapabilities(permissions: string[]) {
  const granted = new Set(permissions);
  return {
    canOrderForRetailers: granted.has(StaffPermissions.ORDER_CREATE_FOR_RETAILER),
    canCollect: granted.has(StaffPermissions.COLLECTION_SUBMIT),
    canApprove: [
      StaffPermissions.APPROVAL_SECOND_INVOICE,
      StaffPermissions.APPROVAL_THIRD_INVOICE,
      StaffPermissions.COLLECTION_CONFIRM,
      StaffPermissions.LEGAL_DECIDE,
    ].some((permission) => granted.has(permission)),
    canReviewRatings: granted.has(StaffPermissions.CREDIT_RATING_CONFIRM),
    // The field day: Today, the route and the activity timeline all hang off
    // this one capability, so a staff member without it never sees a half-built
    // workspace.
    canRunFieldDay: granted.has(StaffPermissions.ROUTE_EXECUTE),
    canManageOwnBeat: granted.has(StaffPermissions.ROUTE_MANAGE_SELF),
    canViewTeamPerformance: granted.has(StaffPermissions.PERFORMANCE_VIEW_TEAM),
    canManageAttendance: granted.has(StaffPermissions.ATTENDANCE_MANAGE_SELF),
    canLogActivity: granted.has(StaffPermissions.ACTIVITY_LOG),
    canCompleteTasks: granted.has(StaffPermissions.TASK_COMPLETE),
    canSubmitExpenses: granted.has(StaffPermissions.EXPENSE_SUBMIT),
    canRaiseIssues: granted.has(StaffPermissions.ISSUE_RAISE),
    canSeeCustomerMap: granted.has(StaffPermissions.LOCATION_VIEW),
    canProposeRetailers: granted.has(StaffPermissions.RETAILER_PROPOSE),
    // Market Surveys is a permission-backed destination. Keep the navigation
    // entry and the stack route behind the same server-issued capability.
    canRespondToSurveys: granted.has(StaffPermissions.SURVEY_RESPOND),
  };
}

export type WorkspaceMode = "sales" | "sales_leader" | "manager_only" | "setup_required" | "access_only";
export type WorkspaceTab = "Today" | "Retailers" | "Activity" | "Team" | "Setup" | "Work" | "Approvals" | "More";

export function resolveWorkspaceMode(
  serverMode: WorkspaceMode | undefined,
  permissions: string[],
  hasRep: boolean
): WorkspaceMode {
  if (serverMode) return serverMode;
  // A pre-upgrade offline identity has no server-verified dual-role state.
  // Preserve its personal shell, but do not infer a new Team workspace.
  if (hasRep && permissions.includes(StaffPermissions.ORDER_CREATE_FOR_RETAILER)) return "sales";
  if (permissions.includes(StaffPermissions.PERFORMANCE_VIEW_TEAM)) return "manager_only";
  return "access_only";
}

export function workspaceTabs(mode: WorkspaceMode, permissions: string[]): WorkspaceTab[] {
  const capabilities = staffCapabilities(permissions);
  if (mode === "setup_required") return ["Setup", "More"];
  if (mode === "manager_only") return capabilities.canViewTeamPerformance ? ["Team", "More"] : ["More"];
  const tabs: WorkspaceTab[] = [];
  if (mode === "sales" || mode === "sales_leader") {
    if (capabilities.canRunFieldDay) tabs.push("Today");
    if (capabilities.canOrderForRetailers) tabs.push("Retailers");
    if (capabilities.canRunFieldDay) tabs.push("Activity");
    if (mode === "sales_leader" && capabilities.canViewTeamPerformance) tabs.push("Team");
  } else {
    if (capabilities.canRunFieldDay) tabs.push("Today");
    if (capabilities.canOrderForRetailers) tabs.push("Retailers");
    else if (!capabilities.canRunFieldDay) tabs.push("Work");
    if (capabilities.canRunFieldDay) tabs.push("Activity");
  }
  if (capabilities.canApprove) tabs.push("Approvals");
  tabs.push("More");
  return tabs;
}
