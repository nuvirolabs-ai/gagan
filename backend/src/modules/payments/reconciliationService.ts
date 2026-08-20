import { Prisma } from "@prisma/client";
import { addDays } from "../../lib/ageing";
import { prisma } from "../../lib/prisma";

interface PlannedIssue {
  retailerId: string;
  kind: string;
  referenceType: string;
  referenceId: string;
  expectedAmount?: number;
  actualAmount?: number;
  details: Record<string, unknown>;
}

interface PlannedInvoiceLine {
  orderItemId: string;
  descriptionSnapshot: string;
  itemCodeSnapshot: string | null;
  deliveredCases: number;
  deliveredWeightKg: number | null;
  unitPrice: number;
  lineTotal: number;
}

interface PlannedInvoice {
  id: string;
  legacyLedgerEntryId: string;
  retailerId: string;
  orderId: string | null;
  invoiceDate: Date;
  dueDate: Date;
  total: number;
  outstandingAmount: number;
  status: "open" | "partially_paid" | "paid";
  legacyBalanceAfter: number;
  lines: PlannedInvoiceLine[];
}

interface PlannedAllocation {
  paymentId: string;
  invoiceId: string;
  amount: number;
}

interface PlannedPayment {
  paymentId: string;
  retailerId: string;
  amount: number;
  occurredAt: Date;
  legacyBalanceAfter: number;
  unallocatedAmount: number;
  allocations: PlannedAllocation[];
}

