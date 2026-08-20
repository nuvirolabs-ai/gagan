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
  const [retailer, profile, invoices, invoiceCount, pending, pendingOrderCount, approvalCount] = await Promise.all([
    tx.retailer.findUniqueOrThrow({
      where: { id: retailerId },
      select: { createdAt: true, sapCustomerId: true },
    }),
    tx.creditProfile.findUnique({ where: { retailerId } }),
    tx.invoice.findMany({
      where: { retailerId, outstandingAmount: { gt: 0 }, status: { in: ["open", "partially_paid"] } },
      select: { id: true, total: true, outstandingAmount: true, invoiceDate: true },
      orderBy: { invoiceDate: "asc" },
    }),
    tx.invoice.count({ where: { retailerId, status: { not: "voided" } } }),
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
  ]);

  const nextReviewAt = profile?.nextReviewAt;
  return {
    rating: profile?.rating ?? null,
    billingPattern: profile?.billingPattern ?? "unknown",
    kycVerified: profile?.kycVerifiedAt != null,
    accountAgeDays: wholeDaysBetween(profile?.accountCreatedAt ?? retailer.createdAt, now),
    invoiceCount,
    openInvoices: invoices.map((invoice) => ({
      id: invoice.id,
      total: Number(invoice.total),
      outstandingAmount: Number(invoice.outstandingAmount),
      ageDays: wholeDaysBetween(invoice.invoiceDate, now),
    })),
    outstandingAmount: invoices.reduce((sum, invoice) => sum + Number(invoice.outstandingAmount), 0),
    pendingAuthorizedExposure: Number(pending._sum.orderTotal ?? 0),
    pendingOrderCount,
    advancePaymentConfirmed: false,
    approvalCountThisMonth: approvalCount,
    sapAccountCount: 1,
    ratingReviewOverdueDays: nextReviewAt && nextReviewAt < now ? wholeDaysBetween(nextReviewAt, now) : 0,
  };
}
