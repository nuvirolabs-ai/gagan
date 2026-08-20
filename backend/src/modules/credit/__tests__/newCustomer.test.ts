import { describe, expect, it } from "vitest";
import { assessOrder } from "../engine";
import { SOP_V4_POLICY } from "../policy";
import { ReasonCodes } from "../reasonCodes";
import { CreditSnapshot, ProposedOrder } from "../snapshot";

const order = (total: number): ProposedOrder => ({
  total,
  hasPriceListVariation: false,
});

function newCustomer(overrides: Partial<CreditSnapshot> = {}): CreditSnapshot {
  return {
    rating: "N",
    billingPattern: "unknown",
    kycVerified: true,
    accountAgeDays: 10,
    invoiceCount: 0,
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

describe("new-customer invoice chain", () => {
  it("allows the first invoice when KYC and the cap are clear", () => {
    expect(assessOrder(SOP_V4_POLICY, newCustomer(), order(20_000))).toMatchObject({
      result: "allowed",
    });
  });

  it("routes a second invoice to the Sales Coordinator", () => {
    const decision = assessOrder(
      SOP_V4_POLICY,
      newCustomer({
        invoiceCount: 1,
        openInvoices: [{ id: "inv-1", outstandingAmount: 20_000, total: 20_000, ageDays: 10 }],
        outstandingAmount: 20_000,
      }),
      order(10_000)
    );
    expect(decision).toMatchObject({
      result: "approval_required",
      requiredPermission: "approval.second_invoice",
      reasons: expect.arrayContaining([ReasonCodes.NEW_CUSTOMER_SECOND_INVOICE]),
    });
  });

  it("routes a third invoice to the Credit Team Lead with a 48-hour deadline", () => {
    const now = new Date("2026-08-20T10:00:00.000Z");
    const decision = assessOrder(
      SOP_V4_POLICY,
      newCustomer({
        invoiceCount: 2,
        openInvoices: [
          { id: "inv-1", outstandingAmount: 10_000, total: 10_000, ageDays: 20 },
          { id: "inv-2", outstandingAmount: 10_000, total: 10_000, ageDays: 5 },
        ],
        outstandingAmount: 20_000,
      }),
      order(10_000),
      now
    );
    expect(decision).toMatchObject({
      result: "approval_required",
      requiredPermission: "approval.third_invoice",
      deadline: new Date("2026-08-22T10:00:00.000Z"),
      reasons: expect.arrayContaining([ReasonCodes.NEW_CUSTOMER_THIRD_INVOICE]),
    });
  });

  it("blocks a fourth open invoice with no in-app override", () => {
    const decision = assessOrder(
      SOP_V4_POLICY,
      newCustomer({
        invoiceCount: 3,
        openInvoices: [
          { id: "1", outstandingAmount: 5_000, total: 5_000, ageDays: 10 },
          { id: "2", outstandingAmount: 5_000, total: 5_000, ageDays: 8 },
          { id: "3", outstandingAmount: 5_000, total: 5_000, ageDays: 2 },
        ],
        outstandingAmount: 15_000,
      }),
      order(5_000)
    );
    expect(decision).toEqual({
      result: "blocked",
      reasons: [ReasonCodes.NEW_CUSTOMER_FOURTH_BLOCKED],
    });
  });

  it("counts pending orders in the N invoice chain", () => {
    expect(
      assessOrder(
        SOP_V4_POLICY,
        newCustomer({ invoiceCount: 0, pendingOrderCount: 3 }),
        order(5_000)
      )
    ).toEqual({
      result: "blocked",
      reasons: [ReasonCodes.NEW_CUSTOMER_FOURTH_BLOCKED],
    });
  });

  it("unlocks the next order after the first three invoices are fully cleared", () => {
    expect(
      assessOrder(
        SOP_V4_POLICY,
        newCustomer({ invoiceCount: 3, openInvoices: [], pendingOrderCount: 0 }),
        order(5_000)
      )
    ).toMatchObject({ result: "allowed" });
  });

  it("restarts second and third approvals for invoices five and six", () => {
    const secondCycleInvoice = (count: number) =>
      Array.from({ length: count - 3 }, (_, index) => ({
        id: `cycle-2-${index + 1}`,
        total: 5_000,
        outstandingAmount: 5_000,
        ageDays: 5,
      }));
    expect(assessOrder(
      SOP_V4_POLICY,
      newCustomer({ invoiceCount: 4, openInvoices: secondCycleInvoice(4), outstandingAmount: 5_000 }),
      order(5_000)
    )).toMatchObject({ result: "approval_required", requiredPermission: "approval.second_invoice" });
    expect(assessOrder(
      SOP_V4_POLICY,
      newCustomer({ invoiceCount: 5, openInvoices: secondCycleInvoice(5), outstandingAmount: 10_000 }),
      order(5_000)
    )).toMatchObject({ result: "approval_required", requiredPermission: "approval.third_invoice" });
    expect(assessOrder(
      SOP_V4_POLICY,
      newCustomer({ invoiceCount: 6, openInvoices: secondCycleInvoice(6), outstandingAmount: 15_000 }),
      order(5_000)
    )).toEqual({ result: "blocked", reasons: [ReasonCodes.NEW_CUSTOMER_FOURTH_BLOCKED] });
  });

  it("unlocks invoice seven after the second group of three clears", () => {
    expect(assessOrder(
      SOP_V4_POLICY,
      newCustomer({ invoiceCount: 6, openInvoices: [], pendingOrderCount: 0 }),
      order(5_000)
    )).toMatchObject({ result: "allowed" });
  });

  it.each([1, 2])("routes invoice stage %s to the lead when projected exposure reaches ₹50,000", (invoiceCount) => {
    const decision = assessOrder(
      SOP_V4_POLICY,
      newCustomer({ invoiceCount, outstandingAmount: 40_000 }),
      order(10_000)
    );
    expect(decision).toMatchObject({
      result: "approval_required",
      requiredPermission: "approval.third_invoice",
      reasons: expect.arrayContaining([ReasonCodes.NEW_CUSTOMER_CAP]),
    });
  });

  it("blocks the next invoice when the previous invoice is only 90% paid", () => {
    const decision = assessOrder(
      SOP_V4_POLICY,
      newCustomer({
        invoiceCount: 1,
        openInvoices: [{ id: "inv-1", outstandingAmount: 1_000, total: 10_000, ageDays: 10 }],
        outstandingAmount: 1_000,
      }),
      order(10_000)
    );
    expect(decision).toEqual({
      result: "blocked",
      reasons: [ReasonCodes.PARTIAL_PAYMENT_NOT_CLEARANCE],
    });
  });
});