interface RetailerBackfillPlan {
  retailerId: string;
  invoices: PlannedInvoice[];
  payments: PlannedPayment[];
  issues: PlannedIssue[];
  blocked: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function buildBackfillPlans(retailerIds?: string[]): Promise<RetailerBackfillPlan[]> {
  const retailers = await prisma.retailer.findMany({
    where: retailerIds ? { id: { in: retailerIds } } : undefined,
    orderBy: { id: "asc" },
    include: {
      tier: { select: { paymentTermDays: true } },
      ledgerEntries: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          order: {
            include: {
              items: {
                include: { variant: { include: { product: true } } },
              },
            },
          },
        },
      },
      payments: {
        where: { status: { in: ["succeeded", "reversed"] } },
        include: { settlementLedgerEntry: true },
      },
      invoices: { select: { id: true, legacyLedgerEntryId: true, orderId: true } },
      financialLedgerEntries: { select: { id: true } },
    },
  });

  return retailers.map((retailer) => {
    const issues: PlannedIssue[] = [];
    const invoiceEntries = retailer.ledgerEntries.filter((entry) => entry.type === "invoice");
    const paymentEntries = retailer.ledgerEntries.filter((entry) => entry.type === "payment");
    const linkedLegacyIds = new Set(
      retailer.invoices.flatMap((invoice) =>
        invoice.legacyLedgerEntryId ? [invoice.legacyLedgerEntryId] : []
      )
    );
    const completeExistingMigration =
      invoiceEntries.every((entry) => linkedLegacyIds.has(entry.id)) &&
      retailer.payments.every((payment) => Boolean(payment.settlementLedgerEntry));

    if (retailer.financialLedgerEntries.length > 0 || retailer.invoices.length > 0) {
      if (!completeExistingMigration) {
        issues.push({
          retailerId: retailer.id,
          kind: "partial_financial_migration",
          referenceType: "Retailer",
          referenceId: retailer.id,
          details: {
            legacyInvoices: invoiceEntries.length,
            linkedInvoices: linkedLegacyIds.size,
            settledPayments: retailer.payments.length,
            linkedPayments: retailer.payments.filter((payment) => payment.settlementLedgerEntry)
              .length,
          },
        });
      }
      return {
        retailerId: retailer.id,
        invoices: [],
        payments: [],
        issues,
        blocked: !completeExistingMigration,
      };
    }

    const invoices: PlannedInvoice[] = invoiceEntries.map((entry) => {
      const lines =
        entry.order?.items.map((item) => {
          const deliveredCases = item.qtyDelivered ?? item.qtyOrdered;
          return {
            orderItemId: item.id,
            descriptionSnapshot: item.variant.product.name,
            itemCodeSnapshot: item.variant.product.sapMaterialId,
            deliveredCases,
            deliveredWeightKg:
              item.weightDelivered === null ? null : Number(item.weightDelivered),
            unitPrice: Number(item.unitPrice),
            lineTotal: round2(Number(item.unitPrice) * deliveredCases),
          };
        }) ?? [];
      const expectedOutstanding = round2(
        Math.max(Number(entry.amount) - Number(entry.settledAmount), 0)
      );
      return {
        id: entry.id,
        legacyLedgerEntryId: entry.id,
        retailerId: retailer.id,
        orderId: entry.orderId,
        invoiceDate: entry.createdAt,
        dueDate:
          entry.dueDate ??
          addDays(
            entry.createdAt,
            retailer.paymentTermDays ?? retailer.tier.paymentTermDays
          ),
        total: Number(entry.amount),
        outstandingAmount: Number(entry.amount),
        status: expectedOutstanding === 0 ? "paid" : "open",
        legacyBalanceAfter: Number(entry.balanceAfter),
        lines,
      };
    });
    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const paymentById = new Map(retailer.payments.map((payment) => [payment.id, payment]));
    const plannedPayments: PlannedPayment[] = [];

    for (const paymentEntry of paymentEntries) {
      if (!paymentEntry.paymentId) {
        issues.push({
          retailerId: retailer.id,
          kind: "legacy_payment_unmatched",
          referenceType: "LedgerEntry",
          referenceId: paymentEntry.id,
          expectedAmount: Number(paymentEntry.amount),
          details: { reason: "payment_ledger_has_no_payment_id" },
        });
        continue;
      }
      const payment = paymentById.get(paymentEntry.paymentId);
      if (!payment) {
        issues.push({
          retailerId: retailer.id,
          kind: "legacy_payment_unmatched",
          referenceType: "LedgerEntry",
          referenceId: paymentEntry.id,
          expectedAmount: Number(paymentEntry.amount),
          details: { paymentId: paymentEntry.paymentId },
        });
        continue;
      }
      if (Number(payment.amount) !== Number(paymentEntry.amount)) {
        issues.push({
          retailerId: retailer.id,
          kind: "legacy_payment_amount_mismatch",
          referenceType: "Payment",
          referenceId: payment.id,
          expectedAmount: Number(paymentEntry.amount),
          actualAmount: Number(payment.amount),
          details: { legacyLedgerEntryId: paymentEntry.id },
        });
        continue;
      }

      let remaining = Number(payment.amount);
      const allocations: PlannedAllocation[] = [];
      const availableInvoices = invoices
        .filter((invoice) => invoice.invoiceDate <= paymentEntry.createdAt)
        .sort(
          (left, right) =>
            left.invoiceDate.getTime() - right.invoiceDate.getTime() ||
            left.id.localeCompare(right.id)
        );
      for (const invoice of availableInvoices) {
        if (remaining <= 0) break;
        if (invoice.outstandingAmount <= 0) continue;
        const allocated = Math.min(invoice.outstandingAmount, remaining);
        allocations.push({ paymentId: payment.id, invoiceId: invoice.id, amount: allocated });
        invoice.outstandingAmount = round2(invoice.outstandingAmount - allocated);
        remaining = round2(remaining - allocated);
      }
      plannedPayments.push({
        paymentId: payment.id,
        retailerId: retailer.id,
        amount: Number(payment.amount),
        occurredAt: payment.settledAt ?? paymentEntry.createdAt,
        legacyBalanceAfter: Number(paymentEntry.balanceAfter),
        unallocatedAmount: remaining,
        allocations,
      });
    }

    for (const payment of retailer.payments) {
      if (!paymentEntries.some((entry) => entry.paymentId === payment.id)) {
        issues.push({
          retailerId: retailer.id,
          kind: "settled_payment_ledger_missing",
          referenceType: "Payment",
          referenceId: payment.id,
          expectedAmount: Number(payment.amount),
          details: {},
        });
      }
    }

    for (const invoiceEntry of invoiceEntries) {
      const invoice = invoiceById.get(invoiceEntry.id)!;
      const expectedOutstanding = round2(
        Math.max(Number(invoiceEntry.amount) - Number(invoiceEntry.settledAmount), 0)
      );
      if (invoice.outstandingAmount !== expectedOutstanding) {
        issues.push({
          retailerId: retailer.id,
          kind: "invoice_allocation_mismatch",
          referenceType: "LedgerEntry",
          referenceId: invoiceEntry.id,
          expectedAmount: expectedOutstanding,
          actualAmount: invoice.outstandingAmount,
          details: { settledAmount: Number(invoiceEntry.settledAmount) },
        });
      }
      invoice.status =
        invoice.outstandingAmount === 0
          ? "paid"
          : invoice.outstandingAmount === invoice.total
            ? "open"
            : "partially_paid";
    }

    return {
      retailerId: retailer.id,
      invoices,
      payments: plannedPayments,
      issues,
      blocked: issues.length > 0,
    };
  });
}

