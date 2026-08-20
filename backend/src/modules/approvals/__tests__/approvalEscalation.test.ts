import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { processApprovalEscalations } from "../../../worker/processors/approvalEscalation";
import { DisputeService } from "../disputeService";

const run = randomUUID();
const ids = {
  tier: `sla-tier-${run}`,
  retailer: `sla-retailer-${run}`,
  order: `sla-order-${run}`,
  assessment: `sla-assessment-${run}`,
  request: `sla-request-${run}`,
};

beforeAll(async () => {
  const policy = await prisma.creditPolicyVersion.findFirstOrThrow({ where: { active: true } });
  await prisma.tier.create({ data: { id: ids.tier, name: `SLA ${run}` } });
  await prisma.retailer.create({
    data: { id: ids.retailer, name: ids.retailer, shopAddress: "Test", phone: `84${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "4")}`, tierId: ids.tier },
  });
  await prisma.creditProfile.create({
    data: { retailerId: ids.retailer, rating: "N", kycVerifiedAt: new Date() },
  });
  await prisma.order.create({ data: { id: ids.order, retailerId: ids.retailer, orderTotal: 1_000 } });
  await prisma.creditAssessment.create({
    data: {
      id: ids.assessment,
      retailerId: ids.retailer,
      orderId: ids.order,
      policyVersionId: policy.id,
      result: "approval_required",
      requiredPermission: "approval.third_invoice",
      projectedExposure: 1_000,
      snapshot: {},
      reasons: ["new_customer_third_invoice"],
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
      approvalType: "third_invoice",
      requiredPermission: "approval.third_invoice",
      deadlineAt: new Date("2026-08-20T10:00:00.000Z"),
    },
  });
});

afterAll(async () => {
  await prisma.sapOutbox.deleteMany({ where: { referenceId: ids.order } });
  await prisma.dispatchAuthorization.deleteMany({ where: { orderId: ids.order } });
  await prisma.auditEvent.deleteMany({ where: { subjectId: ids.request } });
  await prisma.approvalEscalation.deleteMany({ where: { approvalRequestId: ids.request } });
  await prisma.approvalDispute.deleteMany({ where: { approvalRequestId: ids.request } });
  await prisma.approvalRequest.delete({ where: { id: ids.request } });
  await prisma.creditAssessment.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.order.delete({ where: { id: ids.order } });
  await prisma.creditProfile.delete({ where: { retailerId: ids.retailer } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("approval escalation processor", () => {
  it("escalates a 48-hour third-invoice timeout exactly once to Founder/Director", async () => {
    const now = new Date("2026-08-20T10:01:00.000Z");
    await expect(processApprovalEscalations({ now })).resolves.toMatchObject({ escalated: 1 });
    await expect(processApprovalEscalations({ now })).resolves.toMatchObject({ escalated: 0 });

    const request = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: ids.request } });
    expect(request).toMatchObject({ status: "escalated", requiredPermission: "legal.decide" });
    expect(await prisma.approvalEscalation.count({ where: { approvalRequestId: ids.request } })).toBe(1);
    expect(await prisma.dispatchAuthorization.count({ where: { orderId: ids.order } })).toBe(0);
  });

  it("opens a written dispute with working-hour acknowledgment and 24-hour decision SLAs", async () => {
    const service = new DisputeService();
    const dispute = await service.raise(ids.request, {
      actorStaffId: "sales-coordinator-1",
      actorPermissions: ["approval.second_invoice"],
      writtenPosition: "Customer payment evidence supports reconsideration.",
      now: new Date("2026-08-21T10:30:00.000Z"),
    });
    expect(dispute.acknowledgmentDueAt).toEqual(new Date("2026-08-24T06:30:00.000Z"));

    const acknowledged = await service.acknowledge(dispute.id, {
      actorStaffId: "credit-lead-1",
      actorPermissions: ["approval.third_invoice"],
      now: new Date("2026-08-24T05:00:00.000Z"),
    });
    expect(acknowledged.decisionDueAt).toEqual(new Date("2026-08-25T05:00:00.000Z"));
    expect(await prisma.dispatchAuthorization.count({ where: { orderId: ids.order } })).toBe(0);

    const resolved = await service.resolve(dispute.id, {
      actorStaffId: "credit-lead-1",
      actorPermissions: ["approval.third_invoice"],
      outcome: "approved",
      resolution: "Accounts verified that the supporting evidence is valid.",
      now: new Date("2026-08-24T06:00:00.000Z"),
    });
    expect(resolved).toMatchObject({ status: "resolved", outcome: "approved" });
    expect(await prisma.dispatchAuthorization.count({ where: { orderId: ids.order, status: "active" } })).toBe(1);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: ids.order } })).toMatchObject({ status: "placed" });
  });
});
