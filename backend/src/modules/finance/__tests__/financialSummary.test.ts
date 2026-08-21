import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { financialSummaryFor } from "../financialSummary";

const run = randomUUID();
const ids = { tier: `summary-tier-${run}`, retailer: `summary-retailer-${run}`, order: `summary-order-${run}`, invoice: `summary-invoice-${run}` };

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Summary tier ${run}` } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "Summary retailer", phone: `87${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "7")}`, shopAddress: "Test", tierId: ids.tier, creditLimit: 100_000, currentBalance: 62_412, overdueAmount: 40_500 } });
});

afterAll(async () => {
  await prisma.invoice.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.order.deleteMany({ where: { id: ids.order } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("shared financial summary", () => {
  it("marks cached balances as stale and does not fabricate zero ageing", async () => {
    const summary = await financialSummaryFor(prisma, ids.retailer);
    expect(summary).toMatchObject({ outstanding: 62_412, overdue: 40_500, source: "cached_retailer_balance", isStale: true, invoiceAgeing: null });
  });

  it("uses invoice ageing as the source once local invoices exist", async () => {
    await prisma.order.create({ data: { id: ids.order, retailerId: ids.retailer, orderTotal: 12_500 } });
    await prisma.invoice.create({ data: { id: ids.invoice, retailerId: ids.retailer, orderId: ids.order, invoiceDate: new Date("2026-08-01"), dueDate: new Date("2026-08-10"), subtotal: 12_500, total: 12_500, outstandingAmount: 12_500, idempotencyKey: `${ids.invoice}-key` } });
    const summary = await financialSummaryFor(prisma, ids.retailer, new Date("2026-08-21"));
    expect(summary).toMatchObject({ outstanding: 12_500, overdue: 12_500, source: "local_invoice_ledger", isStale: false });
    expect(summary?.invoiceAgeing?.totalOutstanding).toBe(12_500);
  });
});
