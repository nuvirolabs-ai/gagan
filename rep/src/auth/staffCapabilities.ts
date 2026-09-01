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
  ACTIVITY_LOG: "activity.log",
  TASK_COMPLETE: "task.complete",
  EXPENSE_SUBMIT: "expense.submit",
  ISSUE_RAISE: "issue.raise",
  LOCATION_VIEW: "location.view",
  RETAILER_PROPOSE: "retailer.propose",
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
    canManageAttendance: granted.has(StaffPermissions.ATTENDANCE_MANAGE_SELF),
    canLogActivity: granted.has(StaffPermissions.ACTIVITY_LOG),
    canCompleteTasks: granted.has(StaffPermissions.TASK_COMPLETE),
    canSubmitExpenses: granted.has(StaffPermissions.EXPENSE_SUBMIT),
    canRaiseIssues: granted.has(StaffPermissions.ISSUE_RAISE),
    canSeeCustomerMap: granted.has(StaffPermissions.LOCATION_VIEW),
    canProposeRetailers: granted.has(StaffPermissions.RETAILER_PROPOSE),
  };
}
