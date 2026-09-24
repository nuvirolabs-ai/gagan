import type { Prisma, PrismaClient } from "@prisma/client";
import type { AgeingBuckets } from "../../lib/ageing";
import {
  addEntityAmounts,
  attributeInvoiceOutstanding,
  attributeLedgerEntry,
  emptyEntityAmounts,
  mergeAttributionStatus,
  type AttributionStatus,
  type EntityAmounts,
} from "./entityAttribution";

type Db = PrismaClient | Prisma.TransactionClient;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function financialAgeingFor(
  db: Db,
  retailerId: string,
  now = new Date()
): Promise<AgeingBuckets> {
  return (await financialInvoiceProjectionFor(db, retailerId, now)).ageing;
}

export async function financialInvoiceProjectionFor(
  db: Db,
  retailerId: string,
  now = new Date()
): Promise<{
  ageing: AgeingBuckets;
  entityBalances: {
    outstanding: EntityAmounts;
    overdue: EntityAmounts;
    attributionStatus: AttributionStatus;
  };
}> {
  const invoices = await db.invoice.findMany({
    where: {
      retailerId,
      status: { in: ["open", "partially_paid"] },
      outstandingAmount: { gt: 0 },
    },
    select: {
      total: true,
      outstandingAmount: true,
      dueDate: true,
      commercialSnapshot: true,
      allocations: {
        select: {
          amount: true,
          jainAmount: true,
          padamAmount: true,
          reversals: { select: { amount: true } },
        },
      },
    },
  });
  const ageing: AgeingBuckets = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days60plus: 0,
    totalOutstanding: 0,
    totalOverdue: 0,
    oldestDueDate: null,
  };
  let outstandingAmounts = emptyEntityAmounts();
  let overdueAmounts = emptyEntityAmounts();
  let attributionStatus: AttributionStatus = "complete";
  let oldest: Date | null = null;

  for (const invoice of invoices) {
    const outstanding = Number(invoice.outstandingAmount);
    ageing.totalOutstanding = round2(ageing.totalOutstanding + outstanding);
    const entityBreakdown = attributeInvoiceOutstanding(invoice);
    outstandingAmounts = addEntityAmounts(outstandingAmounts, entityBreakdown);
    attributionStatus = mergeAttributionStatus(attributionStatus, entityBreakdown.attributionStatus);
    if (invoice.dueDate >= now) {
      ageing.current = round2(ageing.current + outstanding);
      continue;
    }

    const daysLate = Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86_400_000);
    if (daysLate <= 30) ageing.days1to30 = round2(ageing.days1to30 + outstanding);
    else if (daysLate <= 60) {
      ageing.days31to60 = round2(ageing.days31to60 + outstanding);
    } else ageing.days60plus = round2(ageing.days60plus + outstanding);
    ageing.totalOverdue = round2(ageing.totalOverdue + outstanding);
    overdueAmounts = addEntityAmounts(overdueAmounts, entityBreakdown);
    if (!oldest || invoice.dueDate < oldest) oldest = invoice.dueDate;
  }
  ageing.oldestDueDate = oldest?.toISOString() ?? null;

  if (!entityAmountsReconcile(outstandingAmounts, ageing.totalOutstanding)) {
    outstandingAmounts = { ...emptyEntityAmounts(), unattributed: ageing.totalOutstanding };
    attributionStatus = "review_required";
  }
  if (!entityAmountsReconcile(overdueAmounts, ageing.totalOverdue)) {
    overdueAmounts = { ...emptyEntityAmounts(), unattributed: ageing.totalOverdue };
    attributionStatus = "review_required";
  }

  return {
    ageing,
    entityBalances: {
      outstanding: outstandingAmounts,
      overdue: overdueAmounts,
      attributionStatus,
    },
  };
}

function entityAmountsReconcile(amounts: EntityAmounts, total: number): boolean {
  const sum = amounts.jainTraders + amounts.padamInternational + amounts.unattributed;
  return Math.round(sum * 100) === Math.round(total * 100);
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
          total: true,
          outstandingAmount: true,
          commercialSnapshot: true,
          order: { select: { orderNo: true } },
        },
      },
      payment: {
        select: {
          id: true,
          status: true,
          channel: true,
          amount: true,
          unallocatedAmount: true,
          invoiceScopeId: true,
          confirmedJainAmount: true,
          confirmedPadamAmount: true,
          allocations: { select: { amount: true, jainAmount: true, padamAmount: true } },
        },
      },
      creditNote: {
        select: { id: true, reason: true, amount: true, invoice: { select: { commercialSnapshot: true } } },
      },
      paymentReversal: {
        select: {
          id: true,
          reason: true,
          amount: true,
          payment: {
            select: {
              invoiceScopeId: true,
              confirmedJainAmount: true,
              confirmedPadamAmount: true,
              allocations: { select: { jainAmount: true, padamAmount: true } },
            },
          },
        },
      },
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
    payment: entry.payment
      ? { id: entry.payment.id, status: entry.payment.status, channel: entry.payment.channel }
      : null,
    creditNote: entry.creditNote ? { id: entry.creditNote.id, reason: entry.creditNote.reason } : null,
    paymentReversal: entry.paymentReversal
      ? { id: entry.paymentReversal.id, reason: entry.paymentReversal.reason }
      : null,
    reason: entry.creditNote?.reason ?? entry.paymentReversal?.reason ?? null,
    outstanding: entry.invoice ? Number(entry.invoice.outstandingAmount) : null,
    order: entry.invoice?.order ?? null,
    entityBreakdown: attributeLedgerEntry(entry),
  }));
}
