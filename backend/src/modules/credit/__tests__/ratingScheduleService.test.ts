import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { RatingService } from "../ratingService";

const run = randomUUID();
const ids = { tier: `schedule-tier-${run}`, retailer: `schedule-retailer-${run}` };

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Schedule ${run}` } });
  const retailer = await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: ids.retailer,
      shopAddress: "Test",
      phone: `87${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "7")}`,
      tierId: ids.tier,
    },
  });
  await prisma.creditProfile.create({
    data: {
      retailerId: retailer.id,
      rating: "N",
      accountCreatedAt: new Date("2026-06-01T00:00:00.000Z"),
      nextReviewAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  });
});

afterAll(async () => {
  await prisma.creditProfile.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("missed quarterly review", () => {
  it("advances an ineligible N profile to the next fixed checkpoint", async () => {
    await new RatingService().generate(new Date("2026-08-20T10:00:00.000Z"));
    const profile = await prisma.creditProfile.findUniqueOrThrow({ where: { retailerId: ids.retailer } });
    expect(profile.nextReviewAt).toEqual(new Date("2026-10-01T00:00:00.000Z"));
  });
});
