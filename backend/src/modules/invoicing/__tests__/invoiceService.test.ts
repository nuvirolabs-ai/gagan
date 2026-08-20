import { randomInt, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { createInvoiceForDelivery } from "../invoiceService";

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  product: randomUUID(),
  variant: randomUUID(),
  order: randomUUID(),
  firstItem: randomUUID(),
  secondItem: randomUUID(),
  validationOrder: randomUUID(),
  validationFirstItem: randomUUID(),
  validationSecondItem: randomUUID(),
};

async function createFixture() {
  await prisma.tier.create({
    data: {
      id: ids.tier,
      name: `invoice-test-${ids.tier}`,
      paymentTermDays: 15,
    },
  });
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: "Invoice concurrency test retailer",
      shopAddress: "Test address",
      phone: `9${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
      tierId: ids.tier,
      creditLimit: 100_000,
    },
  });
  await prisma.product.create({
    data: {
      id: ids.product,
      name: `Invoice test product ${ids.product}`,
      category: "Test",
      variants: {
        create: {
          id: ids.variant,
          unitSize: "1 kg",
          unit: "kg",
          unitsPerCase: 10,
          unitWeightKg: 1,
        },
      },
    },
  });
  await prisma.order.create({
    data: {
      id: ids.order,
      retailerId: ids.retailer,
      status: "out_for_delivery",
      orderTotal: 2_000,
      items: {
        create: [
          { id: ids.firstItem, variantId: ids.variant, qtyOrdered: 2, unitPrice: 1_000 },
          { id: ids.secondItem, variantId: ids.variant, qtyOrdered: 1, unitPrice: 1_000 },
        ],
      },
    },
  });
}

afterAll(async () => {
  const legacyEntries = await prisma.ledgerEntry.findMany({
    where: { retailerId: ids.retailer },
    select: { id: true },
  });
  await prisma.sapOutbox.deleteMany({
    where: { referenceId: { in: legacyEntries.map(({ id }) => id) } },
  });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { orderId: ids.order } } });
  await prisma.invoice.deleteMany({ where: { orderId: ids.order } });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.delivery.deleteMany({ where: { orderId: ids.order } });
  await prisma.orderItem.deleteMany({ where: { orderId: ids.order } });
  await prisma.orderItem.deleteMany({ where: { orderId: ids.validationOrder } });
  await prisma.order.deleteMany({ where: { id: ids.validationOrder } });
  await prisma.order.deleteMany({ where: { id: ids.order } });
  await prisma.variant.deleteMany({ where: { id: ids.variant } });
  await prisma.product.deleteMany({ where: { id: ids.product } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("createInvoiceForDelivery", () => {
  it("creates one invoice and one debit when two delivery completions race", async () => {
    await createFixture();
    const occurredAt = new Date("2026-08-20T10:00:00.000Z");
    const lines = [
      { orderItemId: ids.firstItem, deliveredCases: 2 },
      { orderItemId: ids.secondItem, deliveredCases: 1 },
    ];
    const firstKey = randomUUID();
    const secondKey = randomUUID();

    const [first, second] = await Promise.all([
      createInvoiceForDelivery({
        orderId: ids.order,
        lines,
        occurredAt,
        idempotencyKey: firstKey,
      }),
      createInvoiceForDelivery({
        orderId: ids.order,
        lines,
        occurredAt,
        idempotencyKey: secondKey,
      }),
    ]);
    const repeated = await createInvoiceForDelivery({
      orderId: ids.order,
      lines,
      occurredAt,
      idempotencyKey: firstKey,
    });

    expect(first.id).toBe(second.id);
    expect(repeated.id).toBe(first.id);
    expect(await prisma.invoice.count({ where: { orderId: ids.order } })).toBe(1);
    expect(await prisma.financialLedgerEntry.count({ where: { invoiceId: first.id } })).toBe(1);
    expect(
      await prisma.ledgerEntry.count({
        where: { orderId: ids.order, type: "invoice" },
      })
    ).toBe(1);
    const storedInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: first.id },
    });
    const legacyInvoice = await prisma.ledgerEntry.findFirstOrThrow({
      where: { orderId: ids.order, type: "invoice" },
    });
    expect(storedInvoice.legacyLedgerEntryId).toBe(legacyInvoice.id);
    expect(await prisma.order.findUnique({ where: { id: ids.order } })).toMatchObject({
      status: "delivered",
    });
    const retailer = await prisma.retailer.findUniqueOrThrow({ where: { id: ids.retailer } });
    expect(Number(retailer.currentBalance)).toBe(3000);
  });

  it("rejects delivery completion until every order line is resolved", async () => {
    await prisma.order.create({
      data: {
        id: ids.validationOrder,
        retailerId: ids.retailer,
        status: "out_for_delivery",
        orderTotal: 2_000,
        items: {
          create: [
            {
              id: ids.validationFirstItem,
              variantId: ids.variant,
              qtyOrdered: 1,
              unitPrice: 1_000,
            },
            {
              id: ids.validationSecondItem,
              variantId: ids.variant,
              qtyOrdered: 1,
              unitPrice: 1_000,
            },
          ],
        },
      },
    });

    await expect(
      createInvoiceForDelivery({
        orderId: ids.validationOrder,
        lines: [{ orderItemId: ids.validationFirstItem, deliveredCases: 1 }],
        occurredAt: new Date("2026-08-20T11:00:00.000Z"),
        idempotencyKey: randomUUID(),
      })
    ).rejects.toMatchObject({ code: "incomplete_delivery_resolution" });
    expect(await prisma.invoice.count({ where: { orderId: ids.validationOrder } })).toBe(0);
  });
});
