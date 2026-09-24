import { describe, expect, it, vi } from "vitest";
import { ProposalError, RetailerProposalService } from "../retailerProposalService";

process.env.PII_ENCRYPTION_KEY = "unit-test-pii-key-that-is-long-enough-32";

const testStorage = {
  put: vi.fn().mockResolvedValue({ objectKey: "retailer_proposal_aadhaar/test/photo", checksum: "checksum", contentType: "image/jpeg", sizeBytes: 4 }),
  read: vi.fn(),
  signedReadUrl: vi.fn().mockResolvedValue("signed://photo"),
  delete: vi.fn().mockResolvedValue(undefined),
};

function fakePrisma(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    staffUser: {
      findUnique: vi.fn().mockResolvedValue({ status: "active", salesRepId: "rep-1" }),
    },
    retailer: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    commercialStatusEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "commercial-event-1", ...data })),
    },
    retailerLocation: { create: vi.fn() },
    retailerProposal: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "proposal-1", ...data })),
      update: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "proposal-1", ...data })),
    },
    evidenceAsset: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "asset-1", ...data })),
    },
    tier: { findUnique: vi.fn().mockResolvedValue({ id: "tier-1" }) },
    auditEvent: { create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "proposal-1" }]),
    ...overrides,
  };
  db.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(db));
  return db;
}

const submission = {
  submittedByStaffId: "staff-1",
  businessName: "  Sharma Stores  ",
  groupName: "Sharma Retail Group",
  ownerName: "Ramesh Sharma",
  phone: "9812345699",
  transporter: "Gagan Logistics",
  shopAddress: "18 Market Road, Pune",
  pinCode: "411001",
  gstin: "27ABCDE1234F1Z5",
  upiId: "sharma.stores@upi",
  deliveryCity: "Pune",
  shopDurationYears: 5,
  paymentTerms: "30 days credit",
  aadhaarNumber: "123456789012",
  aadhaarPhoto: { contentType: "image/jpeg", bodyBase64: "YWJjZA==" },
  latitude: 18.5167,
  longitude: 73.8562,
  accuracyMeters: 14,
};

function serviceFor(prisma: any) {
  return new RetailerProposalService(prisma, testStorage as any);
}

