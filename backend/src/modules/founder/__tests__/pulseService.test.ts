import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { DEFAULT_WAREHOUSE_CODE, upsertInventorySnapshot } from "../../inventory/inventoryService";
import { fillRate, VALID_ORDER_STATUSES } from "../metricsDomain";
import { periodForDay } from "../period";
import { PulseService } from "../pulseService";

const run = randomUUID();
const ids = {
  tier: `founder-tier-${run}`,
  product: `founder-product-${run}`,
  variant: `founder-variant-${run}`,
  retailer: `founder-retailer-${run}`,
  placed: `founder-placed-${run}`,
  delivered: `founder-delivered-${run}`,
  rejected: `founder-rejected-${run}`,
  assessment: `founder-assess-${run}`,
  request: `founder-req-${run}`,
  collection: `founder-col-${run}`,
  pendingCollection: `founder-pcol-${run}`,
};

const service = new PulseService(prisma);
const now = new Date("2026-09-02T08:30:00.000+05:30");

beforeAll(async () => {
  PulseService.clearCache();
  const policy = await prisma.creditPolicyVersion.findFirstOrThrow({ where: { active: true } });
  await prisma.tier.create({ data: { id: ids.tier, name: `Founder ${run}` } });
  await prisma.product.create({
    data: { id: ids.product, name: `Founder ${run}`, category: "test", sapMaterialId: `FND-${run}` },
  });
  await prisma.variant.create({
    data: { id: ids.variant, productId: ids.product, unitSize: "1", unit: "kg", unitsPerCase: 1, unitWeightKg: 1 },
  });
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: `Founder ${run}`,
      shopAddress: "Test",
      phone: `82${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "2")}`,
      tierId: ids.tier,
    },
  });
  await upsertInventorySnapshot(prisma, {
    productId: ids.product,
    variantId: ids.variant,
    sapMaterialId: `FND-${run}`,
    warehouseCode: DEFAULT_WAREHOUSE_CODE,
    onHand: 0,
    committed: 0,
    syncedAt: now,
  });
  await prisma.order.create({
    data: {
      id: ids.placed,
      retailerId: ids.retailer,
      status: "placed",
      orderTotal: 50_000,
      createdAt: now,
      items: { create: [{ variantId: ids.variant, qtyOrdered: 5, unitPrice: 10_000 }] },
    },
  });
  await prisma.order.create({
    data: {
      id: ids.delivered,
      retailerId: ids.retailer,
      status: "delivered",
      orderTotal: 20_000,
      createdAt: now,
      items: { create: [{ variantId: ids.variant, qtyOrdered: 10, qtyDelivered: 9, unitPrice: 2_000 }] },
    },
  });
  await prisma.order.create({
    data: {
      id: ids.rejected,
      retailerId: ids.retailer,
      status: "rejected",
      orderTotal: 99_999,
      createdAt: now,
    },
  });
  await prisma.creditAssessment.create({
    data: {
      id: ids.assessment,
      retailerId: ids.retailer,
      orderId: ids.placed,
      policyVersionId: policy.id,
      result: "approval_required",
      requiredPermission: "legal.decide",
      projectedExposure: 50_000,
      snapshot: {},
      reasons: ["new_customer_cap"],
    },
  });
  await prisma.approvalRequest.create({
    data: {
      id: ids.request,
      retailerId: ids.retailer,
      orderId: ids.placed,
      assessmentId: ids.assessment,
      subjectType: "order",
      subjectId: ids.placed,
      approvalType: "credit_cap",
      requiredPermission: "legal.decide",
      status: "open",
    },
  });
  await prisma.collectionSubmission.create({
    data: {
      id: ids.collection,
      retailerId: ids.retailer,
      collectorStaffId: "collector-founder",
      amount: 12_500,
      method: "upi",
      idempotencyKey: `founder-col-${run}`,
      status: "confirmed",
      submittedAt: now,
      confirmedAt: now,
    },
  });
  await prisma.collectionSubmission.create({
    data: {
      id: ids.pendingCollection,
      retailerId: ids.retailer,
      collectorStaffId: "collector-founder",
      amount: 8_000,
      method: "cash",
      idempotencyKey: `founder-pcol-${run}`,
      status: "pending",
      submittedAt: now,
    },
  });
});

