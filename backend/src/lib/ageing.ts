import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

/** Any Prisma client or interactive-transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Credit period for a retailer: their own override, else their tier's default. */
export async function paymentTermDays(db: Db, retailerId: string): Promise<number> {
  const retailer = await db.retailer.findUnique({
    where: { id: retailerId },
    select: { paymentTermDays: true, tier: { select: { paymentTermDays: true } } },
  });
  return retailer?.paymentTermDays ?? retailer?.tier.paymentTermDays ?? 15;
}

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Apply `amount` against the retailer's open invoices, oldest due date first.
 *
 * FIFO is the convention retailers expect from a khata: money paid clears the
 * oldest bill. It also means a payment can only ever reduce overdue, never
 * create it. Returns how much of the payment could not be allocated (the
 * retailer overpaid relative to invoices raised) — that still reduces their
 * balance, it just isn't tied to a specific invoice.
 */
export async function allocatePaymentToInvoices(
  db: Db,
  retailerId: string,
  amount: number
): Promise<number> {
  let remaining = round2(amount);

  const openInvoices = await db.ledgerEntry.findMany({
    where: { retailerId, type: "invoice" },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  for (const inv of openInvoices) {
    if (remaining <= 0) break;
    const outstanding = round2(Number(inv.amount) - Number(inv.settledAmount));
    if (outstanding <= 0) continue;

    const applied = Math.min(outstanding, remaining);
    await db.ledgerEntry.update({
      where: { id: inv.id },
      data: { settledAmount: round2(Number(inv.settledAmount) + applied) },
    });
    remaining = round2(remaining - applied);
  }

  return remaining;
}

/**
 * Recompute and store the retailer's overdue figure from their open invoices.
 * Overdue = unsettled value of invoices whose due date has passed.
 */
export async function recomputeOverdue(db: Db, retailerId: string, now = new Date()): Promise<number> {
  const pastDue = await db.ledgerEntry.findMany({
    where: { retailerId, type: "invoice", dueDate: { lt: now } },
    select: { amount: true, settledAmount: true },
  });

  const overdue = round2(
    pastDue.reduce((sum, e) => sum + Math.max(Number(e.amount) - Number(e.settledAmount), 0), 0)
  );

  await db.retailer.update({ where: { id: retailerId }, data: { overdueAmount: overdue } });
  return overdue;
}

export interface AgeingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days60plus: number;
  totalOutstanding: number;
  totalOverdue: number;
  oldestDueDate: string | null;
}

/** Standard receivables ageing, for the admin dashboard and rep app. */
export async function ageingFor(
  db: Db,
  retailerId: string,
  now = new Date()
): Promise<AgeingBuckets> {
  const invoices = await db.ledgerEntry.findMany({
    where: { retailerId, type: "invoice" },
    select: { amount: true, settledAmount: true, dueDate: true },
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

  for (const inv of invoices) {
    const open = round2(Number(inv.amount) - Number(inv.settledAmount));
    if (open <= 0) continue;
    buckets.totalOutstanding = round2(buckets.totalOutstanding + open);

    if (!inv.dueDate || inv.dueDate >= now) {
      buckets.current = round2(buckets.current + open);
      continue;
    }

    const daysLate = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
    if (daysLate <= 30) buckets.days1to30 = round2(buckets.days1to30 + open);
    else if (daysLate <= 60) buckets.days31to60 = round2(buckets.days31to60 + open);
    else buckets.days60plus = round2(buckets.days60plus + open);

    buckets.totalOverdue = round2(buckets.totalOverdue + open);
    if (!oldest || inv.dueDate < oldest) oldest = inv.dueDate;
  }

  buckets.oldestDueDate = oldest ? oldest.toISOString() : null;
  return buckets;
}

/**
 * Refresh overdue for every retailer. Ageing is time-driven — an invoice tips
 * over simply because a day passed — so this needs to run on a schedule, not
 * only when money moves.
 */
export async function ageAllRetailers(now = new Date()): Promise<{ updated: number }> {
  const retailers = await prisma.retailer.findMany({ select: { id: true } });
  for (const r of retailers) {
    await recomputeOverdue(prisma, r.id, now);
  }
  return { updated: retailers.length };
}
