import type { Invoice } from "@prisma/client";

export interface InvoiceAllocation {
  invoiceId: string;
  orderId: string | null;
  legacyLedgerEntryId: string | null;
  amount: number;
  outstandingAfter: number;
}

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function fromPaise(amount: number): number {
  return amount / 100;
}

/**
 * Apply a payment to invoices in the supplied order. Callers must load the
 * invoices oldest-first while holding the retailer lock.
 */
export function buildFifoAllocations(
  invoices: Pick<
    Invoice,
    "id" | "orderId" | "legacyLedgerEntryId" | "outstandingAmount"
  >[],
  paymentAmount: number
): { allocations: InvoiceAllocation[]; unallocated: number } {
  let remaining = toPaise(paymentAmount);
  const allocations: InvoiceAllocation[] = [];

  for (const invoice of invoices) {
    if (remaining === 0) break;

    const outstanding = toPaise(Number(invoice.outstandingAmount));
    if (outstanding <= 0) continue;

    const applied = Math.min(outstanding, remaining);
    allocations.push({
      invoiceId: invoice.id,
      orderId: invoice.orderId,
      legacyLedgerEntryId: invoice.legacyLedgerEntryId,
      amount: fromPaise(applied),
      outstandingAfter: fromPaise(outstanding - applied),
    });
    remaining -= applied;
  }

  return { allocations, unallocated: fromPaise(remaining) };
}