describe("punching demand for a proposed retailer", () => {
  const pendingProposal = {
    id: "proposal-pending",
    status: "pending",
    submittedByStaffId: "staff-1",
    retailerId: null,
  };

  it("captures normalized SKU demand for the proposal owner without pricing it", async () => {
    const intent = { id: "intent-1", proposalId: pendingProposal.id, items: [{ variantId: "sku-1", qty: 3 }] };
    const prisma = fakePrisma({
      retailerProposal: {
        ...fakePrisma().retailerProposal,
        findUnique: vi.fn().mockResolvedValue(pendingProposal),
      },
      retailerProposalOrderIntent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(intent),
      },
      variant: {
        findMany: vi.fn().mockResolvedValue([{
          id: "sku-1", unitSize: "1 kg", unitsPerCase: 12,
          product: { name: "Toor Dal", catalogStatus: "active" }, catalogStatus: "active",
        }]),
      },
    });

    const result = await (serviceFor(prisma) as any).punchOrderIntent({
      proposalId: pendingProposal.id,
      salespersonId: "staff-1",
      idempotencyKey: "punch-once",
      items: [{ variantId: "sku-1", qty: 1 }, { variantId: "sku-1", qty: 2 }],
    });

    expect(result).toEqual(intent);
    expect(prisma.retailerProposalOrderIntent.create.mock.calls[0][0].data).toMatchObject({
      proposalId: pendingProposal.id,
      submittedByStaffId: "staff-1",
      idempotencyKey: "punch-once",
      items: { create: [{ variantId: "sku-1", qty: 3, productName: "Toor Dal", unitSize: "1 kg", unitsPerCase: 12 }] },
    });
    expect(prisma.retailerProposalOrderIntent.create.mock.calls[0][0].data.items.create[0]).not.toHaveProperty("price");
  });

  it("replays the same demand after approval but rejects reuse for a different basket", async () => {
    const existing = {
      id: "intent-replay",
      proposalId: pendingProposal.id,
      idempotencyKey: "punch-once",
      items: [{ variantId: "sku-1", qty: 3 }],
    };
    const prisma = fakePrisma({
      retailerProposal: {
        ...fakePrisma().retailerProposal,
        findUnique: vi.fn().mockResolvedValue({ ...pendingProposal, status: "approved" }),
      },
      retailerProposalOrderIntent: {
        ...fakePrisma().retailerProposalOrderIntent,
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      },
    });
    const service = serviceFor(prisma) as any;
    const input = {
      proposalId: pendingProposal.id,
      salespersonId: "staff-1",
      idempotencyKey: "punch-once",
      items: [{ variantId: "sku-1", qty: 3 }],
    };

    await expect(service.punchOrderIntent(input)).resolves.toBe(existing);
    await expect(service.punchOrderIntent({ ...input, items: [{ variantId: "sku-1", qty: 4 }] }))
      .rejects.toMatchObject({ code: "idempotency_key_conflict", status: 409 });
    expect(prisma.retailerProposalOrderIntent.create).not.toHaveBeenCalled();
  });

  it("does not create canonical orders before proposal approval", async () => {
    const createOfficialOrder = vi.fn();
    const prisma = fakePrisma({
      retailerProposalOrderIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: "intent-1",
          proposalId: pendingProposal.id,
          submittedByStaffId: "staff-1",
          proposal: pendingProposal,
          items: [{ variantId: "sku-1", qty: 3 }],
          convertedOrder: null,
        }),
      },
      staffUser: { findUnique: vi.fn().mockResolvedValue({ status: "active", salesRepId: "rep-1" }) },
    });
    const service = new RetailerProposalService(prisma, testStorage as any, createOfficialOrder as any);

    await expect((service as any).convertOrderIntent({ intentId: "intent-1", salespersonId: "staff-1" }))
      .rejects.toMatchObject({ code: "retailer_approval_required", status: 409 });
    expect(createOfficialOrder).not.toHaveBeenCalled();
  });

  it("converts an approved demand through the official order engine exactly once", async () => {
    const intent = {
      id: "intent-1",
      proposalId: "proposal-approved",
      submittedByStaffId: "staff-1",
      proposal: { id: "proposal-approved", status: "approved", retailerId: "retailer-1", submittedBy: { salesRepId: "rep-1" } },
      items: [{ variantId: "sku-1", qty: 3 }],
      convertedOrder: null,
    };
    const order = { id: "order-1", orderNo: 17 };
    const createOfficialOrder = vi.fn().mockResolvedValue({ ok: true, order, decision: { result: "allowed", reasons: [] } });
    const prisma = fakePrisma({
      retailerProposalOrderIntent: {
        findFirst: vi.fn().mockResolvedValue(intent),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      staffUser: { findUnique: vi.fn().mockResolvedValue({ status: "active", salesRepId: "rep-1" }) },
      retailer: { findFirst: vi.fn().mockResolvedValue({ id: "retailer-1" }) },
    });
    const service = new RetailerProposalService(prisma, testStorage as any, createOfficialOrder as any);

    const result = await (service as any).convertOrderIntent({
      intentId: "intent-1",
      salespersonId: "staff-1",
      commercial: { quoteId: "quote-1", revision: 2 },
    });

    expect(createOfficialOrder).toHaveBeenCalledWith(
      "retailer-1", [{ variantId: "sku-1", qty: 3 }], "rep", "rep-1", "staff-1",
      "retailer-proposal-intent:intent-1", { quoteId: "quote-1", revision: 2 },
    );
    expect(prisma.retailerProposalOrderIntent.updateMany).toHaveBeenLastCalledWith({
      where: { id: "intent-1", convertedOrderId: null },
      data: { convertedOrderId: "order-1", convertedAt: expect.any(Date) },
    });
    expect(result).toMatchObject({ order });
  });

  it("replaces an expired pinned quote before converting an approved demand", async () => {
    const intent = {
      id: "intent-expired-quote",
      proposalId: "proposal-approved",
      submittedByStaffId: "staff-1",
      conversionCommercialQuoteId: "quote-expired",
      proposal: { id: "proposal-approved", status: "approved", retailerId: "retailer-1", submittedBy: { salesRepId: "rep-1" } },
      items: [{ variantId: "sku-1", qty: 3 }],
      convertedOrder: null,
    };
    const createOfficialOrder = vi.fn().mockResolvedValue({
      ok: true, order: { id: "order-2" }, decision: { result: "allowed", reasons: [] },
    });
    const prisma = fakePrisma({
      retailerProposalOrderIntent: {
        findFirst: vi.fn().mockResolvedValue(intent),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      commercialQuote: { findUnique: vi.fn().mockResolvedValue({ acceptedAt: null, expiresAt: new Date(0) }) },
      staffUser: { findUnique: vi.fn().mockResolvedValue({ status: "active", salesRepId: "rep-1" }) },
      retailer: { findFirst: vi.fn().mockResolvedValue({ id: "retailer-1" }) },
    });
    const service = new RetailerProposalService(prisma, testStorage as any, createOfficialOrder as any);

    await service.convertOrderIntent({
      intentId: intent.id,
      salespersonId: "staff-1",
      commercial: { quoteId: "quote-fresh", revision: 1 },
    });

    expect(prisma.retailerProposalOrderIntent.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: intent.id, convertedOrderId: null, conversionCommercialQuoteId: "quote-expired" },
      data: { conversionCommercialQuoteId: "quote-fresh" },
    });
    expect(createOfficialOrder).toHaveBeenCalledWith(
      "retailer-1", [{ variantId: "sku-1", qty: 3 }], "rep", "rep-1", "staff-1",
      `retailer-proposal-intent:${intent.id}`, { quoteId: "quote-fresh", revision: 1 },
    );
  });
});

