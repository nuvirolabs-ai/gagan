import { ReasonCode, ReasonCodes } from "./reasonCodes";

export interface CreditPolicy {
  version: number;
  name: string;
  targetDsoDays: number;
  sapOverdueTriggerDays: number;
  newCustomerOutstandingCap: number;
  newCustomerMaxOpenBeforeClearance: number;
  ratingCOutstandingCap: number;
  ratingDOutstandingCap: number;
  ratingCDOpenInvoiceCap: number;
  thirdInvoiceSlaHours: number;
  conflictAcknowledgmentWorkingHours: number;
  conflictDecisionHours: number;
  repeatedApprovalMonthlyCount: number;
  cashDiscountPercent: number;
  ratingCheckpointGraceDays: number;
  legalEscalationDays: number;
  recoveryLetterPaymentDays: number;
  salesOrderApprovalParameters: ReasonCode[];
}

export const SOP_V4_POLICY: CreditPolicy = Object.freeze({
  version: 4,
  name: "Credit & Sales Operations SOP V4",
  targetDsoDays: 45,
  sapOverdueTriggerDays: 60,
  newCustomerOutstandingCap: 50_000,
  newCustomerMaxOpenBeforeClearance: 3,
  ratingCOutstandingCap: 100_000,
  ratingDOutstandingCap: 25_000,
  ratingCDOpenInvoiceCap: 3,
  thirdInvoiceSlaHours: 48,
  conflictAcknowledgmentWorkingHours: 4,
  conflictDecisionHours: 24,
  repeatedApprovalMonthlyCount: 2,
  cashDiscountPercent: 2,
  ratingCheckpointGraceDays: 7,
  legalEscalationDays: 90,
  recoveryLetterPaymentDays: 7,
  salesOrderApprovalParameters: [
    ReasonCodes.PRICE_LIST_VARIATION,
    ReasonCodes.INVOICE_OVERDUE_60_DAYS,
    ReasonCodes.PREVIOUS_INVOICE_PENDING,
    ReasonCodes.ONE_OR_MORE_OUTSTANDING,
  ],
});

export function serializePolicy(policy: CreditPolicy): Record<string, unknown> {
  return { ...policy, salesOrderApprovalParameters: [...policy.salesOrderApprovalParameters] };
}