async function persistIssue(issue: PlannedIssue): Promise<void> {
  await prisma.reconciliationIssue.upsert({
    where: {
      kind_referenceType_referenceId: {
        kind: issue.kind,
        referenceType: issue.referenceType,
        referenceId: issue.referenceId,
      },
    },
    update: {
      retailerId: issue.retailerId,
      expectedAmount: issue.expectedAmount,
      actualAmount: issue.actualAmount,
      details: issue.details as Prisma.InputJsonValue,
      status: "open",
      resolvedAt: null,
    },
    create: {
      retailerId: issue.retailerId,
      kind: issue.kind,
      referenceType: issue.referenceType,
      referenceId: issue.referenceId,
      expectedAmount: issue.expectedAmount,
      actualAmount: issue.actualAmount,
      details: issue.details as Prisma.InputJsonValue,
    },
  });
}

async function financialSnapshot() {
  const [invoices, allocations, ledger, openIssues] = await Promise.all([
    prisma.invoice.aggregate({ _count: { _all: true }, _sum: { total: true } }),
    prisma.paymentAllocation.aggregate({
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.financialLedgerEntry.groupBy({
      by: ["direction"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.reconciliationIssue.count({ where: { status: "open" } }),
  ]);
  return {
    invoices: { count: invoices._count._all, total: Number(invoices._sum.total ?? 0) },
    allocations: {
      count: allocations._count._all,
      total: Number(allocations._sum.amount ?? 0),
    },
    ledger: Object.fromEntries(
      ledger.map((row) => [
        row.direction,
        { count: row._count._all, total: Number(row._sum.amount ?? 0) },
      ])
    ),
    openIssues,
  };
}

export async function backfillFinancialCore(
  options: { apply?: boolean; retailerIds?: string[] } = {}
) {
  const apply = options.apply === true;
  const financialBefore = await financialSnapshot();
  const plans = await buildBackfillPlans(options.retailerIds);
  const applicable = plans.filter((plan) => !plan.blocked);
  const issues = plans.flatMap((plan) => plan.issues);
  const planned = {
    invoices: applicable.reduce((sum, plan) => sum + plan.invoices.length, 0),
    payments: applicable.reduce((sum, plan) => sum + plan.payments.length, 0),
    allocations: applicable.reduce(
      (sum, plan) =>
        sum + plan.payments.reduce((count, payment) => count + payment.allocations.length, 0),
      0
    ),
    issues: issues.length,
  };
  const applied = { invoices: 0, payments: 0, allocations: 0, issues: 0 };

  if (apply) {
    for (const issue of issues) {
      await persistIssue(issue);
      applied.issues += 1;
    }
    for (const plan of applicable) {
      if (plan.invoices.length === 0 && plan.payments.length === 0) continue;
      await prisma.$transaction(async (tx) => {
        for (const invoice of plan.invoices) {
          await tx.invoice.create({
            data: {
              id: invoice.id,
              retailerId: invoice.retailerId,
              orderId: invoice.orderId,
              legacyLedgerEntryId: invoice.legacyLedgerEntryId,
              invoiceDate: invoice.invoiceDate,
              dueDate: invoice.dueDate,
              subtotal: invoice.total,
              total: invoice.total,
              outstandingAmount: invoice.outstandingAmount,
              status: invoice.status,
              idempotencyKey: `backfill:invoice:${invoice.legacyLedgerEntryId}`,
              lines: { create: invoice.lines },
            },
          });
          await tx.financialLedgerEntry.create({
            data: {
              retailerId: invoice.retailerId,
              invoiceId: invoice.id,
              direction: "debit",
              kind: "invoice",
              amount: invoice.total,
              balanceAfter: invoice.legacyBalanceAfter,
              idempotencyKey: `backfill:invoice-ledger:${invoice.legacyLedgerEntryId}`,
              occurredAt: invoice.invoiceDate,
              metadata: { backfilledFrom: invoice.legacyLedgerEntryId },
            },
          });
          applied.invoices += 1;
        }
        for (const payment of plan.payments) {
          await tx.financialLedgerEntry.create({
            data: {
              retailerId: payment.retailerId,
              paymentId: payment.paymentId,
              direction: "credit",
              kind: "payment",
              amount: payment.amount,
              balanceAfter: payment.legacyBalanceAfter,
              idempotencyKey: `backfill:payment-ledger:${payment.paymentId}`,
              occurredAt: payment.occurredAt,
              metadata: { backfilled: true },
            },
          });
          await tx.payment.update({
            where: { id: payment.paymentId },
            data: { unallocatedAmount: payment.unallocatedAmount },
          });
          for (const allocation of payment.allocations) {
            await tx.paymentAllocation.create({ data: allocation });
            applied.allocations += 1;
          }
          applied.payments += 1;
        }
      });
    }
  }

  const legacy = await prisma.ledgerEntry.groupBy({
    where: options.retailerIds
      ? { retailerId: { in: options.retailerIds } }
      : undefined,
    by: ["type"],
    _count: { _all: true },
    _sum: { amount: true },
  });
  return {
    mode: apply ? "apply" : "dry-run",
    legacy: Object.fromEntries(
      legacy.map((row) => [
        row.type,
        { count: row._count._all, total: Number(row._sum.amount ?? 0) },
      ])
    ),
    planned,
    applied,
    financialBefore,
    financialAfter: await financialSnapshot(),
  };
}

export async function rebuildRetailerBalance(
  retailerId: string,
  options: { apply?: boolean } = {}
) {
  const retailer = await prisma.retailer.findUnique({ where: { id: retailerId } });
  if (!retailer) throw new Error("retailer_not_found");
  const entries = await prisma.financialLedgerEntry.findMany({
    where: { retailerId },
    orderBy: { sequence: "asc" },
  });
  const calculatedBalance = round2(
    entries.reduce(
      (balance, entry) =>
        balance + (entry.direction === "debit" ? Number(entry.amount) : -Number(entry.amount)),
      0
    )
  );
  const cachedBalance = Number(retailer.currentBalance);
  const matches = calculatedBalance === cachedBalance;

  if (options.apply && !matches) {
    await persistIssue({
      retailerId,
      kind: "financial_balance_mismatch",
      referenceType: "Retailer",
      referenceId: retailerId,
      details: { cachedBalance, calculatedBalance },
    });
  }

  return {
    retailerId,
    cachedBalance,
    calculatedBalance,
    matches,
    entryCount: entries.length,
    balanceUpdated: false,
  };
}

export async function reconcileAllRetailers(options: { apply?: boolean } = {}) {
  const retailers = await prisma.retailer.findMany({ select: { id: true } });
  const results = [];
  for (const retailer of retailers) {
    try {
      results.push(await rebuildRetailerBalance(retailer.id, options));
    } catch (error) {
      if (error instanceof Error && error.message === "retailer_not_found") continue;
      throw error;
    }
  }
  return {
    checked: results.length,
    matched: results.filter((result) => result.matches).length,
    mismatched: results.filter((result) => !result.matches).length,
    results,
  };
}
