import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enqueueSalesOrder, drainOutbox } from "../outbox";
import { prisma } from "../../prisma";
import type { SapConnector } from "../connector";

const orderIds: string[] = [];
let retailerId: string;
let variantId: string;

beforeAll(async () => {
  const retailer = await prisma.retailer.findFirst({ select: { id: true } });
  const variant = await prisma.variant.findFirst({ select: { id: true, productId: true } });
  if (!retailer || !variant) throw new Error("Outbox test requires seeded retailer and variant");
  retailerId = retailer.id;
  variantId = variant.id;
  await prisma.retailer.update({ where: { id: retailer.id }, data: { sapCustomerId: "TEST-CARD-001" } });
  await prisma.product.update({ where: { id: variant.productId }, data: { sapMaterialId: "TEST-ITEM-001" } });

  const policy = await prisma.creditPolicyVersion.findFirstOrThrow({ where: { active: true } });
  const order = await prisma.order.create({
    data: {
      retailerId: retailer.id,
      orderTotal: 1,
      items: { create: [{ variantId: variant.id, qtyOrdered: 1, unitPrice: 1 }] },
    },
  });
  orderIds.push(order.id);
  const assessment = await prisma.creditAssessment.create({
    data: {
      retailerId: retailer.id,
      orderId: order.id,
      policyVersionId: policy.id,
      result: "allowed",
      projectedExposure: 1,
      snapshot: {},
      reasons: [],
    },
  });
  await prisma.dispatchAuthorization.create({
    data: { orderId: order.id, assessmentId: assessment.id, version: 1, reason: "Authorized outbox test" },
  });
  await enqueueSalesOrder(prisma, order.id);
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { subjectId: { in: orderIds } } });
  await prisma.sapOutbox.deleteMany({ where: { referenceId: { in: orderIds } } });
  await prisma.dispatchAuthorization.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.creditAssessment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.$disconnect();
});

describe("SAP sales-order outbox", () => {
  it("does not queue captured demand without current dispatch authorization", async () => {
    const order = await prisma.order.create({
      data: {
        retailerId,
        orderTotal: 1,
        items: { create: [{ variantId, qtyOrdered: 1, unitPrice: 1 }] },
      },
    });
    orderIds.push(order.id);

    await expect(enqueueSalesOrder(prisma, order.id)).rejects.toThrow("sales_order_dispatch_not_authorized");
    const policy = await prisma.creditPolicyVersion.findFirstOrThrow({ where: { active: true } });
    const assessment = await prisma.creditAssessment.create({
      data: {
        retailerId,
        orderId: order.id,
        policyVersionId: policy.id,
        result: "allowed",
        projectedExposure: 1,
        snapshot: {},
        reasons: [],
      },
    });
    await prisma.dispatchAuthorization.create({
      data: {
        orderId: order.id,
        assessmentId: assessment.id,
        version: 1,
        reason: "Expired authorization test",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await expect(enqueueSalesOrder(prisma, order.id)).rejects.toThrow("sales_order_dispatch_not_authorized");
    expect(await prisma.sapOutbox.findUnique({
      where: { kind_referenceId: { kind: "sales_order", referenceId: order.id } },
    })).toBeNull();
    expect(await prisma.commercialStatusEvent.findFirst({ where: { orderId: order.id } })).toBeNull();
  });

  it("reconciles an order created before a lost response instead of posting twice", async () => {
    await enqueueSalesOrder(prisma, orderIds[0]);
    expect(await prisma.sapOutbox.count({ where: { kind: "sales_order", referenceId: orderIds[0] } })).toBe(1);
    const lifecycleEvents = await prisma.commercialStatusEvent.findMany({
      where: { orderId: orderIds[0] },
      select: { code: true },
    });
    expect(lifecycleEvents.filter((event) => event.code === "SALES_ORDER_CREATED")).toHaveLength(1);

    let postCalls = 0;
    const accepted = new Map<string, { sapSalesOrderId: string; sapDocEntry: number; sapDocNum: number }>();
    const connector = {
      enabled: true,
      name: "test",
      fetchCustomers: async () => [],
      fetchMaterials: async () => [],
      fetchPricing: async () => [],
      fetchStock: async () => [],
      findSalesOrderByExternalReference: async (externalReference: string) => {
        return accepted.get(externalReference) ?? null;
      },
      postSalesOrder: async (payload: { externalReference: string }) => {
        postCalls += 1;
        const sapSalesOrderId = `SAP-SO-RECOVER-${randomUUID()}`;
        accepted.set(payload.externalReference, { sapSalesOrderId, sapDocEntry: 990001, sapDocNum: 990001 });
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
      prisma.order.findUnique({ where: { id: orderIds[0] }, select: { sapSalesOrderId: true, sapDocEntry: true, sapDocNum: true, sapSyncStatus: true } }),
    ]);
    const payload = outbox?.payload as { externalReference: string } | undefined;
    const acceptedResult = accepted.get(payload?.externalReference ?? "");
    expect(outbox).toMatchObject({ status: "sent", attempts: 2, sapId: acceptedResult?.sapSalesOrderId });
    expect(order).toMatchObject({
      sapSalesOrderId: acceptedResult?.sapSalesOrderId,
      sapDocEntry: 990001,
      sapDocNum: 990001,
      sapSyncStatus: "sent",
    });
  });
});
