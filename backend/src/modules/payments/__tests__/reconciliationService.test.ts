import { randomInt, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import {
  backfillFinancialCore,
  rebuildRetailerBalance,
  reconcileAllRetailers,
} from "../reconciliationService";

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  unmatchedRetailer: randomUUID(),
  firstInvoice: randomUUID(),
  secondInvoice: randomUUID(),
  payment: randomUUID(),
  paymentLedger: randomUUID(),
  unmatchedPaymentLedger: randomUUID(),
};

async function createFixture() {
  await prisma.tier.create({
    data: { id: ids.tier, name: `backfill-test-${ids.tier}`, paymentTermDays: 15 },
  });
  await prisma.retailer.createMany({
    data: [
      {
        id: ids.retailer,
        name: "Historical opening balance retailer",
        shopAddress: "Test address",
        phone: `6${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
        tierId: ids.tier,
        currentBalance: 300,
      },
      {
        id: ids.unmatchedRetailer,
        name: "Unmatched history retailer",
        shopAddress: "Test address",
        phone: `5${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
        tierId: ids.tier,
        currentBalance: 0,
      },
    ],
  });
  await prisma.ledgerEntry.createMany({
    data: [
      {
        id: ids.firstInvoice,
        retailerId: ids.retailer,
        type: "invoice",
        amount: 1_000,
        settledAmount: 1_000,
        balanceAfter: 1_000,
        dueDate: new Date("2026-07-16T00:00:00.000Z"),
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: ids.secondInvoice,
        retailerId: ids.retailer,
        type: "invoice",
        amount: 500,
        settledAmount: 200,
        balanceAfter: 1_500,
        dueDate: new Date("2026-07-25T00:00:00.000Z"),
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
      },
    ],
  });
  await prisma.payment.create({
    data: {
      id: ids.payment,
      retailerId: ids.retailer,
      amount: 1_200,
      status: "succeeded",
      channel: "manual",
      settledAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      id: ids.paymentLedger,
      retailerId: ids.retailer,
      paymentId: ids.payment,
      type: "payment",
      amount: 1_200,
      balanceAfter: 300,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      id: ids.unmatchedPaymentLedger,
      retailerId: ids.unmatchedRetailer,
      type: "payment",
      amount: 50,
      balanceAfter: -50,
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    },
  });
}

afterAll(async () => {
  await prisma.reconciliationIssue.deleteMany({
    where: { retailerId: { in: [ids.retailer, ids.unmatchedRetailer] } },
  });
  await prisma.financialLedgerEntry.deleteMany({
    where: { retailerId: { in: [ids.retailer, ids.unmatchedRetailer] } },
  });
  await prisma.paymentAllocation.deleteMany({ where: { paymentId: ids.payment } });
  await prisma.invoice.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.ledgerEntry.deleteMany({
    where: { retailerId: { in: [ids.retailer, ids.unmatchedRetailer] } },
  });
  await prisma.payment.deleteMany({ where: { id: ids.payment } });
  await prisma.retailer.deleteMany({
    where: { id: { in: [ids.retailer, ids.unmatchedRetailer] } },
  });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("financial backfill and reconciliation", () => {
  it("defaults to a write-free plan, applies once, and reports unmatched history", async () => {
    await createFixture();

    const dryRun = await backfillFinancialCore({ apply: false });
    expect(dryRun.mode).toBe("dry-run");
    expect(dryRun.planned).toMatchObject({
      invoices: 2,
      payments: 1,
      allocations: 2,
    });
    expect(await prisma.invoice.count({ where: { retailerId: ids.retailer } })).toBe(0);
    expect(await prisma.reconciliationIssue.count()).toBe(0);

    const applied = await backfillFinancialCore({ apply: true });
    expect(applied.mode).toBe("apply");
    expect(await prisma.invoice.count({ where: { retailerId: ids.retailer } })).toBe(2);
    expect(
      await prisma.financialLedgerEntry.count({ where: { retailerId: ids.retailer } })
    ).toBe(3);
    expect(await prisma.paymentAllocation.count({ where: { paymentId: ids.payment } })).toBe(2);
    expect(
      await prisma.reconciliationIssue.count({
        where: {
          retailerId: ids.unmatchedRetailer,
          kind: "legacy_payment_unmatched",
        },
      })
    ).toBe(1);

    const repeated = await backfillFinancialCore({ apply: true });
    expect(repeated.applied).toMatchObject({ invoices: 0, payments: 0, allocations: 0 });
    expect(await prisma.invoice.count({ where: { retailerId: ids.retailer } })).toBe(2);

    const cleanBalance = await rebuildRetailerBalance(ids.retailer);
    expect(cleanBalance).toMatchObject({ cachedBalance: 300, calculatedBalance: 300, matches: true });
    const all = await reconcileAllRetailers({ apply: false });
    expect(all.checked).toBeGreaterThanOrEqual(2);
  });
});
