import type { Prisma, PrismaClient } from "@prisma/client";
import type { AgeingBuckets } from "../../lib/ageing";

type Db = PrismaClient | Prisma.TransactionClient;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function financialAgeingFor(
  db: Db,
  retailerId: string,
  now = new Date()
): Promise<AgeingBuckets> {
  const invoices = await db.invoice.findMany({
    where: {
      retailerId,
      status: { in: ["open", "partially_paid"] },
      outstandingAmount: { gt: 0 },
    },
    select: { outstandingAmount: true, dueDate: true },
  });
  const buckets: AgeingBuckets = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days60plus: 0,
    totalOutstanding: 0,
    totalOverdue: 0,
    oldestDueDate: null,
  };
  let oldest: Date | null = null;

  for (const invoice of invoices) {
    const outstanding = Number(invoice.outstandingAmount);
    buckets.totalOutstanding = round2(buckets.totalOutstanding + outstanding);
    if (invoice.dueDate >= now) {
      buckets.current = round2(buckets.current + outstanding);
      continue;
    }

    const daysLate = Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86_400_000);
    if (daysLate <= 30) buckets.days1to30 = round2(buckets.days1to30 + outstanding);
    else if (daysLate <= 60) {
      buckets.days31to60 = round2(buckets.days31to60 + outstanding);
    } else buckets.days60plus = round2(buckets.days60plus + outstanding);
    buckets.totalOverdue = round2(buckets.totalOverdue + outstanding);
    if (!oldest || invoice.dueDate < oldest) oldest = invoice.dueDate;
  }
  buckets.oldestDueDate = oldest?.toISOString() ?? null;
  return buckets;
}

export async function financialLedgerFor(db: Db, retailerId: string) {
  const entries = await db.financialLedgerEntry.findMany({
    where: { retailerId },
    orderBy: { sequence: "desc" },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          outstandingAmount: true,
          order: { select: { orderNo: true } },
        },
      },
      payment: { select: { id: true, status: true, channel: true } },
      creditNote: { select: { id: true, reason: true } },
      paymentReversal: { select: { id: true, reason: true } },
    },
  });

  return entries.map((entry) => ({
    id: entry.id,
    sequence: entry.sequence.toString(),
    type: entry.kind,
    kind: entry.kind,
    direction: entry.direction,
    amount: Number(entry.amount),
    balanceAfter: Number(entry.balanceAfter),
    occurredAt: entry.occurredAt,
    createdAt: entry.occurredAt,
    invoice: entry.invoice
      ? {
          id: entry.invoice.id,
          invoiceNumber: entry.invoice.invoiceNumber,
          status: entry.invoice.status,
        }
      : null,
    payment: entry.payment,
    creditNote: entry.creditNote,
    paymentReversal: entry.paymentReversal,
    reason: entry.creditNote?.reason ?? entry.paymentReversal?.reason ?? null,
    outstanding: entry.invoice ? Number(entry.invoice.outstandingAmount) : null,
    order: entry.invoice?.order ?? null,
  }));
}
