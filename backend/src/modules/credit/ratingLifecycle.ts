import type { BillingPattern, CreditRating } from "@prisma/client";

export interface RatingInvoiceEvidence {
  daysToPay: number;
  fullyPaid: boolean;
  hadPartialPayment: boolean;
}

export interface RatingLifecycleInput {
  currentRating: CreditRating;
  billingPattern: BillingPattern;
  accountAgeDays: number;
  invoices: RatingInvoiceEvidence[];
  checkpointDue: boolean;
  hasOutstanding?: boolean;
}

export interface RatingProposal {
  proposedRating: CreditRating;
  cleanInvoiceCount: number;
  trigger: "quarterly_checkpoint" | "six_month_manual_exit" | "immediate_60_day_review" | "legal_90_day_lock" | "e_clearance_restart" | "not_eligible";
  requiresConfirmation: boolean;
  evidence: { averageDso: number | null; invoiceCount: number };
}

function ratingForDso(pattern: BillingPattern, dso: number): CreditRating {
  if (dso >= 90) return "F";
  if (dso >= 60) return "E";
  if (dso > 45) return pattern === "irregular" ? "D" : "C";
  if (dso <= 30 && pattern === "regular") return "A";
  return "B";
}

export function calculateRatingProposal(input: RatingLifecycleInput): RatingProposal {
  let cleanInvoiceCount = 0;
  for (const invoice of input.invoices) {
    if (!invoice.fullyPaid || invoice.hadPartialPayment || invoice.daysToPay > 45) {
      cleanInvoiceCount = 0;
    } else {
      cleanInvoiceCount++;
    }
  }
  const paid = input.invoices.filter((invoice) => invoice.fullyPaid);
  const averageDso = paid.length
    ? Math.round((paid.reduce((sum, invoice) => sum + invoice.daysToPay, 0) / paid.length) * 10) / 10
    : null;
  const maxDso = input.invoices.reduce((max, invoice) => Math.max(max, invoice.daysToPay), 0);
  const evidence = { averageDso, invoiceCount: input.invoices.length };

  if (input.currentRating === "E" && input.hasOutstanding === false) {
    return {
      proposedRating: "N",
      cleanInvoiceCount,
      trigger: "e_clearance_restart",
      requiresConfirmation: true,
      evidence,
    };
  }

  if (maxDso >= 90) {
    return { proposedRating: "F", cleanInvoiceCount, trigger: "legal_90_day_lock", requiresConfirmation: true, evidence };
  }
  if (maxDso >= 60) {
    return { proposedRating: "E", cleanInvoiceCount, trigger: "immediate_60_day_review", requiresConfirmation: true, evidence };
  }

  if (input.currentRating === "N") {
    if (cleanInvoiceCount >= 3 && input.checkpointDue && averageDso != null) {
      return {
        proposedRating: ratingForDso(input.billingPattern, averageDso),
        cleanInvoiceCount,
        trigger: "quarterly_checkpoint",
        requiresConfirmation: true,
        evidence,
      };
    }
    if (input.accountAgeDays >= 183) {
      return {
        proposedRating: input.billingPattern === "regular" ? "C" : "D",
        cleanInvoiceCount,
        trigger: "six_month_manual_exit",
        requiresConfirmation: true,
        evidence,
      };
    }
    return { proposedRating: "N", cleanInvoiceCount, trigger: "not_eligible", requiresConfirmation: false, evidence };
  }

  if (input.checkpointDue && averageDso != null) {
    return {
      proposedRating: ratingForDso(input.billingPattern, averageDso),
      cleanInvoiceCount,
      trigger: "quarterly_checkpoint",
      requiresConfirmation: true,
      evidence,
    };
  }
  return { proposedRating: input.currentRating, cleanInvoiceCount, trigger: "not_eligible", requiresConfirmation: false, evidence };
}
