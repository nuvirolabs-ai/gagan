import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { RatingService } from "../ratingService";

const run = randomUUID();
const ids = { tier: `rating-tier-${run}`, retailer: `rating-retailer-${run}`, proposal: `rating-proposal-${run}` };

beforeAll(async () => {
  const policy = await prisma.creditPolicyVersion.findFirstOrThrow({ where: { active: true } });
  await prisma.tier.create({ data: { id: ids.tier, name: `Rating ${run}` } });
  const retailer = await prisma.retailer.create({
    data: { id: ids.retailer, name: ids.retailer, shopAddress: "Test", phone: `85${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "5")}`, tierId: ids.tier },
  });
  const profile = await prisma.creditProfile.create({
    data: { retailerId: retailer.id, rating: "N", billingPattern: "regular", cleanInvoiceCount: 3 },
  });
  await prisma.ratingProposal.create({
    data: {
      id: ids.proposal,
      creditProfileId: profile.id,
      policyVersionId: policy.id,
      previousRating: "N",
      proposedRating: "A",
      trigger: "quarterly_checkpoint",
      evidence: { cleanInvoiceCount: 3, averageDso: 28 },
      idempotencyKey: `rating-${run}`,
    },
  });
});

afterAll(async () => {
  const profile = await prisma.creditProfile.findUnique({ where: { retailerId: ids.retailer } });
  if (profile) {
    await prisma.ratingHistory.deleteMany({ where: { creditProfileId: profile.id } });
    await prisma.ratingProposal.deleteMany({ where: { creditProfileId: profile.id } });
  }
  await prisma.creditProfile.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("rating confirmation", () => {
  it("confirms a proposal into ordered history exactly once", async () => {
    const service = new RatingService();
    await service.confirm(ids.proposal, { actorStaffId: "credit-lead-1", reason: "Quarterly review verified" });
    await expect(service.confirm(ids.proposal, { actorStaffId: "credit-lead-1", reason: "Retry" }))
      .rejects.toMatchObject({ code: "rating_proposal_closed", status: 409 });
    const profile = await prisma.creditProfile.findUniqueOrThrow({ where: { retailerId: ids.retailer } });
    expect(profile.rating).toBe("A");
    expect(await prisma.ratingHistory.count({ where: { creditProfileId: profile.id } })).toBe(1);
  });
});
