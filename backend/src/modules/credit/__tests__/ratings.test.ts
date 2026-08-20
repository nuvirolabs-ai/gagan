import { describe, expect, it } from "vitest";
import { assessOrder } from "../engine";
import { SOP_V4_POLICY } from "../policy";
import { ReasonCodes } from "../reasonCodes";
import { CreditSnapshot, ProposedOrder } from "../snapshot";

const proposed: ProposedOrder = { total: 10_000, hasPriceListVariation: false };

function rated(rating: CreditSnapshot["rating"], overrides: Partial<CreditSnapshot> = {}): CreditSnapshot {
  return {
    rating,
    billingPattern: "regular",
    kycVerified: true,
    accountAgeDays: 400,
    invoiceCount: 10,
    openInvoices: [],
    outstandingAmount: 0,
    pendingAuthorizedExposure: 0,
    pendingOrderCount: 0,
    advancePaymentConfirmed: false,
    approvalCountThisMonth: 0,
    sapAccountCount: 1,
    ratingReviewOverdueDays: 0,
    ...overrides,
  };
}

describe("letter-rating dispatch rules", () => {
  it.each(["A", "B"] as const)("allows rating %s without overdue invoices", (rating) => {
    expect(assessOrder(SOP_V4_POLICY, rated(rating), proposed)).toMatchObject({ result: "allowed" });
  });

  it.each(["A", "B", "C", "D"] as const)("blocks rating %s when any invoice is past 45 days", (rating) => {
    const decision = assessOrder(
      SOP_V4_POLICY,
      rated(rating, {
        openInvoices: [{ id: "late", total: 10_000, outstandingAmount: 10_000, ageDays: 46 }],
        outstandingAmount: 10_000,
      }),
      proposed
    );
    expect(decision).toEqual({ result: "blocked", reasons: [ReasonCodes.INVOICE_OVERDUE_45_DAYS] });
  });

  it("blocks rating C at ₹1,00,000 projected outstanding", () => {
    expect(
      assessOrder(SOP_V4_POLICY, rated("C", { outstandingAmount: 90_000 }), proposed)
    ).toEqual({ result: "blocked", reasons: [ReasonCodes.RATING_C_CAP] });
  });

  it("blocks rating D at ₹25,000 projected outstanding", () => {
    expect(
      assessOrder(SOP_V4_POLICY, rated("D", { outstandingAmount: 15_000 }), proposed)
    ).toEqual({ result: "blocked", reasons: [ReasonCodes.RATING_D_CAP] });
  });

  it.each(["C", "D"] as const)("blocks rating %s at three open invoices", (rating) => {
    const openInvoices = [1, 2, 3].map((n) => ({
      id: String(n), total: 1_000, outstandingAmount: 1_000, ageDays: n,
    }));
    expect(assessOrder(SOP_V4_POLICY, rated(rating, { openInvoices, outstandingAmount: 3_000 }), proposed))
      .toEqual({ result: "blocked", reasons: [ReasonCodes.RATING_CD_OPEN_INVOICE_CAP] });
  });

  it("keeps rating E locked until the profile is reset to N", () => {
    expect(assessOrder(SOP_V4_POLICY, rated("E"), proposed)).toEqual({
      result: "blocked", reasons: [ReasonCodes.RATING_E_LOCKED],
    });
  });

  it("requires Accounts confirmation for rating F advance payment", () => {
    expect(assessOrder(SOP_V4_POLICY, rated("F"), proposed)).toMatchObject({
      result: "approval_required",
      requiredPermission: "collection.confirm",
      reasons: [ReasonCodes.RATING_F_ADVANCE_REQUIRED, ReasonCodes.ADVANCE_PAYMENT_UNCONFIRMED],
    });
  });

  it("allows a rating F order only after Accounts confirms full advance", () => {
    expect(assessOrder(SOP_V4_POLICY, rated("F", { advancePaymentConfirmed: true }), proposed))
      .toMatchObject({ result: "allowed" });
  });
});
