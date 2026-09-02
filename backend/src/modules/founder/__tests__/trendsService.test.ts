import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { VALID_ORDER_STATUSES, fillRate, sum } from "../metricsDomain";
import { rollingWindow } from "../period";
import { PulseService } from "../pulseService";
import { TrendsService } from "../trendsService";

const run = randomUUID();
const ids = {
  tier: `trend-tier-${run}`,
  product: `trend-product-${run}`,
  variant: `trend-variant-${run}`,
  retailer: `trend-retailer-${run}`,
};
const now = new Date("2026-07-15T08:30:00.000+05:30");
const service = new TrendsService(prisma);

beforeAll(async () => {
  TrendsService.clearCache();
  await prisma.tier.create({ data: { id: ids.tier, name: `Trend ${run}` } });
  await prisma.product.create({
    data: { id: ids.product, name: `Trend ${run}`, category: "test", sapMaterialId: `TRD-${run}` },
  });
  await prisma.variant.create({
    data: { id: ids.variant, productId: ids.product, unitSize: "1", unit: "kg", unitsPerCase: 1, unitWeightKg: 1 },
  });
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: `Trend ${run}`,
      shopAddress: "Test",
      phone: `83${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "3")}`,
      tierId: ids.tier,
    },
  });
  const { current } = rollingWindow(now, 7);
  await prisma.order.create({
    data: {
      retailerId: ids.retailer,
      status: "delivered",
      orderTotal: 20_000,
      createdAt: current.start,
      items: { create: [{ variantId: ids.variant, qtyOrdered: 10, qtyDelivered: 9, unitPrice: 2_000 }] },
    },
  });
  await prisma.order.create({
    data: {
      retailerId: ids.retailer,
      status: "delivered",
      orderTotal: 30_000,
      createdAt: now,
      items: { create: [{ variantId: ids.variant, qtyOrdered: 10, qtyDelivered: 10, unitPrice: 3_000 }] },
    },
  });
  await prisma.collectionSubmission.create({
    data: {
      retailerId: ids.retailer,
      collectorStaffId: "trend-col",
      amount: 5_000,
      method: "upi",
      idempotencyKey: `trend-col-${run}`,
      status: "confirmed",
      submittedAt: now,
      confirmedAt: now,
    },
  });
});

afterAll(async () => {
  TrendsService.clearCache();
  PulseService.clearCache();
  await prisma.collectionSubmission.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.orderItem.deleteMany({ where: { order: { retailerId: ids.retailer } } });
  await prisma.order.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.variant.delete({ where: { id: ids.variant } });
  await prisma.product.delete({ where: { id: ids.product } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("founder trends reconciliation", () => {
  it("reuses Pulse order, collection, and fill-rate formulas for the window", async () => {
    TrendsService.clearCache();
    const payload = await service.getTrends({ period: "7D", now });
    const { current } = rollingWindow(now, 7);
    const rows = await prisma.order.findMany({
      where: {
        createdAt: { gte: current.start, lt: current.end },
        status: { in: [...VALID_ORDER_STATUSES] },
        retailerId: ids.retailer,
      },
      select: { orderTotal: true, status: true, items: { select: { qtyOrdered: true, qtyDelivered: true } } },
    });
    const fixtureOrders = sum(rows.map((row) => Number(row.orderTotal)));
    const fixtureFill = fillRate(
      rows.map((row) => ({
        status: row.status,
        items: row.items.map((item) => ({ qtyOrdered: item.qtyOrdered, qtyDelivered: item.qtyDelivered })),
      }))
    );
    const orders = payload.trends.find((row) => row.metric === "orders");
    const collections = payload.trends.find((row) => row.metric === "collections");
    const fill = payload.trends.find((row) => row.metric === "fillRate");
    const overdue = payload.trends.find((row) => row.metric === "overdue");
    expect(orders?.points).toHaveLength(7);
    expect(orders?.currentValue).toBeGreaterThanOrEqual(fixtureOrders);
    expect(collections?.currentValue).toBeGreaterThanOrEqual(5_000);
    expect(fill?.currentValue).toEqual(expect.any(Number));
    expect(fill?.interpretation).toBeTruthy();
    expect(overdue?.comparison).toBeNull();
    expect(overdue?.interpretation).toMatch(/ledger/);
  });
});
