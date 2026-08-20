import { describe, expect, it, vi } from "vitest";
import { financialAgeingFor, financialLedgerFor } from "../financialQueries";

describe("financial read projections", () => {
  it("ages explicit invoice outstanding values", async () => {
    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            outstandingAmount: 750,
            dueDate: new Date("2026-07-01T00:00:00.000Z"),
          },
          {
            outstandingAmount: 500,
            dueDate: new Date("2026-09-01T00:00:00.000Z"),
          },
        ]),
      },
    };

    const result = await financialAgeingFor(
      db as never,
      "retailer-1",
      new Date("2026-08-20T00:00:00.000Z")
    );

    expect(result).toEqual({
      current: 500,
      days1to30: 0,
      days31to60: 750,
      days60plus: 0,
      totalOutstanding: 1_250,
      totalOverdue: 750,
      oldestDueDate: "2026-07-01T00:00:00.000Z",
    });
  });

  it("serializes immutable ledger events without BigInt or Decimal leakage", async () => {
    const db = {
      financialLedgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "entry-1",
            sequence: 42n,
            kind: "invoice",
            direction: "debit",
            amount: 500,
            balanceAfter: 500,
            occurredAt: new Date("2026-08-01T00:00:00.000Z"),
            invoice: {
              id: "invoice-1",
              invoiceNumber: 12,
              status: "partially_paid",
              outstandingAmount: 200,
              order: { orderNo: 8 },
            },
            payment: null,
            creditNote: null,
            paymentReversal: null,
          },
        ]),
      },
    };

    const entries = await financialLedgerFor(db as never, "retailer-1");

    expect(entries).toEqual([
      expect.objectContaining({
        id: "entry-1",
        sequence: "42",
        type: "invoice",
        kind: "invoice",
        amount: 500,
        balanceAfter: 500,
        outstanding: 200,
        order: { orderNo: 8 },
      }),
    ]);
    expect(() => JSON.stringify(entries)).not.toThrow();
  });
});
