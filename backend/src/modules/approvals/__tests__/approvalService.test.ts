import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { ApprovalService, ApprovalServiceError } from "../approvalService";

const run = randomUUID();
const ids = {
  tier: `approval-tier-${run}`,
  product: `approval-product-${run}`,
  variant: `approval-variant-${run}`,
  retailer: `approval-retailer-${run}`,
  order: `approval-order-${run}`,
  invoice: `approval-invoice-${run}`,
  assessment: `approval-assessment-${run}`,
  request: `approval-request-${run}`,
};

beforeAll(async () => {
  const policy = await prisma.creditPolicyVersion.findFirstOrThrow({ where: { active: true } });
  await prisma.tier.create({ data: { id: ids.tier, name: `Approval ${run}` } });
  await prisma.product.create({ data: { id: ids.product, name: `Approval ${run}`, category: "test" } });
  await prisma.variant.create({
    data: { id: ids.variant, productId: ids.product, unitSize: "1", unit: "case", unitWeightKg: 1 },
  });
  await prisma.priceList.create({
    data: { tierId: ids.tier, productId: ids.product, variantId: ids.variant, price: 10_000 },
  });
  await prisma.retailer.create({
    data: { id: ids.retailer, name: ids.retailer, shopAddress: "Test", phone: `83${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "3")}`, tierId: ids.tier },
  });
  await prisma.creditProfile.create({
    data: { retailerId: ids.retailer, rating: "N", kycVerifiedAt: new Date() },
  });
  const invoiceDate = new Date();
  invoiceDate.setUTCDate(invoiceDate.getUTCDate() - 10);
  await prisma.invoice.create({
    data: {
      id: ids.invoice,
      retailerId: ids.retailer,
      invoiceDate,
      dueDate: new Date(),
      subtotal: 10_000,
      total: 10_000,
      outstandingAmount: 10_000,
      idempotencyKey: `approval-invoice-${run}`,
    },
  });
  await prisma.order.create({
    data: {
      id: ids.order,
      retailerId: ids.retailer,
      orderTotal: 10_000,
      items: { create: [{ variantId: ids.variant, qtyOrdered: 1, unitPrice: 10_000 }] },
    },
  });
  await prisma.creditAssessment.create({
    data: {
      id: ids.assessment,
      retailerId: ids.retailer,
      orderId: ids.order,
      policyVersionId: policy.id,
      result: "approval_required",
      requiredPermission: "approval.second_invoice",
      projectedExposure: 20_000,
      snapshot: {},
      reasons: ["new_customer_second_invoice"],
    },
  });
  await prisma.approvalRequest.create({
    data: {
      id: ids.request,
      retailerId: ids.retailer,
      orderId: ids.order,
      assessmentId: ids.assessment,
      subjectType: "order",
      subjectId: ids.order,
      approvalType: "second_invoice",
      requiredPermission: "approval.second_invoice",
    },
  });
});

afterAll(async () => {
  await prisma.sapOutbox.deleteMany({ where: { referenceId: ids.order } });
  await prisma.dispatchAuthorization.deleteMany({ where: { orderId: ids.order } });
  await prisma.approvalDecision.deleteMany({ where: { approvalRequestId: ids.request } });
  await prisma.approvalEscalation.deleteMany({ where: { approvalRequestId: ids.request } });
  await prisma.approvalDispute.deleteMany({ where: { approvalRequestId: ids.request } });
  await prisma.approvalRequest.deleteMany({ where: { id: ids.request } });
  await prisma.creditAssessment.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.invoice.delete({ where: { id: ids.invoice } });
  await prisma.orderItem.deleteMany({ where: { orderId: ids.order } });
  await prisma.order.delete({ where: { id: ids.order } });
  await prisma.creditProfile.delete({ where: { retailerId: ids.retailer } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.priceList.deleteMany({ where: { variantId: ids.variant } });
  await prisma.variant.delete({ where: { id: ids.variant } });
  await prisma.product.delete({ where: { id: ids.product } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("shared approval service", () => {
  it("returns only requests the staff member can decide", async () => {
    const service = new ApprovalService();
    const visible = await service.list(["approval.second_invoice"]);
    const hidden = await service.list(["collection.confirm"]);
    expect(visible.some((request) => request.id === ids.request)).toBe(true);
    expect(hidden.some((request) => request.id === ids.request)).toBe(false);
  });

  it("allows exactly one concurrent final decision and issues dispatch authority", async () => {
    const service = new ApprovalService();
    const outcomes = await Promise.allSettled([
      service.decide(ids.request, { actorStaffId: "approver-1", actorPermissions: ["approval.second_invoice"], result: "approved", reason: "Within policy" }),
      service.decide(ids.request, { actorStaffId: "approver-2", actorPermissions: ["approval.second_invoice"], result: "rejected", reason: "Too much risk" }),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);

    const request = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: ids.request } });
    expect(["approved", "rejected"]).toContain(request.status);
    expect(await prisma.approvalDecision.count({ where: { approvalRequestId: ids.request } })).toBe(1);
    if (request.status === "approved") {
      expect(await prisma.dispatchAuthorization.count({ where: { orderId: ids.order, status: "active" } })).toBe(1);
    }
  });

  it("rejects a second decision as an explicit conflict", async () => {
    const service = new ApprovalService();
    await expect(
      service.decide(ids.request, { actorStaffId: "approver-3", actorPermissions: ["approval.second_invoice"], result: "approved", reason: "Retry" })
    ).rejects.toMatchObject({ code: "approval_already_decided", status: 409 } satisfies Partial<ApprovalServiceError>);
  });
});