describe("submitting a proposal", () => {
  it("records the store with the salesperson who put it forward", async () => {
    const prisma = fakePrisma();
    const proposal = await serviceFor(prisma).submit(submission);
    expect(proposal).toMatchObject({
      businessName: "Sharma Stores",
      submittedByStaffId: "staff-1",
      latitude: 18.5167,
    });
    // Status is not client-settable; it defaults to pending in the schema.
    expect(prisma.retailerProposal.create.mock.calls[0][0].data.status).toBeUndefined();
  });

  it("encrypts Aadhaar, stores only its last four digits, and persists a private photo asset", async () => {
    const prisma = fakePrisma();
    await serviceFor(prisma).submit(submission);
    const data = prisma.retailerProposal.create.mock.calls[0][0].data;
    expect(data.aadhaarEncrypted).toMatch(/^v1:/);
    expect(data.aadhaarLast4).toBe("9012");
    expect(data).not.toHaveProperty("aadhaarNumber");
    expect(prisma.evidenceAsset.create.mock.calls[0][0].data).toMatchObject({
      purpose: "retailer_proposal_aadhaar",
      contentType: "image/jpeg",
    });
  });

  it("stores the phone in the shape the customer master uses", async () => {
    const prisma = fakePrisma();
    await serviceFor(prisma).submit({ ...submission, phone: "+91 98123 45699" });
    expect(prisma.retailerProposal.create.mock.calls[0][0].data.phone).toBe("9812345699");
  });

  it("normalizes the optional commercial identity fields", async () => {
    const prisma = fakePrisma();
    await serviceFor(prisma).submit({ ...submission, gstin: "27abcde1234f1z5", upiId: "sharma.stores@upi" });
    expect(prisma.retailerProposal.create.mock.calls[0][0].data).toMatchObject({
      pinCode: "411001",
      gstin: "27ABCDE1234F1Z5",
      upiId: "sharma.stores@upi",
    });
  });

  it("rejects malformed optional identity and payment handles", async () => {
    const service = serviceFor(fakePrisma());
    await expect(service.submit({ ...submission, pinCode: "4110" })).rejects.toMatchObject({ code: "pin_code_invalid" });
    await expect(service.submit({ ...submission, gstin: "27BAD" })).rejects.toMatchObject({ code: "gstin_invalid" });
    await expect(service.submit({ ...submission, upiId: "not-an-upi" })).rejects.toMatchObject({ code: "upi_id_invalid" });
  });

  it("looks for an existing store under every form of the number", async () => {
    const prisma = fakePrisma();
    await serviceFor(prisma).submit(submission);
    expect(prisma.retailer.findFirst.mock.calls[0][0].where.phone.in).toEqual([
      "9812345699",
      "+919812345699",
      "919812345699",
    ]);
  });

  it("refuses a store already on the customer master", async () => {
    const prisma = fakePrisma({
      retailer: { findFirst: vi.fn().mockResolvedValue({ id: "r1", name: "Sharma Stores" }) },
    });
    await expect(serviceFor(prisma).submit(submission)).rejects.toMatchObject({
      code: "retailer_already_exists",
    });
  });

  it("refuses a second proposal for a store already waiting", async () => {
    const prisma = fakePrisma({
      retailerProposal: {
        ...fakePrisma().retailerProposal,
        findFirst: vi.fn().mockResolvedValue({ id: "proposal-0" }),
      },
    });
    await expect(serviceFor(prisma).submit(submission)).rejects.toMatchObject({
      code: "proposal_already_pending",
    });
  });

  it("requires a usable name, address and phone", async () => {
    const service = serviceFor(fakePrisma());
    await expect(service.submit({ ...submission, businessName: "S" })).rejects.toMatchObject({
      code: "business_name_required",
    });
    await expect(service.submit({ ...submission, shopAddress: "x" })).rejects.toMatchObject({
      code: "shop_address_required",
    });
    await expect(service.submit({ ...submission, phone: "123" })).rejects.toMatchObject({
      code: "phone_invalid",
    });
  });

  it("refuses a proposal from staff with no book of their own", async () => {
    const prisma = fakePrisma({
      staffUser: { findUnique: vi.fn().mockResolvedValue({ status: "active", salesRepId: null }) },
    });
    await expect(serviceFor(prisma).submit(submission)).rejects.toMatchObject({
      code: "salesperson_not_available",
      status: 403,
    });
  });

  it("accepts a proposal with no coordinates", async () => {
    const prisma = fakePrisma();
    const proposal = await serviceFor(prisma).submit({
      ...submission,
      latitude: undefined,
      longitude: undefined,
      accuracyMeters: undefined,
    });
    expect(proposal).toMatchObject({ latitude: null, longitude: null });
  });
});

