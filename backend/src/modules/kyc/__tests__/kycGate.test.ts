import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { ensureKycApprovedForDispatch, KycGateError } from "../kycGate";

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const ids = { tier: `gate-tier-${run}`, retailer: `gate-retailer-${run}` };

describe("KYC dispatch gate", () => {
  afterEach(async () => {
    await prisma.kycCase.deleteMany({ where: { retailerId: ids.retailer } });
    await prisma.creditProfile.deleteMany({ where: { retailerId: ids.retailer } });
    await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
    await prisma.tier.deleteMany({ where: { id: ids.tier } });
  });

  async function fixture() {
    const tier = await prisma.tier.create({ data: { id: ids.tier, name: `Gate ${run}` } });
    await prisma.retailer.create({
      data: { id: ids.retailer, name: "Gate Shop", phone: `9198${run.replace(/\D/g, "").slice(-8)}`, shopAddress: "Test", tierId: tier.id, status: "pending_kyc" },
    });
    await prisma.creditProfile.create({ data: { retailerId: ids.retailer, rating: "N", accountCreatedAt: new Date(), nextReviewAt: new Date() } });
  }

  it("blocks dispatch until an active retailer has an approved KYC case", async () => {
    await fixture();
    await expect(ensureKycApprovedForDispatch(ids.retailer)).rejects.toMatchObject({ code: "kyc_required", status: 409 });

    await prisma.retailer.update({ where: { id: ids.retailer }, data: { status: "active" } });
    await expect(ensureKycApprovedForDispatch(ids.retailer)).rejects.toBeInstanceOf(KycGateError);

    await prisma.kycCase.create({ data: { retailerId: ids.retailer, status: "approved", reviewedAt: new Date() } });
    await expect(ensureKycApprovedForDispatch(ids.retailer)).resolves.toMatchObject({ retailerId: ids.retailer });
    await prisma.retailer.update({ where: { id: ids.retailer }, data: { status: "suspended" } });
    await expect(ensureKycApprovedForDispatch(ids.retailer)).rejects.toMatchObject({ code: "kyc_required" });
  });

  it("allows the legacy confirmed profile only when the retailer is active", async () => {
    await fixture();
    await prisma.creditProfile.update({ where: { retailerId: ids.retailer }, data: { kycVerifiedAt: new Date() } });
    await expect(ensureKycApprovedForDispatch(ids.retailer)).rejects.toMatchObject({ code: "kyc_required" });
    await prisma.retailer.update({ where: { id: ids.retailer }, data: { status: "active" } });
    await expect(ensureKycApprovedForDispatch(ids.retailer)).resolves.toMatchObject({ retailerId: ids.retailer });
  });
});
