export const ReasonCodes = {
  KYC_REQUIRED: "kyc_required",
  PRICE_LIST_VARIATION: "so_price_list_variation",
  INVOICE_OVERDUE_45_DAYS: "invoice_overdue_45_days",
  INVOICE_OVERDUE_60_DAYS: "invoice_overdue_60_days",
  PREVIOUS_INVOICE_PENDING: "previous_invoice_pending",
  ONE_OR_MORE_OUTSTANDING: "one_or_more_outstanding",
  NEW_CUSTOMER_SECOND_INVOICE: "new_customer_second_invoice",
  NEW_CUSTOMER_THIRD_INVOICE: "new_customer_third_invoice",
  NEW_CUSTOMER_FOURTH_BLOCKED: "new_customer_fourth_blocked",
  NEW_CUSTOMER_CAP: "new_customer_50000_cap",
  PARTIAL_PAYMENT_NOT_CLEARANCE: "partial_payment_not_clearance",
  RATING_C_CAP: "rating_c_cap",
  RATING_D_CAP: "rating_d_cap",
  RATING_CD_OPEN_INVOICE_CAP: "rating_cd_open_invoice_cap",
  RATING_E_LOCKED: "rating_e_locked",
  RATING_F_ADVANCE_REQUIRED: "rating_f_advance_required",
  ADVANCE_PAYMENT_UNCONFIRMED: "advance_payment_unconfirmed",
  MISSING_RATING: "missing_rating",
  STALE_RATING: "stale_rating",
  REPEATED_MONTHLY_APPROVAL: "repeated_monthly_approval",
  MULTIPLE_SAP_ACCOUNTS: "multiple_sap_accounts",
} as const;

export type ReasonCode = (typeof ReasonCodes)[keyof typeof ReasonCodes];

export interface ReasonDefinition {
  title: string;
  message: string;
}

export const REASON_CATALOG: Record<ReasonCode, ReasonDefinition> = {
  [ReasonCodes.KYC_REQUIRED]: {
    title: "KYC required",
    message: "Customer KYC must be verified before the first dispatch.",
  },
  [ReasonCodes.PRICE_LIST_VARIATION]: {
    title: "Price variation",
    message: "The sales-order price differs from the approved price list.",
  },
  [ReasonCodes.INVOICE_OVERDUE_45_DAYS]: {
    title: "Invoice overdue beyond 45 days",
    message: "Past-due invoices must be fully cleared before another dispatch.",
  },
  [ReasonCodes.INVOICE_OVERDUE_60_DAYS]: {
    title: "Invoice overdue beyond 60 days",
    message: "The SAP overdue trigger requires order approval and dispatch hold.",
  },
  [ReasonCodes.PREVIOUS_INVOICE_PENDING]: {
    title: "Previous invoice pending",
    message: "A previous invoice is not fully paid.",
  },
  [ReasonCodes.ONE_OR_MORE_OUTSTANDING]: {
    title: "Outstanding balance",
    message: "The customer has one or more outstanding invoices.",
  },
  [ReasonCodes.NEW_CUSTOMER_SECOND_INVOICE]: {
    title: "Second invoice approval",
    message: "A Sales Coordinator must approve a new customer's second invoice.",
  },
  [ReasonCodes.NEW_CUSTOMER_THIRD_INVOICE]: {
    title: "Third invoice approval",
    message: "The Credit Team Lead must approve a new customer's third invoice.",
  },
  [ReasonCodes.NEW_CUSTOMER_FOURTH_BLOCKED]: {
    title: "Fourth invoice blocked",
    message: "Invoices one to three must be fully cleared before a fourth dispatch.",
  },
  [ReasonCodes.NEW_CUSTOMER_CAP]: {
    title: "New-customer cap reached",
    message: "Projected outstanding reaches the ₹50,000 new-customer cap.",
  },
  [ReasonCodes.PARTIAL_PAYMENT_NOT_CLEARANCE]: {
    title: "Invoice only partly paid",
    message: "Partial payment never counts as full invoice clearance.",
  },
  [ReasonCodes.RATING_C_CAP]: {
    title: "Rating C limit reached",
    message: "Projected outstanding reaches the ₹1,00,000 Rating C limit.",
  },
  [ReasonCodes.RATING_D_CAP]: {
    title: "Rating D limit reached",
    message: "Projected outstanding reaches the ₹25,000 Rating D limit.",
  },
  [ReasonCodes.RATING_CD_OPEN_INVOICE_CAP]: {
    title: "Open-invoice limit reached",
    message: "Rating C and D customers cannot have three or more open invoices.",
  },
  [ReasonCodes.RATING_E_LOCKED]: {
    title: "Rating E locked",
    message: "Dispatch stays locked until all outstanding is fully cleared.",
  },
  [ReasonCodes.RATING_F_ADVANCE_REQUIRED]: {
    title: "Advance payment required",
    message: "Rating F customers may dispatch only against confirmed advance payment.",
  },
  [ReasonCodes.ADVANCE_PAYMENT_UNCONFIRMED]: {
    title: "Advance payment unconfirmed",
    message: "Accounts must confirm the payment before dispatch.",
  },
  [ReasonCodes.MISSING_RATING]: {
    title: "Rating missing",
    message: "Credit Team Lead confirmation is required before dispatch.",
  },
  [ReasonCodes.STALE_RATING]: {
    title: "Rating review overdue",
    message: "The rating checkpoint is overdue and requires authorized sign-off.",
  },
  [ReasonCodes.REPEATED_MONTHLY_APPROVAL]: {
    title: "Repeated approval",
    message: "This customer has entered approval twice this month and needs Credit Team Lead review.",
  },
  [ReasonCodes.MULTIPLE_SAP_ACCOUNTS]: {
    title: "Duplicate SAP accounts",
    message: "Exposure must be consolidated across the customer's SAP account codes.",
  },
};