describe("approving a proposal", () => {
  const pending = {
    id: "proposal-1",
    status: "pending",
    businessName: "Sharma Stores",
    shopAddress: "18 Market Road, Pune",
    phone: "9812345699",
    latitude: 18.5167,
    longitude: 73.8562,
    accuracyMeters: 14,
    proposedTierId: "tier-1",
    submittedByStaffId: "staff-1",
    submittedAt: new Date("2026-03-10T09:00:00Z"),
    submittedBy: { salesRepId: "rep-1" },
  };

  it("creates one canonical retailer assigned to the proposer", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    prisma.retailer.create.mockResolvedValue({ id: "retailer-9" });

    const result = await new RetailerProposalService(prisma).approve({
      proposalId: "proposal-1",
      reviewerStaffId: "manager-1",
    });

    expect(prisma.retailer.create.mock.calls[0][0].data).toMatchObject({
      name: "Sharma Stores",
      phone: "9812345699",
      tierId: "tier-1",
      salesRepId: "rep-1",
      // Approval admits the store; it does not grant credit or skip KYC.
      status: "pending_kyc",
      creditLimit: 0,
    });
    expect(result.retailer.id).toBe("retailer-9");
    expect(prisma.retailerProposal.update.mock.calls[0][0]).toMatchObject({
      where: { id: "proposal-1", status: "pending" }, data: { status: "approved" },
    });
    expect(prisma.retailerProposal.update.mock.calls[1][0].data).toMatchObject({
      status: "approved",
      reviewedByStaffId: "manager-1",
      retailerId: "retailer-9",
    });
  });

  it("stores the storefront coordinate as captured, not verified", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    prisma.retailer.create.mockResolvedValue({ id: "retailer-9" });

    await new RetailerProposalService(prisma).approve({
      proposalId: "proposal-1",
      reviewerStaffId: "manager-1",
    });

    expect(prisma.retailerLocation.create.mock.calls[0][0].data).toMatchObject({
      retailerId: "retailer-9",
      status: "CAPTURED",
      source: "SALESPERSON_VISIT",
      locationVersion: 1,
    });
  });

  it("creates an empty location record when no coordinate was captured", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue({ ...pending, latitude: null, longitude: null });
    prisma.retailer.create.mockResolvedValue({ id: "retailer-9" });

    await new RetailerProposalService(prisma).approve({
      proposalId: "proposal-1",
      reviewerStaffId: "manager-1",
    });
    expect(prisma.retailerLocation.create.mock.calls[0][0].data).toEqual({ retailerId: "retailer-9" });
  });

  it("never lets the salesperson approve their own proposal", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    await expect(
      new RetailerProposalService(prisma).approve({
        proposalId: "proposal-1",
        reviewerStaffId: "staff-1",
      })
    ).rejects.toMatchObject({ code: "self_review_forbidden", status: 403 });
    expect(prisma.retailer.create).not.toHaveBeenCalled();
  });

  it("lets the reviewer override the proposed tier", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    prisma.retailer.create.mockResolvedValue({ id: "retailer-9" });
    await new RetailerProposalService(prisma).approve({
      proposalId: "proposal-1",
      reviewerStaffId: "manager-1",
      tierId: "tier-2",
    });
    expect(prisma.retailer.create.mock.calls[0][0].data.tierId).toBe("tier-2");
  });

  it("refuses to approve without a tier", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue({ ...pending, proposedTierId: null });
    await expect(
      new RetailerProposalService(prisma).approve({ proposalId: "proposal-1", reviewerStaffId: "manager-1" })
    ).rejects.toMatchObject({ code: "tier_required" });
  });

  it("refuses to approve a proposal twice", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue({ ...pending, status: "approved" });
    await expect(
      new RetailerProposalService(prisma).approve({ proposalId: "proposal-1", reviewerStaffId: "manager-1" })
    ).rejects.toMatchObject({ code: "proposal_already_decided" });
  });

  it("refuses to create a duplicate customer if the store appeared meanwhile", async () => {
    const prisma = fakePrisma({ retailer: { findFirst: vi.fn().mockResolvedValue({ id: "r1" }), create: vi.fn() } });
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    await expect(
      new RetailerProposalService(prisma).approve({ proposalId: "proposal-1", reviewerStaffId: "manager-1" })
    ).rejects.toMatchObject({ code: "retailer_already_exists" });
    expect(prisma.retailer.create).not.toHaveBeenCalled();
  });

  it("records who approved it", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    prisma.retailer.create.mockResolvedValue({ id: "retailer-9" });
    await new RetailerProposalService(prisma).approve({
      proposalId: "proposal-1",
      reviewerStaffId: "manager-1",
    });
    expect(prisma.auditEvent.create.mock.calls[0][0].data).toMatchObject({
      actorStaffId: "manager-1",
      action: "retailer_proposal.approved",
    });
  });
});

