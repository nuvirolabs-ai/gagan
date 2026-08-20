import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { createOrderForRetailer } from "../../../lib/orders";

const run = randomUUID();
const ids = {
  tier: `credit-tier-${run}`,
  product: `credit-product-${run}`,
  variant: `credit-variant-${run}`,
  concurrentRetailer: `credit-concurrent-${run}`,
  chainRetailer: `credit-chain-${run}`,
  overdueRetailer: `credit-overdue-${run}`,
};

beforeAll(async () => {
  await prisma.appConfig.update({
    where: { id: "singleton" },
    data: {
      creditRolloutMode: "enforce",
      creditPolicyApprovedAt: new Date(),
      creditPolicyApprovedByStaffId: "test-credit-lead",
      creditPolicyApprovedVersion: 4,
    },
  });
  await prisma.tier.create({ data: { id: ids.tier, name: `Credit test ${run}` } });
  await prisma.product.create({
    data: { id: ids.product, name: `Credit product ${run}`, category: "test" },
  });
  await prisma.variant.create({
    data: {
      id: ids.variant,
      productId: ids.product,
      unitSize: "1",
      unit: "case",
      unitsPerCase: 1,
      unitWeightKg: 1,
    },
  });
  await prisma.priceList.create({
    data: {
      tierId: ids.tier,
      productId: ids.product,
      variantId: ids.variant,
      price: 10_000,
    },
  });

  for (const [id, phone] of [
    [ids.concurrentRetailer, `81${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "1")}`],
    [ids.chainRetailer, `80${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "0")}`],
    [ids.overdueRetailer, `82${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "2")}`],
  ]) {
    await prisma.retailer.create({
      data: { id, name: id, shopAddress: "Test", phone, tierId: ids.tier, creditLimit: 500_000 },
    });
    await prisma.creditProfile.create({
      data: {
        retailerId: id,
        rating: "N",
        billingPattern: "unknown",
        ...( { kycVerifiedAt: new Date() } as Record<string, unknown> ),
      } as any,
    });
  }

  const invoiceDate = new Date();
  invoiceDate.setUTCDate(invoiceDate.getUTCDate() - 46);
  await prisma.invoice.create({
    data: {
      retailerId: ids.overdueRetailer,
      invoiceDate,
      dueDate: invoiceDate,
      subtotal: 5_000,
      total: 5_000,
      outstandingAmount: 5_000,
      idempotencyKey: `credit-overdue-${run}`,
    },
  });
});

afterAll(async () => {
  const retailerIds = [ids.concurrentRetailer, ids.chainRetailer, ids.overdueRetailer];
  const orders = await prisma.order.findMany({ where: { retailerId: { in: retailerIds } }, select: { id: true } });
  const orderIds = orders.map((order) => order.id);
  await prisma.sapOutbox.deleteMany({ where: { referenceId: { in: orderIds } } });
  await prisma.dispatchAuthorization.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.approvalDecision.deleteMany({ where: { approvalRequest: { retailerId: { in: retailerIds } } } });
  await prisma.approvalEscalation.deleteMany({ where: { approvalRequest: { retailerId: { in: retailerIds } } } });
  await prisma.approvalDispute.deleteMany({ where: { approvalRequest: { retailerId: { in: retailerIds } } } });
  await prisma.approvalRequest.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.creditDecisionComparison.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.creditAssessment.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.invoice.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.creditProfile.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.retailer.deleteMany({ where: { id: { in: retailerIds } } });
  await prisma.priceList.deleteMany({ where: { variantId: ids.variant } });
  await prisma.variant.delete({ where: { id: ids.variant } });
  await prisma.product.delete({ where: { id: ids.product } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.appConfig.update({
    where: { id: "singleton" },
    data: { creditRolloutMode: "shadow", creditPolicyApprovedAt: null, creditPolicyApprovedByStaffId: null, creditPolicyApprovedVersion: null },
  });
  await prisma.$disconnect();
});

describe("atomic order credit enforcement", () => {
  it("includes pending exposure when two orders are placed concurrently", async () => {
    const [first, second] = await Promise.all([
      createOrderForRetailer(ids.concurrentRetailer, [{ variantId: ids.variant, qty: 1 }], "retailer"),
      createOrderForRetailer(ids.concurrentRetailer, [{ variantId: ids.variant, qty: 1 }], "retailer"),
    ]);

    const decisions = [first, second].map((result) => (result as any).decision?.result).sort();
    expect(decisions).toEqual(["allowed", "approval_required"]);
    expect(await prisma.creditAssessment.count({ where: { retailerId: ids.concurrentRetailer } })).toBe(2);
    expect(await prisma.approvalRequest.count({ where: { retailerId: ids.concurrentRetailer, status: "open" } })).toBe(1);
    expect(await prisma.dispatchAuthorization.count({ where: { order: { retailerId: ids.concurrentRetailer }, status: "active" } })).toBe(1);
  });

  it("persists blocked evidence without creating an order", async () => {
    const result = await createOrderForRetailer(
      ids.overdueRetailer,
      [{ variantId: ids.variant, qty: 1 }],
      "retailer"
    );
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      body: { decision: { result: "blocked", reasons: ["invoice_overdue_45_days"] } },
    });
    expect(await prisma.order.count({ where: { retailerId: ids.overdueRetailer } })).toBe(0);
    expect(await prisma.creditAssessment.count({ where: { retailerId: ids.overdueRetailer, result: "blocked" } })).toBe(1);
  });

  it("blocks the fourth N-stage order even before earlier orders become invoices", async () => {
    const results = [];
    for (let index = 0; index < 4; index++) {
      results.push(await createOrderForRetailer(
        ids.chainRetailer,
        [{ variantId: ids.variant, qty: 1 }],
        "retailer"
      ));
    }
    expect(results.slice(0, 3).map((result: any) => result.decision.result))
      .toEqual(["allowed", "approval_required", "approval_required"]);
    expect(results[3]).toMatchObject({
      ok: false,
      status: 409,
      body: { decision: { result: "blocked", reasons: ["new_customer_fourth_blocked"] } },
    });
    expect(await prisma.order.count({ where: { retailerId: ids.chainRetailer } })).toBe(3);
  });
});
