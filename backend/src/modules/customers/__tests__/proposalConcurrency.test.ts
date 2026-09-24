import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../lib/prisma";
import { RetailerProposalService } from "../retailerProposalService";

const run = randomUUID();
const submitter = randomUUID(), reviewer = randomUUID(), tier = randomUUID();
const proposalIds: string[] = [];
const intentIds: string[] = [];
const products: string[] = [];
const variants: string[] = [];
const phones: string[] = [];
const service = new RetailerProposalService(prisma);
beforeAll(async () => {
  await prisma.tier.create({ data: { id: tier, name: `Proposal race ${run}` } });
  for (const id of [submitter, reviewer]) await prisma.staffUser.create({ data: {
    id, name: "Local concurrency fixture", phone: id, email: `${id}@example.test`,
  } });
});
afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { subjectType: "retailer_proposal_order_intent", subjectId: { in: intentIds } } });
  await prisma.retailerProposalOrderIntent.deleteMany({ where: { id: { in: intentIds } } });
  await prisma.auditEvent.deleteMany({ where: { subjectType: "retailer_proposal", subjectId: { in: proposalIds } } });
  await prisma.retailerProposal.deleteMany({ where: { id: { in: proposalIds } } });
  await prisma.retailerLocation.deleteMany({ where: { retailer: { phone: { in: phones } } } });
  await prisma.retailer.deleteMany({ where: { phone: { in: phones } } });
  await prisma.variant.deleteMany({ where: { id: { in: variants } } });
  await prisma.product.deleteMany({ where: { id: { in: products } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [submitter, reviewer] } } });
  await prisma.tier.deleteMany({ where: { id: tier } });
});

describe("proposal decisions are atomic", () => {
  it.each([
    ["approve", "withdraw"], ["approve", "reject"], ["approve", "approve"], ["reject", "withdraw"],
  ] as const)("%s vs %s permits one decision with no orphan customer", async (first, second) => {
    const phone = randomUUID(); phones.push(phone);
    const proposal = await prisma.retailerProposal.create({ data: {
      businessName: `Local ${run}`, phone, shopAddress: "Local fixture", submittedByStaffId: submitter, proposedTierId: tier,
    } });
    proposalIds.push(proposal.id);
    const act = (action: string) => action === "approve"
      ? service.approve({ proposalId: proposal.id, reviewerStaffId: reviewer, scopeStaffIds: [submitter] })
      : action === "reject"
        ? service.reject({ proposalId: proposal.id, reviewerStaffId: reviewer, reason: "Local test rejection", scopeStaffIds: [submitter] })
        : service.withdraw({ proposalId: proposal.id, salespersonId: submitter });
    const results = await Promise.allSettled([act(first), act(second)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const failed = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: "proposal_already_decided", status: 409 });
    const saved = await prisma.retailerProposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(await prisma.retailer.count({ where: { phone } })).toBe(saved.status === "approved" ? 1 : 0);
    expect(Boolean(saved.retailerId)).toBe(saved.status === "approved");
    expect(await prisma.auditEvent.count({ where: { subjectType: "retailer_proposal", subjectId: proposal.id } })).toBe(1);
    if (saved.status === "withdrawn") {
      const event = await prisma.auditEvent.findFirstOrThrow({ where: { subjectId: proposal.id } });
      expect(event.metadata).toMatchObject({ from: "pending", to: "withdrawn" });
    }
  });

  it("persists an unpriced order punch for a pending proposal without creating an official order", async () => {
    const phone = randomUUID();
    const productId = randomUUID();
    const variantId = randomUUID();
    phones.push(phone);
    products.push(productId);
    variants.push(variantId);
    const proposal = await prisma.retailerProposal.create({ data: {
      businessName: `Pending demand ${run}`,
      phone,
      shopAddress: "Local fixture",
      submittedByStaffId: submitter,
    } });
    proposalIds.push(proposal.id);
    await prisma.product.create({ data: {
      id: productId,
      name: "Test demand item",
      category: "Test",
      variants: { create: { id: variantId, unitSize: "1 kg", unit: "kg", unitsPerCase: 12 } },
    } });
    const createOfficialOrder = vi.fn();
    const demandService = new RetailerProposalService(prisma, undefined, createOfficialOrder as any);

    const intent = await demandService.punchOrderIntent({
      proposalId: proposal.id,
      salespersonId: submitter,
      idempotencyKey: "pending-demand-once",
      items: [{ variantId, qty: 2 }],
    });
    intentIds.push(intent.id);

    const saved = await prisma.retailerProposalOrderIntent.findUniqueOrThrow({
      where: { id: intent.id },
      include: { items: true },
    });
    expect(saved.items).toMatchObject([{ variantId, qty: 2, productName: "Test demand item", unitSize: "1 kg" }]);
    expect(saved.items[0]).not.toHaveProperty("unitPrice");
    await expect(demandService.punchOrderIntent({
      proposalId: proposal.id,
      salespersonId: submitter,
      idempotencyKey: "pending-demand-once",
      items: [{ variantId, qty: 2 }],
    })).resolves.toMatchObject({ id: intent.id });
    await expect(demandService.punchOrderIntent({
      proposalId: proposal.id,
      salespersonId: submitter,
      idempotencyKey: "pending-demand-once",
      items: [{ variantId, qty: 3 }],
    })).rejects.toMatchObject({ code: "idempotency_key_conflict", status: 409 });
    await expect(demandService.convertOrderIntent({ intentId: intent.id, salespersonId: submitter }))
      .rejects.toMatchObject({ code: "retailer_approval_required", status: 409 });
    expect(createOfficialOrder).not.toHaveBeenCalled();
    expect(await prisma.retailer.count({ where: { phone } })).toBe(0);
  });
});