describe("rejecting a proposal", () => {
  const pending = { id: "proposal-1", status: "pending", submittedByStaffId: "staff-1" };

  it("needs a reason the salesperson can act on", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    await expect(
      new RetailerProposalService(prisma).reject({
        proposalId: "proposal-1",
        reviewerStaffId: "manager-1",
        reason: "",
      })
    ).rejects.toMatchObject({ code: "rejection_reason_required" });
  });

  it("records the reason and the reviewer", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    const rejected = await new RetailerProposalService(prisma).reject({
      proposalId: "proposal-1",
      reviewerStaffId: "manager-1",
      reason: "Shop already served under another account",
    });
    expect(rejected).toMatchObject({
      status: "rejected",
      reviewedByStaffId: "manager-1",
      rejectionReason: "Shop already served under another account",
    });
  });

  it("never lets the salesperson reject their own proposal either", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue(pending);
    await expect(
      new RetailerProposalService(prisma).reject({
        proposalId: "proposal-1",
        reviewerStaffId: "staff-1",
        reason: "changed my mind",
      })
    ).rejects.toBeInstanceOf(ProposalError);
  });
});

describe("what a salesperson can see", () => {
  it("lists only their own proposals", async () => {
    const prisma = fakePrisma();
    await new RetailerProposalService(prisma).listForSalesperson("staff-1");
    expect(prisma.retailerProposal.findMany.mock.calls[0][0].where).toEqual({
      submittedByStaffId: "staff-1",
    });
  });

  it("never returns encrypted Aadhaar ciphertext to the app", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findMany.mockResolvedValue([{ id: "p1", aadhaarEncrypted: "v1:secret", aadhaarLast4: "9012" }]);
    const result = await serviceFor(prisma).listForSalesperson("staff-1");
    expect(result[0]).toMatchObject({ aadhaarNumberMasked: "XXXX-XXXX-9012" });
    expect(result[0]).not.toHaveProperty("aadhaarEncrypted");
  });

  it("lets them withdraw one that is still waiting", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue({
      id: "proposal-1",
      status: "pending",
      submittedByStaffId: "staff-1",
    });
    const withdrawn = await new RetailerProposalService(prisma).withdraw({
      proposalId: "proposal-1",
      salespersonId: "staff-1",
    });
    expect(withdrawn.status).toBe("withdrawn");
  });

  it("hides another salesperson's proposal behind a not-found", async () => {
    const prisma = fakePrisma();
    prisma.retailerProposal.findUnique.mockResolvedValue({
      id: "proposal-1",
      status: "pending",
      submittedByStaffId: "staff-2",
    });
    await expect(
      new RetailerProposalService(prisma).withdraw({ proposalId: "proposal-1", salespersonId: "staff-1" })
    ).rejects.toMatchObject({ code: "proposal_not_found", status: 404 });
  });
});
