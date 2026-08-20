import { randomInt, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { settleSucceededPayment } from "../paymentService";

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  firstOrder: randomUUID(),
  secondOrder: randomUUID(),
  firstInvoice: randomUUID(),
  secondInvoice: randomUUID(),
  payment: randomUUID(),
  advanceRetailer: randomUUID(),
  advancePayment: randomUUID(),
};

async function createFixture() {
  await prisma.tier.create({
    data: { id: ids.tier, name: `payment-test-${ids.tier}`, paymentTermDays: 15 },
  });
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: "Payment concurrency test retailer",
      shopAddress: "Test address",
      phone: `9${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
      tierId: ids.tier,
      creditLimit: 100_000,
      currentBalance: 1_500,
    },
  });
  await prisma.order.createMany({
    data: [
      {
        id: ids.firstOrder,
        retailerId: ids.retailer,
        status: "delivered",
        orderTotal: 1_000,
      },
      {
        id: ids.secondOrder,
        retailerId: ids.retailer,
        status: "delivered",
        orderTotal: 500,
      },
    ],
  });
  await prisma.invoice.createMany({
    data: [
      {
        id: ids.firstInvoice,
        retailerId: ids.retailer,
        orderId: ids.firstOrder,
        invoiceDate: new Date("2026-07-01T00:00:00.000Z"),
        dueDate: new Date("2026-07-16T00:00:00.000Z"),
        subtotal: 1_000,
        total: 1_000,
        outstandingAmount: 1_000,
        idempotencyKey: randomUUID(),
      },
      {
        id: ids.secondInvoice,
        retailerId: ids.retailer,
        orderId: ids.secondOrder,
        invoiceDate: new Date("2026-07-10T00:00:00.000Z"),
        dueDate: new Date("2026-07-25T00:00:00.000Z"),
        subtotal: 500,
        total: 500,
        outstandingAmount: 500,
        idempotencyKey: randomUUID(),
      },
    ],
  });
  await prisma.financialLedgerEntry.createMany({
    data: [
      {
        retailerId: ids.retailer,
        invoiceId: ids.firstInvoice,
        direction: "debit",
        kind: "invoice",
        amount: 1_000,
        balanceAfter: 1_000,
        idempotencyKey: randomUUID(),
        occurredAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        retailerId: ids.retailer,
        invoiceId: ids.secondInvoice,
        direction: "debit",
        kind: "invoice",
        amount: 500,
        balanceAfter: 1_500,
        idempotencyKey: randomUUID(),
        occurredAt: new Date("2026-07-10T00:00:00.000Z"),
      },
    ],
  });
  await prisma.ledgerEntry.createMany({
    data: [
      {
        retailerId: ids.retailer,
        orderId: ids.firstOrder,
        type: "invoice",
        amount: 1_000,
        balanceAfter: 1_000,
        dueDate: new Date("2026-07-16T00:00:00.000Z"),
      },
      {
        retailerId: ids.retailer,
        orderId: ids.secondOrder,
        type: "invoice",
        amount: 500,
        balanceAfter: 1_500,
        dueDate: new Date("2026-07-25T00:00:00.000Z"),
      },
    ],
  });
  await prisma.payment.create({
    data: {
      id: ids.payment,
      retailerId: ids.retailer,
      amount: 1_200,
      status: "pending",
      channel: "online",
      provider: "test",
      providerRef: `provider-${ids.payment}`,
    },
  });
}

async function createAdvanceFixture() {
  await prisma.retailer.create({
    data: {
      id: ids.advanceRetailer,
      name: "Advance credit test retailer",
      shopAddress: "Test address",
      phone: `8${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
      tierId: ids.tier,
      creditLimit: 100_000,
      currentBalance: 0,
    },
  });
  await prisma.payment.create({
    data: {
      id: ids.advancePayment,
      retailerId: ids.advanceRetailer,
      amount: 100,
      status: "pending",
      channel: "manual",
    },
  });
}

afterAll(async () => {
  await prisma.financialLedgerEntry.deleteMany({
    where: { retailerId: ids.advanceRetailer },
  });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId: ids.advanceRetailer } });
  await prisma.payment.deleteMany({ where: { id: ids.advancePayment } });
  await prisma.retailer.deleteMany({ where: { id: ids.advanceRetailer } });
  await prisma.paymentAllocation.deleteMany({ where: { paymentId: ids.payment } });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.invoice.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.payment.deleteMany({ where: { id: ids.payment } });
  await prisma.order.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("settleSucceededPayment", () => {
  it("settles concurrent callbacks once and allocates oldest invoice first", async () => {
    await createFixture();
    const occurredAt = new Date("2026-08-20T12:00:00.000Z");

    const [first, second] = await Promise.all([
      settleSucceededPayment({ paymentId: ids.payment, occurredAt }),
      settleSucceededPayment({ paymentId: ids.payment, occurredAt }),
    ]);

    expect(first.paymentId).toBe(second.paymentId);
    expect(
      await prisma.financialLedgerEntry.count({ where: { paymentId: ids.payment } })
    ).toBe(1);
    expect(await prisma.ledgerEntry.count({ where: { paymentId: ids.payment } })).toBe(1);

    const allocations = await prisma.paymentAllocation.findMany({
      where: { paymentId: ids.payment },
      orderBy: { amount: "desc" },
    });
    expect(allocations.map((allocation) => [allocation.invoiceId, Number(allocation.amount)])).toEqual([
      [ids.firstInvoice, 1_000],
      [ids.secondInvoice, 200],
    ]);

    const [firstInvoice, secondInvoice, payment, retailer] = await Promise.all([
      prisma.invoice.findUniqueOrThrow({ where: { id: ids.firstInvoice } }),
      prisma.invoice.findUniqueOrThrow({ where: { id: ids.secondInvoice } }),
      prisma.payment.findUniqueOrThrow({ where: { id: ids.payment } }),
      prisma.retailer.findUniqueOrThrow({ where: { id: ids.retailer } }),
    ]);
    expect(firstInvoice.status).toBe("paid");
    expect(Number(firstInvoice.outstandingAmount)).toBe(0);
    expect(secondInvoice.status).toBe("partially_paid");
    expect(Number(secondInvoice.outstandingAmount)).toBe(300);
    expect(payment.status).toBe("succeeded");
    expect(Number(payment.unallocatedAmount)).toBe(0);
    expect(Number(retailer.currentBalance)).toBe(300);
  });

  it("rejects accidental overpayment unless advance credit is explicitly authorized", async () => {
    await createAdvanceFixture();
    const occurredAt = new Date("2026-08-20T12:30:00.000Z");

    await expect(
      settleSucceededPayment({ paymentId: ids.advancePayment, occurredAt })
    ).rejects.toMatchObject({ code: "advance_credit_not_authorized" });

    expect(
      await prisma.financialLedgerEntry.count({
        where: { paymentId: ids.advancePayment },
      })
    ).toBe(0);
    expect(
      await prisma.payment.findUniqueOrThrow({ where: { id: ids.advancePayment } })
    ).toMatchObject({ status: "pending" });

    const result = await settleSucceededPayment({
      paymentId: ids.advancePayment,
      occurredAt,
      allowAdvanceCredit: {
        actorStaffId: randomUUID(),
        reason: "Customer paid in advance for the next order",
      },
    });

    expect(result.unallocated).toBe(100);
    expect(result.balanceAfter).toBe(-100);
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: ids.advancePayment },
    });
    expect(payment.status).toBe("succeeded");
    expect(Number(payment.unallocatedAmount)).toBe(100);
  });
});
