import type { Prisma, PrismaClient } from "@prisma/client";
import { financialAgeingFor } from "./financialQueries";
import type { AgeingBuckets } from "../../lib/ageing";

type Db = PrismaClient | Prisma.TransactionClient;

export type FinancialSummary = {
  outstanding: number;
  overdue: number;
  creditLimit: number;
  creditUsed: number;
  availableCredit: number;
  invoiceAgeing: AgeingBuckets | null;
  source: "local_invoice_ledger" | "cached_retailer_balance";
  syncedAt: Date | null;
  isStale: boolean;
};

/** One financial contract for retailer, salesperson, and admin surfaces. */
export async function financialSummaryFor(db: Db, retailerId: string, now = new Date()): Promise<FinancialSummary | null> {
  const retailer = await db.retailer.findUnique({ where: { id: retailerId } });
  if (!retailer) return null;

  // Route-level tests and narrow adapters may expose only the retailer model;
  // keep the contract usable there while the real Prisma client remains fully
  // invoice-aware.
  if (!(db as any).invoice) {
    let invoiceAgeing: AgeingBuckets | null = null;
    try { invoiceAgeing = await financialAgeingFor(db, retailerId); } catch { /* no invoice adapter */ }
    const outstanding = invoiceAgeing?.totalOutstanding ?? Number(retailer.currentBalance);
    const overdue = invoiceAgeing?.totalOverdue ?? Number(retailer.overdueAmount ?? 0);
    const creditLimit = Number(retailer.creditLimit);
    return {
      outstanding,
      overdue,
      creditLimit,
      creditUsed: outstanding,
      availableCredit: Math.max(creditLimit - outstanding, 0),
      invoiceAgeing,
      source: invoiceAgeing ? "local_invoice_ledger" : "cached_retailer_balance",
      syncedAt: null,
      isStale: !invoiceAgeing,
    };
  }

  const [invoiceCount, latestInvoice] = await Promise.all([
    db.invoice.count({ where: { retailerId } }),
    db.invoice.findFirst({ where: { retailerId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  const hasLocalInvoices = invoiceCount > 0;
  const invoiceAgeing = hasLocalInvoices ? await financialAgeingFor(db, retailerId, now) : null;
  const outstanding = invoiceAgeing ? invoiceAgeing.totalOutstanding : Number(retailer.currentBalance);
  const overdue = invoiceAgeing ? invoiceAgeing.totalOverdue : Number(retailer.overdueAmount);
  const creditLimit = Number(retailer.creditLimit);

  return {
    outstanding,
    overdue,
    creditLimit,
    creditUsed: outstanding,
    availableCredit: Math.max(creditLimit - outstanding, 0),
    invoiceAgeing,
    source: hasLocalInvoices ? "local_invoice_ledger" : "cached_retailer_balance",
    syncedAt: hasLocalInvoices ? latestInvoice?.updatedAt ?? null : null,
    isStale: !hasLocalInvoices,
  };
}
