import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { RatingService } from "../ratingService";

const run = randomUUID();
const ids = { tier: `f-tier-${run}`, retailer: `f-retailer-${run}`, order: `f-order-${run}`, invoice: `f-invoice-${run}` };
const now = new Date("2026-08-21T00:00:00.000Z");

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `F lock ${run}` } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "F Lock Shop", phone: `87${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "7")}`, shopAddress: "Test", tierId: ids.tier } });
  await prisma.order.create({ data: { id: ids.order, retailerId: ids.retailer, status: "delivered", orderTotal: 1000 } });
  await prisma.invoice.create({ data: { id: ids.invoice, retailerId: ids.retailer, orderId: ids.order, invoiceDate: new Date("2026-05-01T00:00:00.000Z"), dueDate: new Date("2026-05-16T00:00:00.000Z"), subtotal: 1000, total: 1000, outstandingAmount: 1000, idempotencyKey: randomUUID() } });
  await prisma.creditProfile.create({ data: { retailerId: ids.retailer, rating: "D", billingPattern: "regular", accountCreatedAt: new Date("2026-01-01T00:00:00.000Z") } });
});

afterAll(async () => {
  const profile = await prisma.creditProfile.findUnique({ where: { retailerId: ids.retailer } });
  if (profile) {
    await prisma.ratingHistory.deleteMany({ where: { creditProfileId: profile.id } });
    await prisma.ratingProposal.deleteMany({ where: { creditProfileId: profile.id } });
  }
  await prisma.creditProfile.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.invoice.delete({ where: { id: ids.invoice } });
  await prisma.order.delete({ where: { id: ids.order } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("automatic legal-90 credit lock", () => {
  it("confirms F and does not create a legal case", async () => {
    await new RatingService().generate(now);
    const profile = await prisma.creditProfile.findUniqueOrThrow({ where: { retailerId: ids.retailer } });
    expect(profile.rating).toBe("F");
    expect(profile.advancePaymentOnly).toBe(true);
    const proposal = await prisma.ratingProposal.findFirstOrThrow({ where: { creditProfileId: profile.id } });
    expect(proposal.status).toBe("confirmed");
    expect(await prisma.legalCase.count({ where: { recoveryCase: { invoiceId: ids.invoice } } })).toBe(0);
  });
});
