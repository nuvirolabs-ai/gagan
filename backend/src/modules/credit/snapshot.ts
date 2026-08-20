import type { BillingPattern, CreditRating } from "@prisma/client";

export interface OpenInvoiceSnapshot {
  id: string;
  total: number;
  outstandingAmount: number;
  ageDays: number;
}

export interface CreditSnapshot {
  rating: CreditRating | null;
  billingPattern: BillingPattern;
  kycVerified: boolean;
  accountAgeDays: number;
  invoiceCount: number;
  openInvoices: OpenInvoiceSnapshot[];
  outstandingAmount: number;
  pendingAuthorizedExposure: number;
  pendingOrderCount: number;
  advancePaymentConfirmed: boolean;
  approvalCountThisMonth: number;
  sapAccountCount: number;
  ratingReviewOverdueDays: number;
}

export interface ProposedOrder {
  total: number;
  hasPriceListVariation: boolean;
}

export function projectedExposure(snapshot: CreditSnapshot, order: ProposedOrder): number {
  return snapshot.outstandingAmount + snapshot.pendingAuthorizedExposure + order.total;
}
