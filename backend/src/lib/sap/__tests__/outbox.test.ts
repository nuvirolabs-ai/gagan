import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enqueueSalesOrder, drainOutbox } from "../outbox";
import { prisma } from "../../prisma";
import type { SapConnector } from "../connector";

const orderIds: string[] = [];

beforeAll(async () => {
  const retailer = await prisma.retailer.findFirst({ select: { id: true } });
  const variant = await prisma.variant.findFirst({ select: { id: true } });
  if (!retailer || !variant) throw new Error("Outbox test requires seeded retailer and variant");

  const order = await prisma.order.create({
    data: {
      retailerId: retailer.id,
      orderTotal: 1,
      items: { create: [{ variantId: variant.id, qtyOrdered: 1, unitPrice: 1 }] },
    },
  });
  orderIds.push(order.id);
  await enqueueSalesOrder(prisma, order.id);
});

afterAll(async () => {
  await prisma.sapOutbox.deleteMany({ where: { referenceId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.$disconnect();
});

describe("SAP sales-order outbox", () => {
  it("reconciles an order created before a lost response instead of posting twice", async () => {
    let postCalls = 0;
    const accepted = new Map<string, string>();
    const connector = {
      enabled: true,
      name: "test",
      fetchCustomers: async () => [],
      fetchMaterials: async () => [],
      fetchPricing: async () => [],
      fetchStock: async () => [],
      findSalesOrderByExternalReference: async (externalReference: string) => {
        const sapSalesOrderId = accepted.get(externalReference);
        return sapSalesOrderId ? { sapSalesOrderId } : null;
      },
      postSalesOrder: async (payload: { orderId: string }) => {
        postCalls += 1;
        const sapSalesOrderId = `SAP-SO-RECOVER-${randomUUID()}`;
        accepted.set(payload.orderId, sapSalesOrderId);
        throw new Error("response lost after SAP commit");
      },
      postInvoice: async () => ({ sapInvoiceId: "unused" }),
    } as unknown as SapConnector;

    const first = await drainOutbox(25, connector, orderIds[0]);
    expect(first).toMatchObject({ attempted: 1, sent: 0, failed: 1 });
    expect(await prisma.sapOutbox.findUnique({ where: { kind_referenceId: { kind: "sales_order", referenceId: orderIds[0] } } }))
      .toMatchObject({ status: "pending", attempts: 1 });

    const second = await drainOutbox(25, connector, orderIds[0]);
    expect(second).toMatchObject({ attempted: 1, sent: 1, failed: 0 });
    expect(postCalls).toBe(1);
    const [outbox, order] = await Promise.all([
      prisma.sapOutbox.findUnique({ where: { kind_referenceId: { kind: "sales_order", referenceId: orderIds[0] } } }),
      prisma.order.findUnique({ where: { id: orderIds[0] }, select: { sapSalesOrderId: true } }),
    ]);
    expect(outbox).toMatchObject({ status: "sent", attempts: 2, sapId: accepted.get(orderIds[0]) });
    expect(order?.sapSalesOrderId).toBe(accepted.get(orderIds[0]));
  });
});
