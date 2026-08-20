import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildFifoAllocations } from "../allocationService";

describe("buildFifoAllocations", () => {
  it("allocates in supplied FIFO order without losing paise", () => {
    const result = buildFifoAllocations(
      [
        { id: "oldest", orderId: "order-1", legacyLedgerEntryId: "legacy-1", outstandingAmount: new Prisma.Decimal("10.01") },
        { id: "newest", orderId: "order-2", legacyLedgerEntryId: "legacy-2", outstandingAmount: new Prisma.Decimal("5.99") },
      ],
      12.5
    );

    expect(result).toEqual({
      allocations: [
        { invoiceId: "oldest", orderId: "order-1", legacyLedgerEntryId: "legacy-1", amount: 10.01, outstandingAfter: 0 },
        { invoiceId: "newest", orderId: "order-2", legacyLedgerEntryId: "legacy-2", amount: 2.49, outstandingAfter: 3.5 },
      ],
      unallocated: 0,
    });
  });

  it("returns the amount remaining after every invoice is cleared", () => {
    const result = buildFifoAllocations(
      [{ id: "invoice", orderId: "order", legacyLedgerEntryId: null, outstandingAmount: new Prisma.Decimal("4.25") }],
      5
    );

    expect(result.unallocated).toBe(0.75);
  });
});
