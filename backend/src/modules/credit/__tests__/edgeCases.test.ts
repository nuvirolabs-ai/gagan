import { describe, expect, it } from "vitest";
import { assessOrder } from "../engine";
import { SOP_V4_POLICY } from "../policy";
import { ReasonCodes } from "../reasonCodes";
import { CreditSnapshot } from "../snapshot";

function snapshot(overrides: Partial<CreditSnapshot> = {}): CreditSnapshot {
  return {
    rating: "A",
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

describe("credit decision edge cases", () => {
  it("blocks missing ratings", () => {
    expect(assessOrder(SOP_V4_POLICY, snapshot({ rating: null }), { total: 1_000, hasPriceListVariation: false }))
      .toEqual({ result: "blocked", reasons: [ReasonCodes.MISSING_RATING] });
  });

  it("blocks consolidated exposure until duplicate SAP codes are resolved", () => {
    expect(assessOrder(SOP_V4_POLICY, snapshot({ sapAccountCount: 2 }), { total: 1_000, hasPriceListVariation: false }))
      .toEqual({ result: "blocked", reasons: [ReasonCodes.MULTIPLE_SAP_ACCOUNTS] });
  });

  it("includes authorized pending orders in projected exposure", () => {
    const decision = assessOrder(
      SOP_V4_POLICY,
      snapshot({ rating: "D", outstandingAmount: 10_000, pendingAuthorizedExposure: 10_000 }),
      { total: 5_000, hasPriceListVariation: false }
    );
    expect(decision).toEqual({ result: "blocked", reasons: [ReasonCodes.RATING_D_CAP] });
  });

  it("routes price-list variation to the Credit Team Lead", () => {
    expect(assessOrder(SOP_V4_POLICY, snapshot(), { total: 1_000, hasPriceListVariation: true }))
      .toMatchObject({
        result: "approval_required",
        requiredPermission: "approval.third_invoice",
        reasons: [ReasonCodes.PRICE_LIST_VARIATION],
      });
  });

  it("escalates a second monthly queue entry to the Credit Team Lead", () => {
    const decision = assessOrder(
      SOP_V4_POLICY,
      snapshot({ rating: "N", invoiceCount: 1, approvalCountThisMonth: 1 }),
      { total: 1_000, hasPriceListVariation: false }
    );
    expect(decision).toMatchObject({
      result: "approval_required",
      requiredPermission: "approval.third_invoice",
      reasons: expect.arrayContaining([ReasonCodes.REPEATED_MONTHLY_APPROVAL]),
    });
  });

  it("holds C/D for review when a rating checkpoint is more than seven days late", () => {
    for (const rating of ["C", "D"] as const) {
      expect(
        assessOrder(SOP_V4_POLICY, snapshot({ rating, ratingReviewOverdueDays: 8 }), {
          total: 1_000,
          hasPriceListVariation: false,
        })
      ).toMatchObject({ result: "approval_required", reasons: [ReasonCodes.STALE_RATING] });
    }
  });

  it("never lets stale review bypass E/F hard controls", () => {
    expect(assessOrder(SOP_V4_POLICY, snapshot({ rating: "E", ratingReviewOverdueDays: 8 }), { total: 1_000, hasPriceListVariation: false }))
      .toEqual({ result: "blocked", reasons: [ReasonCodes.RATING_E_LOCKED] });
    expect(assessOrder(SOP_V4_POLICY, snapshot({ rating: "F", ratingReviewOverdueDays: 8 }), { total: 1_000, hasPriceListVariation: false }))
      .toMatchObject({ result: "approval_required", requiredPermission: "collection.confirm" });
  });
});
