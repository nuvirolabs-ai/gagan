import { randomInt, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { issueCreditNote } from "../creditNoteService";
import { settleSucceededPayment } from "../paymentService";
import { reversePayment } from "../reversalService";

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  order: randomUUID(),
  invoice: randomUUID(),
  payment: randomUUID(),
  actor: randomUUID(),
};

async function createFixture() {
  await prisma.tier.create({
    data: { id: ids.tier, name: `correction-test-${ids.tier}` },
  });
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: "Financial correction test retailer",
      shopAddress: "Test address",
      phone: `7${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
      tierId: ids.tier,
      creditLimit: 10_000,
      currentBalance: 500,
    },
  });
  await prisma.order.create({
    data: {
      id: ids.order,
      retailerId: ids.retailer,
      status: "delivered",
      orderTotal: 500,
    },
  });
  await prisma.invoice.create({
    data: {
      id: ids.invoice,
      retailerId: ids.retailer,
      orderId: ids.order,
      invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
      dueDate: new Date("2026-08-16T00:00:00.000Z"),
      subtotal: 500,
      total: 500,
      outstandingAmount: 500,
      idempotencyKey: randomUUID(),
    },
  });
  await prisma.financialLedgerEntry.create({
    data: {
      retailerId: ids.retailer,
      invoiceId: ids.invoice,
      direction: "debit",
      kind: "invoice",
      amount: 500,
      balanceAfter: 500,
      idempotencyKey: randomUUID(),
      occurredAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      retailerId: ids.retailer,
      orderId: ids.order,
      type: "invoice",
      amount: 500,
      balanceAfter: 500,
      dueDate: new Date("2026-08-16T00:00:00.000Z"),
    },
  });
  await prisma.payment.create({
    data: {
      id: ids.payment,
      retailerId: ids.retailer,
      amount: 300,
      status: "pending",
      channel: "online",
      provider: "test",
      providerRef: `correction-${ids.payment}`,
    },
  });
  await settleSucceededPayment({
    paymentId: ids.payment,
    occurredAt: new Date("2026-08-20T09:00:00.000Z"),
  });
}

afterAll(async () => {
  await prisma.auditEvent.deleteMany({
    where: { subjectId: { in: [ids.invoice, ids.payment] } },
  });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.paymentReversalAllocation.deleteMany({
    where: { paymentReversal: { paymentId: ids.payment } },
  });
  await prisma.paymentReversal.deleteMany({ where: { paymentId: ids.payment } });
  await prisma.creditNote.deleteMany({ where: { invoiceId: ids.invoice } });
  await prisma.paymentAllocation.deleteMany({ where: { paymentId: ids.payment } });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.payment.deleteMany({ where: { id: ids.payment } });
  await prisma.invoice.deleteMany({ where: { id: ids.invoice } });
  await prisma.order.deleteMany({ where: { id: ids.order } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("financial corrections", () => {
  it("uses credit and reversal records without changing original ledger facts", async () => {
    await createFixture();
    const invoiceLedgerBefore = await prisma.financialLedgerEntry.findUniqueOrThrow({
      where: { invoiceId: ids.invoice },
    });
    const paymentLedgerBefore = await prisma.financialLedgerEntry.findUniqueOrThrow({
      where: { paymentId: ids.payment },
    });

    const creditInput = {
      invoiceId: ids.invoice,
      amount: 100,
      reason: "Verified delivery shortage",
      actorStaffId: ids.actor,
      occurredAt: new Date("2026-08-20T10:00:00.000Z"),
      idempotencyKey: randomUUID(),
    };
    const firstCredit = await issueCreditNote(creditInput);
    const repeatedCredit = await issueCreditNote(creditInput);
    expect(repeatedCredit.id).toBe(firstCredit.id);

    const firstReversalInput = {
      paymentId: ids.payment,
      amount: 150,
      reason: "Bank reversed half of the transfer",
      actorStaffId: ids.actor,
      occurredAt: new Date("2026-08-20T11:00:00.000Z"),
      idempotencyKey: randomUUID(),
    };
    const firstReversal = await reversePayment(firstReversalInput);
    expect((await reversePayment(firstReversalInput)).id).toBe(firstReversal.id);

    expect(
      await prisma.invoice.findUniqueOrThrow({ where: { id: ids.invoice } })
    ).toMatchObject({ status: "partially_paid" });
    expect(
      Number(
        (await prisma.invoice.findUniqueOrThrow({ where: { id: ids.invoice } }))
          .outstandingAmount
      )
    ).toBe(250);

    await reversePayment({
      ...firstReversalInput,
      amount: 150,
      reason: "Bank reversed the remaining transfer",
      occurredAt: new Date("2026-08-20T12:00:00.000Z"),
      idempotencyKey: randomUUID(),
    });

    await expect(
      reversePayment({
        ...firstReversalInput,
        amount: 1,
        idempotencyKey: randomUUID(),
      })
    ).rejects.toMatchObject({ code: "payment_fully_reversed" });
    await expect(
      issueCreditNote({
        ...creditInput,
        amount: 401,
        idempotencyKey: randomUUID(),
      })
    ).rejects.toMatchObject({ code: "credit_note_exceeds_invoice_total" });

    const [invoice, payment, retailer, invoiceLedgerAfter, paymentLedgerAfter] =
      await Promise.all([
        prisma.invoice.findUniqueOrThrow({ where: { id: ids.invoice } }),
        prisma.payment.findUniqueOrThrow({ where: { id: ids.payment } }),
        prisma.retailer.findUniqueOrThrow({ where: { id: ids.retailer } }),
        prisma.financialLedgerEntry.findUniqueOrThrow({ where: { invoiceId: ids.invoice } }),
        prisma.financialLedgerEntry.findUniqueOrThrow({ where: { paymentId: ids.payment } }),
      ]);

    expect(invoice.status).toBe("partially_paid");
    expect(Number(invoice.outstandingAmount)).toBe(400);
    expect(payment.status).toBe("reversed");
    expect(Number(retailer.currentBalance)).toBe(400);
    expect(invoiceLedgerAfter).toEqual(invoiceLedgerBefore);
    expect(paymentLedgerAfter).toEqual(paymentLedgerBefore);
    expect(await prisma.creditNote.count({ where: { invoiceId: ids.invoice } })).toBe(1);
    expect(await prisma.paymentReversal.count({ where: { paymentId: ids.payment } })).toBe(2);
    expect(
      await prisma.financialLedgerEntry.count({
        where: { retailerId: ids.retailer, kind: { in: ["credit_note", "payment_reversal"] } },
      })
    ).toBe(3);
    expect(
      await prisma.auditEvent.count({
        where: { subjectId: { in: [ids.invoice, ids.payment] } },
      })
    ).toBe(3);
  });
});
