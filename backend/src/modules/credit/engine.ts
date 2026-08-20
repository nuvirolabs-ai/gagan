import type { CreditPolicy } from "./policy";
import { ReasonCode, ReasonCodes } from "./reasonCodes";
import { CreditSnapshot, ProposedOrder, projectedExposure } from "./snapshot";

export type CreditDecision =
  | { result: "allowed"; reasons: ReasonCode[] }
  | {
      result: "approval_required";
      requiredPermission: string;
      deadline?: Date;
      reasons: ReasonCode[];
    }
  | { result: "blocked"; reasons: ReasonCode[] };

function blocked(...reasons: ReasonCode[]): CreditDecision {
  return { result: "blocked", reasons };
}

function needsApproval(
  requiredPermission: string,
  reasons: ReasonCode[],
  deadline?: Date
): CreditDecision {
  return {
    result: "approval_required",
    requiredPermission,
    ...(deadline ? { deadline } : {}),
    reasons,
  };
}

function openInvoiceSignals(snapshot: CreditSnapshot): ReasonCode[] {
  if (snapshot.openInvoices.length === 0) return [];
  return [ReasonCodes.PREVIOUS_INVOICE_PENDING, ReasonCodes.ONE_OR_MORE_OUTSTANDING];
}

export function assessOrder(
  policy: CreditPolicy,
  snapshot: CreditSnapshot,
  order: ProposedOrder,
  now = new Date()
): CreditDecision {
  if (!snapshot.rating) return blocked(ReasonCodes.MISSING_RATING);
  if (snapshot.sapAccountCount > 1) return blocked(ReasonCodes.MULTIPLE_SAP_ACCOUNTS);

  if (
    snapshot.ratingReviewOverdueDays > policy.ratingCheckpointGraceDays &&
    ["C", "D", "E", "F"].includes(snapshot.rating)
  ) {
    return needsApproval("approval.second_invoice", [ReasonCodes.STALE_RATING]);
  }

  const oldestAge = snapshot.openInvoices.reduce(
    (oldest, invoice) => Math.max(oldest, invoice.ageDays),
    0
  );
  if (oldestAge > policy.targetDsoDays) {
    const reasons: ReasonCode[] = [ReasonCodes.INVOICE_OVERDUE_45_DAYS];
    if (oldestAge >= policy.sapOverdueTriggerDays) {
      reasons.push(ReasonCodes.INVOICE_OVERDUE_60_DAYS);
    }
    return blocked(...reasons);
  }

  const exposure = projectedExposure(snapshot, order);
  const priceVariationReasons = order.hasPriceListVariation
    ? [ReasonCodes.PRICE_LIST_VARIATION]
    : [];

  if (snapshot.rating === "N") {
    if (snapshot.invoiceCount === 0 && !snapshot.kycVerified) {
      return blocked(ReasonCodes.KYC_REQUIRED);
    }

    const partiallyPaid = snapshot.openInvoices.some(
      (invoice) => invoice.outstandingAmount > 0 && invoice.outstandingAmount < invoice.total
    );
    if (partiallyPaid) return blocked(ReasonCodes.PARTIAL_PAYMENT_NOT_CLEARANCE);

    if (snapshot.openInvoices.length >= policy.newCustomerMaxOpenBeforeClearance) {
      return blocked(ReasonCodes.NEW_CUSTOMER_FOURTH_BLOCKED);
    }

    const invoiceSignals = openInvoiceSignals(snapshot);
    const repeated =
      snapshot.approvalCountThisMonth + 1 >= policy.repeatedApprovalMonthlyCount;

    if (exposure >= policy.newCustomerOutstandingCap) {
      return needsApproval("approval.third_invoice", [
        ReasonCodes.NEW_CUSTOMER_CAP,
        ...priceVariationReasons,
        ...invoiceSignals,
        ...(repeated ? [ReasonCodes.REPEATED_MONTHLY_APPROVAL] : []),
      ]);
    }

    if (snapshot.invoiceCount === 2) {
      return needsApproval(
        "approval.third_invoice",
        [
          ReasonCodes.NEW_CUSTOMER_THIRD_INVOICE,
          ...priceVariationReasons,
          ...invoiceSignals,
          ...(repeated ? [ReasonCodes.REPEATED_MONTHLY_APPROVAL] : []),
        ],
        new Date(now.getTime() + policy.thirdInvoiceSlaHours * 60 * 60 * 1000)
      );
    }

    if (snapshot.invoiceCount === 1) {
      return needsApproval(
        repeated ? "approval.third_invoice" : "approval.second_invoice",
        [
          ReasonCodes.NEW_CUSTOMER_SECOND_INVOICE,
          ...priceVariationReasons,
          ...invoiceSignals,
          ...(repeated ? [ReasonCodes.REPEATED_MONTHLY_APPROVAL] : []),
        ]
      );
    }

    if (order.hasPriceListVariation) {
      return needsApproval("approval.third_invoice", priceVariationReasons);
    }
    return { result: "allowed", reasons: [] };
  }

  if (snapshot.rating === "C" && exposure >= policy.ratingCOutstandingCap) {
    return blocked(ReasonCodes.RATING_C_CAP);
  }
  if (snapshot.rating === "D" && exposure >= policy.ratingDOutstandingCap) {
    return blocked(ReasonCodes.RATING_D_CAP);
  }
  if (
    (snapshot.rating === "C" || snapshot.rating === "D") &&
    snapshot.openInvoices.length >= policy.ratingCDOpenInvoiceCap
  ) {
    return blocked(ReasonCodes.RATING_CD_OPEN_INVOICE_CAP);
  }
  if (snapshot.rating === "E") return blocked(ReasonCodes.RATING_E_LOCKED);
  if (snapshot.rating === "F") {
    if (!snapshot.advancePaymentConfirmed) {
      return needsApproval("collection.confirm", [
        ReasonCodes.RATING_F_ADVANCE_REQUIRED,
        ReasonCodes.ADVANCE_PAYMENT_UNCONFIRMED,
      ]);
    }
    return { result: "allowed", reasons: [] };
  }

  if (order.hasPriceListVariation) {
    return needsApproval("approval.third_invoice", priceVariationReasons);
  }

  const invoiceSignals = openInvoiceSignals(snapshot);
  if (invoiceSignals.length > 0) {
    return needsApproval("approval.third_invoice", invoiceSignals);
  }

  return { result: "allowed", reasons: [] };
}
