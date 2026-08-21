import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { KycService, KycServiceError, REQUIRED_KYC_DOCUMENTS } from "../kycService";
import type { ObjectStorage, PutObjectInput, StoredObject } from "../../../platform/storage/objectStorage";

class FakeStorage implements ObjectStorage {
  objects = new Map<string, Buffer>();

  async put(input: PutObjectInput): Promise<StoredObject> {
    const objectKey = `${input.purpose}/${randomUUID()}`;
    this.objects.set(objectKey, input.body);
    return { objectKey, checksum: input.checksum ?? "checksum", contentType: input.contentType, sizeBytes: input.body.length };
  }

  async read(objectKey: string) { return this.objects.get(objectKey)!; }
  async signedReadUrl(objectKey: string) { return `fake://${objectKey}`; }
  async delete(objectKey: string) { this.objects.delete(objectKey); }
}

const run = randomUUID().slice(0, 8);
const ids = { tier: `kyc-tier-${run}`, rep: `kyc-rep-${run}`, staff: `kyc-staff-${run}`, retailer: `kyc-retailer-${run}` };
let service: KycService;
const caseIds: string[] = [];

beforeAll(async () => {
  const tier = await prisma.tier.create({ data: { id: ids.tier, name: ids.tier, paymentTermDays: 15 } });
  const rep = await prisma.salesRep.create({ data: { id: ids.rep, name: "KYC Rep", phone: `91${run}01` } });
  await prisma.staffUser.create({ data: { id: ids.staff, name: "KYC Staff", phone: `91${run}02`, email: `${run}@kyc.test`, salesRepId: rep.id } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "KYC Retailer", shopAddress: "Test Road", phone: `91${run}03`, tierId: tier.id, salesRepId: rep.id } });
  await prisma.creditProfile.create({ data: { retailerId: ids.retailer, accountCreatedAt: new Date() } });
  service = new KycService({ storage: new FakeStorage() });
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { subjectId: ids.retailer } });
  await prisma.kycReview.deleteMany({ where: { caseId: { in: caseIds } } });
  const documents = await prisma.kycDocument.findMany({ where: { caseId: { in: caseIds } }, select: { assetId: true } });
  await prisma.kycDocument.deleteMany({ where: { caseId: { in: caseIds } } });
  await prisma.kycCase.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.evidenceAsset.deleteMany({ where: { id: { in: documents.map((document) => document.assetId) } } });
  await prisma.creditProfile.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.staffUser.deleteMany({ where: { id: ids.staff } });
  await prisma.salesRep.deleteMany({ where: { id: ids.rep } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
});

describe("KYC service", () => {
  it("only lets the assigned salesperson submit a complete case", async () => {
    const created = await service.startCase(ids.retailer, ids.staff, ["kyc.submit"]);
    caseIds.push(created.id);
    expect(created.status).toBe("draft");

    await expect(service.startCase(ids.retailer, "not-assigned", ["kyc.submit"])).rejects.toMatchObject({ code: "retailer_not_assigned" });
    await expect(service.submit(created.id, { staffId: ids.staff, permissions: ["kyc.submit"] })).rejects.toMatchObject({ code: "required_documents_missing" });

    for (const type of REQUIRED_KYC_DOCUMENTS) {
      await service.uploadDocument(created.id, {
        staffId: ids.staff,
        permissions: ["kyc.submit"],
        type,
        contentType: "application/pdf",
        bodyBase64: Buffer.from(type).toString("base64"),
      });
    }
    const submitted = await service.submit(created.id, { staffId: ids.staff, permissions: ["kyc.submit"] });
    expect(submitted.status).toBe("submitted");
    expect(submitted.documents[0].asset).not.toHaveProperty("objectKey");
    expect(submitted.documents[0].asset.signedUrl).toMatch(/^fake:\/\//);
  });

  it("approves once with step-up, activates the retailer and audits the decision", async () => {
    const current = await service.detail((await service.startCase(ids.retailer, ids.staff, ["kyc.submit"])).id, ids.staff, ["kyc.submit"]);
    caseIds.push(current.id);
    const approved = await service.review(current.id, {
      staffId: "reviewer-1",
      permissions: ["kyc.review"],
      stepUpUntil: new Date(Date.now() + 60_000),
      decision: "approved",
      reason: "Documents verified against the business record.",
    });
    expect(approved.status).toBe("approved");
    await expect(service.review(current.id, {
      staffId: "reviewer-2",
      permissions: ["kyc.review"],
      stepUpUntil: new Date(Date.now() + 60_000),
      decision: "rejected",
      reason: "Duplicate review",
    })).rejects.toMatchObject({ code: "invalid_transition" });
    await expect(prisma.retailer.findUnique({ where: { id: ids.retailer } })).resolves.toMatchObject({ status: "active" });
    await expect(prisma.auditEvent.findFirst({ where: { subjectType: "kyc_case", subjectId: current.id } })).resolves.toMatchObject({ action: "kyc.approved" });
  });
});
