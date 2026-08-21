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
    description: "Manages assigned retailers, KYC capture and retailer orders.",
    permissions: [Permissions.ORDER_CREATE_FOR_RETAILER, Permissions.KYC_SUBMIT, Permissions.RECOVERY_VIEW, Permissions.RECOVERY_UPDATE],
  },
  {
    name: "field_collector",
    description: "Visits assigned retailers and submits collection evidence.",
    permissions: [Permissions.COLLECTION_SUBMIT, Permissions.RECOVERY_VIEW, Permissions.RECOVERY_UPDATE],
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
    name: "platform_admin",
    description: "Manages staff identity, roles and delegations.",
    permissions: Object.values(Permissions),
  },
];
