import type { Prisma, PrismaClient } from "@prisma/client";
import { financialAgeingFor, financialInvoiceProjectionFor, projectInvoices } from "./financialQueries";
import type { AgeingBuckets } from "../../lib/ageing";
import type { AttributionStatus, EntityAmounts } from "./entityAttribution";

type Db = PrismaClient | Prisma.TransactionClient;

export type FinancialSummary = {
  outstanding: number;
  overdue: number;
  creditLimit: number;
  creditUsed: number;
  availableCredit: number;
  invoiceAgeing: AgeingBuckets | null;
  entityBalances: {
    outstanding: EntityAmounts;
    overdue: EntityAmounts;
    attributionStatus: AttributionStatus;
  };
  source: "local_invoice_ledger" | "cached_retailer_balance";
  syncedAt: Date | null;
  isStale: boolean;
  reconciliationRequired: boolean;
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
      entityBalances: {
        outstanding: { jainTraders: 0, padamInternational: 0, unattributed: outstanding },
        overdue: { jainTraders: 0, padamInternational: 0, unattributed: overdue },
        attributionStatus: "contains_unattributed",
      },
      source: invoiceAgeing ? "local_invoice_ledger" : "cached_retailer_balance",
      syncedAt: null,
      isStale: !invoiceAgeing,
      reconciliationRequired: false,
    };
  }

  const [invoiceCount, latestInvoice] = await Promise.all([
    db.invoice.count({ where: { retailerId } }),
    db.invoice.findFirst({ where: { retailerId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  const hasLocalInvoices = invoiceCount > 0;
  const projection = hasLocalInvoices ? await financialInvoiceProjectionFor(db, retailerId, now) : null;
  const invoiceAgeing = projection?.ageing ?? null;
  const outstanding = invoiceAgeing ? invoiceAgeing.totalOutstanding : Number(retailer.currentBalance);
  const overdue = invoiceAgeing ? invoiceAgeing.totalOverdue : Number(retailer.overdueAmount);
  const creditLimit = Number(retailer.creditLimit);
  const reconciliationRequired = hasLocalInvoices && Math.abs(Number(retailer.currentBalance) - outstanding) > 0.01;

  return {
    outstanding,
    overdue,
    creditLimit,
    creditUsed: outstanding,
    availableCredit: Math.max(creditLimit - outstanding, 0),
    invoiceAgeing,
    entityBalances: projection?.entityBalances ?? {
      outstanding: { jainTraders: 0, padamInternational: 0, unattributed: outstanding },
      overdue: { jainTraders: 0, padamInternational: 0, unattributed: overdue },
      attributionStatus: "contains_unattributed",
    },
    source: hasLocalInvoices ? "local_invoice_ledger" : "cached_retailer_balance",
    syncedAt: hasLocalInvoices ? latestInvoice?.updatedAt ?? null : null,
    isStale: !hasLocalInvoices,
    reconciliationRequired,
  };
}

export async function financialSummariesForRetailers(
  db: Db,
  retailers: any[],
  now = new Date()
): Promise<Map<string, FinancialSummary>> {
  const summaries = new Map<string, FinancialSummary>();
  if (!retailers.length) return summaries;

  const retailerIds = retailers.map((r) => r.id);

  if (!(db as any).invoice) {
    for (const r of retailers) {
      const summary = await financialSummaryFor(db, r.id, now);
      if (summary) summaries.set(r.id, summary);
    }
    return summaries;
  }

  const [openInvoices, latestGroups] = await Promise.all([
    (db as any).invoice.findMany({
      where: {
        retailerId: { in: retailerIds },
        status: { in: ["open", "partially_paid"] },
        outstandingAmount: { gt: 0 },
      },
      select: {
        retailerId: true,
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
    }),
    (db as any).invoice.groupBy({
      by: ["retailerId"],
      _max: { updatedAt: true },
      where: { retailerId: { in: retailerIds } },
    }),
  ]);

  const invoicesByRetailer = new Map<string, any[]>();
  for (const inv of openInvoices) {
    const list = invoicesByRetailer.get(inv.retailerId);
    if (list) list.push(inv);
    else invoicesByRetailer.set(inv.retailerId, [inv]);
  }

  const latestByRetailer = new Map<string, Date>();
  for (const g of latestGroups) {
    if (g._max?.updatedAt) latestByRetailer.set(g.retailerId, g._max.updatedAt);
  }

  for (const r of retailers) {
    const invList = invoicesByRetailer.get(r.id) ?? [];
    const latestUpdated = latestByRetailer.get(r.id) ?? null;
    const hasLocalInvoices = latestUpdated != null || invList.length > 0;
    const projection = hasLocalInvoices ? projectInvoices(invList, now) : null;
    const invoiceAgeing = projection?.ageing ?? null;
    const outstanding = invoiceAgeing ? invoiceAgeing.totalOutstanding : Number(r.currentBalance ?? 0);
    const overdue = invoiceAgeing ? invoiceAgeing.totalOverdue : Number(r.overdueAmount ?? 0);
    const creditLimit = Number(r.creditLimit ?? 0);
    const reconciliationRequired = hasLocalInvoices && Math.abs(Number(r.currentBalance ?? 0) - outstanding) > 0.01;

    summaries.set(r.id, {
      outstanding,
      overdue,
      creditLimit,
      creditUsed: outstanding,
      availableCredit: Math.max(creditLimit - outstanding, 0),
      invoiceAgeing,
      entityBalances: projection?.entityBalances ?? {
        outstanding: { jainTraders: 0, padamInternational: 0, unattributed: outstanding },
        overdue: { jainTraders: 0, padamInternational: 0, unattributed: overdue },
        attributionStatus: "contains_unattributed",
      },
      source: hasLocalInvoices ? "local_invoice_ledger" : "cached_retailer_balance",
      syncedAt: latestUpdated,
      isStale: !hasLocalInvoices,
      reconciliationRequired,
    });
  }

  return summaries;
}
