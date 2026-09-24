import { describe, expect, it, vi } from "vitest";
import { financialLedgerFor } from "../financialQueries";
import { financialSummaryFor } from "../financialSummary";

const now = new Date("2026-08-20T00:00:00.000Z");

function summaryDb(invoices: any[], currentBalance = "0.00", overdueAmount = "0.00") {
  return {
    retailer: {
      findUnique: vi.fn().mockResolvedValue({
        id: "retailer-1",
        currentBalance,
        overdueAmount,
        creditLimit: "1000.00",
      }),
    },
    invoice: {
      count: vi.fn().mockResolvedValue(invoices.length),
      findFirst: vi.fn().mockResolvedValue({ updatedAt: now }),
      findMany: vi.fn().mockResolvedValue(invoices),
    },
  };
}

const mixedInvoice = {
  total: "100.00",
  outstandingAmount: "70.00",
  dueDate: new Date("2026-08-01T00:00:00.000Z"),
  commercialSnapshot: {
    entities: [
      { entity: "jain_traders", total: "60.00" },
      { entity: "padam_international", total: "40.00" },
    ],
  },
  allocations: [
    { amount: "30.00", jainAmount: "20.00", padamAmount: "10.00", reversals: [] },
  ],
};

describe("entity attribution API projections", () => {
  it("reconciles mixed-entity outstanding and overdue after explicit allocations", async () => {
    const result = await financialSummaryFor(summaryDb([mixedInvoice]) as never, "retailer-1", now);

    expect(result).toMatchObject({
      outstanding: 70,
      overdue: 70,
      entityBalances: {
        outstanding: { jainTraders: 40, padamInternational: 30, unattributed: 0 },
        overdue: { jainTraders: 40, padamInternational: 30, unattributed: 0 },
        attributionStatus: "complete",
      },
    });
  });

  it("keeps legacy invoice and cached balances unattributed", async () => {
    const legacyInvoice = {
      total: "25.00",
      outstandingAmount: "25.00",
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      commercialSnapshot: null,
      allocations: [],
    };
    const invoiceSummary = await financialSummaryFor(summaryDb([legacyInvoice]) as never, "retailer-1", now);
    expect(invoiceSummary?.entityBalances).toEqual({
      outstanding: { jainTraders: 0, padamInternational: 0, unattributed: 25 },
      overdue: { jainTraders: 0, padamInternational: 0, unattributed: 0 },
      attributionStatus: "contains_unattributed",
    });

    const cachedSummary = await financialSummaryFor(
      summaryDb([], "62.41", "40.50") as never,
      "retailer-1",
      now
    );
    expect(cachedSummary?.entityBalances).toEqual({
      outstanding: { jainTraders: 0, padamInternational: 0, unattributed: 62.41 },
      overdue: { jainTraders: 0, padamInternational: 0, unattributed: 40.5 },
      attributionStatus: "contains_unattributed",
    });
  });

  it("does not guess an entity split when the saved snapshot does not reconcile", async () => {
    const result = await financialSummaryFor(summaryDb([{
      ...mixedInvoice,
      outstandingAmount: "50.00",
      commercialSnapshot: {
        entities: [
          { entity: "jain_traders", total: "70.00" },
          { entity: "padam_international", total: "40.00" },
        ],
      },
      allocations: [],
    }]) as never, "retailer-1", now);

    expect(result?.entityBalances).toEqual({
      outstanding: { jainTraders: 0, padamInternational: 0, unattributed: 50 },
      overdue: { jainTraders: 0, padamInternational: 0, unattributed: 50 },
      attributionStatus: "review_required",
    });
  });

  it("marks an attributed invoice for review when a reversal has no entity split", async () => {
    const result = await financialSummaryFor(summaryDb([{
      ...mixedInvoice,
      allocations: [{
        amount: "30.00",
        jainAmount: "20.00",
        padamAmount: "10.00",
        reversals: [{ amount: "5.00" }],
      }],
    }]) as never, "retailer-1", now);

    expect(result?.entityBalances).toEqual({
      outstanding: { jainTraders: 0, padamInternational: 0, unattributed: 70 },
      overdue: { jainTraders: 0, padamInternational: 0, unattributed: 70 },
      attributionStatus: "review_required",
    });
  });

  it("exposes entity impact for invoice and payment ledger entries", async () => {
    const entries = await financialLedgerFor({
      financialLedgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "invoice-entry",
            sequence: 2n,
            kind: "invoice",
            direction: "debit",
            amount: "100.00",
            balanceAfter: "100.00",
            occurredAt: now,
            invoice: {
              id: "invoice-1",
              invoiceNumber: 1,
              status: "partially_paid",
              total: "100.00",
              outstandingAmount: "70.00",
              commercialSnapshot: mixedInvoice.commercialSnapshot,
              allocations: mixedInvoice.allocations,
              order: { orderNo: 1 },
            },
            payment: null,
            creditNote: null,
            paymentReversal: null,
          },
          {
            id: "payment-entry",
            sequence: 3n,
            kind: "payment",
            direction: "credit",
            amount: "90.00",
            balanceAfter: "10.00",
            occurredAt: now,
            invoice: null,
            payment: {
              id: "payment-1",
              status: "succeeded",
              channel: "manual",
              amount: "90.00",
              unallocatedAmount: "10.00",
              invoiceScopeId: "invoice-1",
              allocations: [
                { amount: "80.00", jainAmount: "30.00", padamAmount: "50.00" },
              ],
            },
            creditNote: null,
            paymentReversal: null,
          },
          {
            id: "legacy-payment-entry",
            sequence: 4n,
            kind: "payment",
            direction: "credit",
            amount: "45.00",
            balanceAfter: "-35.00",
            occurredAt: now,
            invoice: null,
            payment: {
              id: "legacy-payment-1",
              status: "succeeded",
              channel: "manual",
              amount: "45.00",
              unallocatedAmount: "45.00",
              invoiceScopeId: null,
              allocations: [],
            },
            creditNote: null,
            paymentReversal: null,
          },
        ]),
      },
    } as never, "retailer-1");

    expect(entries[0].entityBreakdown).toEqual({
      jainTraders: 60,
      padamInternational: 40,
      unattributed: 0,
      attributionStatus: "complete",
    });
    expect(entries[1].entityBreakdown).toEqual({
      jainTraders: 30,
      padamInternational: 50,
      unattributed: 10,
      attributionStatus: "contains_unattributed",
    });
    expect(entries[2].entityBreakdown).toEqual({
      jainTraders: 0,
      padamInternational: 0,
      unattributed: 45,
      attributionStatus: "contains_unattributed",
    });
  });

  it("marks ledger records for review when duplicate attribution or correction totals disagree", async () => {
    const entries = await financialLedgerFor({
      financialLedgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "inconsistent-payment",
            sequence: 5n,
            kind: "payment",
            direction: "credit",
            amount: "90.00",
            balanceAfter: 0,
            occurredAt: now,
            invoice: null,
            payment: {
              id: "payment-2",
              status: "succeeded",
              channel: "manual",
              amount: "90.00",
              unallocatedAmount: "10.00",
              invoiceScopeId: "invoice-2",
              confirmedJainAmount: "29.00",
              confirmedPadamAmount: "51.00",
              allocations: [
                { amount: "80.00", jainAmount: "30.00", padamAmount: "50.00" },
              ],
            },
            creditNote: null,
            paymentReversal: null,
          },
          {
            id: "inconsistent-credit-note",
            sequence: 6n,
            kind: "credit_note",
            direction: "credit",
            amount: "10.00",
            balanceAfter: 0,
            occurredAt: now,
            invoice: null,
            payment: null,
            creditNote: { id: "credit-1", amount: "12.00", reason: "Correction", invoice: { commercialSnapshot: null } },
            paymentReversal: null,
          },
          {
            id: "inconsistent-reversal",
            sequence: 7n,
            kind: "payment_reversal",
            direction: "debit",
            amount: "5.00",
            balanceAfter: 0,
            occurredAt: now,
            invoice: null,
            payment: null,
            creditNote: null,
            paymentReversal: { id: "reversal-1", amount: "6.00", reason: "Correction", payment: { invoiceScopeId: null } },
          },
        ]),
      },
    } as never, "retailer-1");

    expect(entries.map((entry) => entry.entityBreakdown)).toEqual([
      { jainTraders: 0, padamInternational: 0, unattributed: 90, attributionStatus: "review_required" },
      { jainTraders: 0, padamInternational: 0, unattributed: 10, attributionStatus: "review_required" },
      { jainTraders: 0, padamInternational: 0, unattributed: 5, attributionStatus: "review_required" },
    ]);
  });
});
