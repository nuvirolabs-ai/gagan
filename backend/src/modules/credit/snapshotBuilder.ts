import type { Prisma } from "@prisma/client";
import type { CreditSnapshot } from "./snapshot";

const RESERVED_ORDER_STATUSES = ["placed", "confirmed", "packed", "out_for_delivery"] as const;

function wholeDaysBetween(earlier: Date, later: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 86_400_000));
}

export async function buildCreditSnapshot(
  tx: Prisma.TransactionClient,
  retailerId: string,
  now = new Date(),
  excludeOrderId?: string
): Promise<CreditSnapshot> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [retailer, profile, invoices, pending, pendingOrderCount, approvalCount, sapDuplicateCount] = await Promise.all([
    tx.retailer.findUniqueOrThrow({
      where: { id: retailerId },
      select: { createdAt: true, sapCustomerId: true },
    }),
    tx.creditProfile.findUnique({ where: { retailerId } }),
    tx.invoice.findMany({
      where: { retailerId, status: { not: "voided" } },
      select: { id: true, orderId: true, total: true, outstandingAmount: true, invoiceDate: true },
      orderBy: [{ invoiceDate: "asc" }, { id: "asc" }],
    }),
    tx.order.aggregate({
      where: {
        retailerId,
        status: { in: [...RESERVED_ORDER_STATUSES] },
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      },
      _sum: { orderTotal: true },
    }),
    tx.order.count({
      where: {
        retailerId,
        status: { in: [...RESERVED_ORDER_STATUSES] },
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      },
    }),
    tx.approvalRequest.count({ where: { retailerId, createdAt: { gte: monthStart } } }),
    tx.reconciliationIssue.count({
      where: { retailerId, kind: "duplicate_sap_account", status: "open" },
    }),
  ]);

  // A single buyer order may issue two firm invoices. Existing credit stages
  // and partial-clearance checks apply to the buyer's purchase as a whole.
  const invoiceGroups = new Map<string, CreditSnapshot["openInvoices"][number]>();
  for (const invoice of invoices) {
    const key = invoice.orderId ? `order:${invoice.orderId}` : `invoice:${invoice.id}`;
    const group = invoiceGroups.get(key) ?? { id: invoice.id, total: 0, outstandingAmount: 0, ageDays: 0 };
    group.total += Number(invoice.total);
    group.outstandingAmount += Number(invoice.outstandingAmount);
    if (invoice.outstandingAmount.gt(0)) {
      group.ageDays = Math.max(group.ageDays, wholeDaysBetween(invoice.invoiceDate, now));
    }
    invoiceGroups.set(key, group);
  }
  const openInvoices = [...invoiceGroups.values()].filter(group => group.outstandingAmount > 0);
  const nextReviewAt = profile?.nextReviewAt;
  return {
    rating: profile?.rating ?? null,
    billingPattern: profile?.billingPattern ?? "unknown",
    kycVerified: profile?.kycVerifiedAt != null,
    accountAgeDays: wholeDaysBetween(profile?.accountCreatedAt ?? retailer.createdAt, now),
    invoiceCount: invoiceGroups.size,
    openInvoices,
    outstandingAmount: openInvoices.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0),
    pendingAuthorizedExposure: Number(pending._sum.orderTotal ?? 0),
    pendingOrderCount,
    advancePaymentConfirmed: false,
    approvalCountThisMonth: approvalCount,
    sapAccountCount: sapDuplicateCount > 0 ? 2 : 1,
    ratingReviewOverdueDays: nextReviewAt && nextReviewAt < now ? wholeDaysBetween(nextReviewAt, now) : 0,
  };
}