afterAll(async () => {
  PulseService.clearCache();
  await prisma.collectionSubmission.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.approvalRequest.deleteMany({ where: { id: ids.request } });
  await prisma.creditAssessment.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.orderItem.deleteMany({ where: { order: { retailerId: ids.retailer } } });
  await prisma.order.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.inventorySnapshot.deleteMany({ where: { productId: ids.product } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.variant.delete({ where: { id: ids.variant } });
  await prisma.product.delete({ where: { id: ids.product } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

async function independentOrders() {
  const period = periodForDay(now);
  const rows = await prisma.order.findMany({
    where: {
      createdAt: { gte: period.start, lt: period.end },
      status: { in: [...VALID_ORDER_STATUSES] },
    },
    select: {
      orderTotal: true,
      status: true,
      items: { select: { qtyOrdered: true, qtyDelivered: true } },
    },
  });
  const collections = await prisma.collectionSubmission.aggregate({
    where: { status: "confirmed", confirmedAt: { gte: period.start, lt: period.end } },
    _sum: { amount: true },
  });
  const payments = await prisma.payment.aggregate({
    where: {
      status: "succeeded",
      settledAt: { gte: period.start, lt: period.end },
      collectionSubmission: { is: null },
    },
    _sum: { amount: true },
  });
  return {
    orders: rows.reduce((sum, row) => sum + Number(row.orderTotal), 0),
    collections: Number(collections._sum.amount ?? 0) + Number(payments._sum.amount ?? 0),
    fillRate: fillRate(
      rows.map((row) => ({
        status: row.status,
        items: row.items.map((item) => ({ qtyOrdered: item.qtyOrdered, qtyDelivered: item.qtyDelivered })),
      }))
    ),
  };
}

describe("founder pulse reconciliation", () => {
  it("matches canonical order, collection, and fill-rate aggregates", async () => {
    PulseService.clearCache();
    const pulse = await service.getPulse({ staffId: "founder-test", name: "Ananya", now });
    const expected = await independentOrders();
    const orders = pulse.metrics.find((row) => row.id === "orders");
    const collections = pulse.metrics.find((row) => row.id === "collections");
    const fill = pulse.metrics.find((row) => row.id === "fillRate");
    expect(orders?.availability).toBe("available");
    expect(orders?.value).toBe(expected.orders);
    expect(collections?.value).toBe(expected.collections);
    expect(fill?.value).toBe(expected.fillRate);
    expect(pulse.metrics.find((row) => row.id === "orders")?.value).not.toBe(expected.orders + 99_999);
  });

  it("counts a multi-blocker order once in unique blocked value", async () => {
    PulseService.clearCache();
    const before = await service.getPulse({ staffId: "founder-test", name: "Ananya", now });
    const unique = before.blocked.totalUniqueValue;
    const gross = before.blocked.grossConstraintImpact;
    expect(unique).toBeGreaterThanOrEqual(50_000);
    expect(gross).toBeGreaterThanOrEqual(unique);
    expect(before.blocked.categories.some((row) => row.id === "CREDIT")).toBe(true);
  });

  it("does not count pending collections or rejected orders", async () => {
    PulseService.clearCache();
    const pulse = await service.getPulse({ staffId: "founder-test", name: "Ananya", now });
    const collections = pulse.metrics.find((row) => row.id === "collections")?.value ?? 0;
    expect(collections).toBeGreaterThanOrEqual(12_500);
    expect(collections).not.toBe(20_500);
    expect(pulse.summary.greeting).toMatch(/Ananya/);
    expect(pulse.asOf).toBeTruthy();
    expect(pulse.health).toHaveLength(7);
  });
});
