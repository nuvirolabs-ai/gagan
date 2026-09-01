export const Permissions = {
  ORDER_CREATE_FOR_RETAILER: "order.create_for_retailer",
  KYC_SUBMIT: "kyc.submit",
  KYC_VIEW: "kyc.view",
  KYC_REVIEW: "kyc.review",
  APPROVAL_SECOND_INVOICE: "approval.second_invoice",
  APPROVAL_THIRD_INVOICE: "approval.third_invoice",
  CREDIT_RATING_CONFIRM: "credit.rating_confirm",
  CREDIT_BLOCK: "credit.block",
  COLLECTION_SUBMIT: "collection.submit",
  COLLECTION_CONFIRM: "collection.confirm",
  RECOVERY_VIEW: "recovery.view",
  RECOVERY_UPDATE: "recovery.update",
  FINANCIAL_CORRECT: "financial.correct",
  DISPATCH_EXECUTE: "dispatch.execute",
  LEGAL_DECIDE: "legal.decide",
  STAFF_MANAGE: "staff.manage",
  LOCATION_VIEW: "location.view",
  LOCATION_CAPTURE: "location.capture",
  LOCATION_VERIFY: "location.verify",
  VISIT_VIEW: "visit.view",
  // Field operations. Each of these is a distinct governance boundary: doing
  // your own day, versus reviewing somebody else's.
  ATTENDANCE_MANAGE_SELF: "attendance.manage_self",
  ATTENDANCE_REVIEW: "attendance.review",
  ROUTE_EXECUTE: "route.execute",
  ROUTE_MANAGE: "route.manage",
  ACTIVITY_LOG: "activity.log",
  TASK_COMPLETE: "task.complete",
  EXPENSE_SUBMIT: "expense.submit",
  EXPENSE_REVIEW: "expense.review",
  ISSUE_RAISE: "issue.raise",
  ISSUE_REVIEW: "issue.review",
  // Customer-master governance: proposing a store is field work, admitting it
  // to the master is not.
  RETAILER_PROPOSE: "retailer.propose",
  RETAILER_PROPOSAL_REVIEW: "retailer.proposal_review",
  // Reading a team's performance, as opposed to your own.
  PERFORMANCE_VIEW_TEAM: "performance.view_team",
} as const;

export type PermissionName = (typeof Permissions)[keyof typeof Permissions];

export interface RoleDefinition {
  name: string;
  description: string;
  permissions: PermissionName[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: "salesperson",
    description: "Manages assigned retailers, KYC capture, retailer orders and their own field day.",
    permissions: [
      Permissions.ORDER_CREATE_FOR_RETAILER,
      Permissions.KYC_SUBMIT,
      Permissions.RECOVERY_VIEW,
      Permissions.RECOVERY_UPDATE,
      Permissions.LOCATION_VIEW,
      Permissions.LOCATION_CAPTURE,
      Permissions.LOCATION_VERIFY,
      Permissions.VISIT_VIEW,
      Permissions.ATTENDANCE_MANAGE_SELF,
      Permissions.ROUTE_EXECUTE,
      Permissions.ACTIVITY_LOG,
      Permissions.TASK_COMPLETE,
      Permissions.EXPENSE_SUBMIT,
      Permissions.ISSUE_RAISE,
      Permissions.RETAILER_PROPOSE,
    ],
  },
  {
    name: "field_collector",
    description: "Visits assigned retailers, submits collection evidence and runs their own field day.",
    permissions: [
      Permissions.COLLECTION_SUBMIT,
      Permissions.RECOVERY_VIEW,
      Permissions.RECOVERY_UPDATE,
      Permissions.LOCATION_VIEW,
      Permissions.LOCATION_CAPTURE,
      Permissions.LOCATION_VERIFY,
      Permissions.VISIT_VIEW,
      Permissions.ATTENDANCE_MANAGE_SELF,
      Permissions.ROUTE_EXECUTE,
      Permissions.ACTIVITY_LOG,
      Permissions.TASK_COMPLETE,
      Permissions.EXPENSE_SUBMIT,
      Permissions.ISSUE_RAISE,
      Permissions.RETAILER_PROPOSE,
    ],
  },
  {
    name: "credit_team",
    description: "Operates credit recovery and approved block instructions.",
    permissions: [Permissions.CREDIT_BLOCK, Permissions.KYC_VIEW, Permissions.KYC_REVIEW, Permissions.RECOVERY_VIEW, Permissions.RECOVERY_UPDATE],
  },
  {
    name: "sales_coordinator",
    description: "Approves second invoices and acts only through explicit delegation.",
    permissions: [Permissions.APPROVAL_SECOND_INVOICE],
  },
  {
    name: "credit_team_lead",
    description: "Confirms ratings, third invoices and credit blocks.",
    permissions: [
      Permissions.APPROVAL_THIRD_INVOICE,
      Permissions.CREDIT_RATING_CONFIRM,
      Permissions.CREDIT_BLOCK,
      Permissions.KYC_VIEW,
      Permissions.KYC_REVIEW,
      Permissions.RECOVERY_VIEW,
      Permissions.RECOVERY_UPDATE,
    ],
  },
  {
    name: "accounts",
    description: "Confirms verified collections before financial posting.",
    permissions: [Permissions.COLLECTION_CONFIRM, Permissions.FINANCIAL_CORRECT, Permissions.KYC_VIEW, Permissions.RECOVERY_VIEW],
  },
  {
    name: "dispatch",
    description: "Executes an already-authorized dispatch.",
    permissions: [Permissions.DISPATCH_EXECUTE],
  },
  {
    name: "founder_director",
    description: "Decides legal, settlement and exceptional escalation outcomes.",
    permissions: [Permissions.LEGAL_DECIDE, Permissions.RECOVERY_VIEW, Permissions.RECOVERY_UPDATE],
  },
  {
    name: "field_manager",
    description:
      "Plans routes and tasks for a field team and reviews their attendance, leave, expenses and service issues.",
    permissions: [
      Permissions.ATTENDANCE_REVIEW,
      Permissions.ROUTE_MANAGE,
      Permissions.EXPENSE_REVIEW,
      Permissions.ISSUE_REVIEW,
      Permissions.VISIT_VIEW,
      Permissions.LOCATION_VIEW,
      Permissions.RETAILER_PROPOSAL_REVIEW,
      Permissions.PERFORMANCE_VIEW_TEAM,
    ],
  },
  {
    name: "platform_admin",
    description: "Manages staff identity, roles and delegations.",
    permissions: Object.values(Permissions),
  },
];
