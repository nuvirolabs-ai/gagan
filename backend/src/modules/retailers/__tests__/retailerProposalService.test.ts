import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { RetailerFormError, RetailerFormService } from "../retailerProposalService";
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
const stamp = Date.now().toString().slice(-8);
const phones = {
  existing: `98${stamp}`.slice(0, 10),
  next: `97${stamp}`.slice(0, 10),
  duplicate: `96${stamp}`.slice(0, 10),
};
const ids = {
  tier: randomUUID(),
  rep: randomUUID(),
  staff: randomUUID(),
  retailer: randomUUID(),
};
let service: RetailerFormService;
const assetIds: string[] = [];
const proposalIds: string[] = [];
let form: Record<string, unknown>;

async function uploadPhoto() {
  const asset = await service.uploadAadhaar(
    { staffId: ids.staff, permissions: ["retailer.propose"] },
    { contentType: "image/jpeg", bodyBase64: Buffer.from(`aadhaar-${randomUUID()}`).toString("base64") }
  );
  assetIds.push(asset.id);
  return asset.id;
}

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `form-tier-${run}`, paymentTermDays: 15 } });
  await prisma.salesRep.create({ data: { id: ids.rep, name: "Form Rep", phone: `91${run}01` } });
  await prisma.staffUser.create({ data: { id: ids.staff, name: "Form Staff", phone: `91${run}02`, email: `${run}@form.test`, salesRepId: ids.rep } });
  const group = await prisma.retailerGroup.create({ data: { name: `Group ${run}` } });
  const transporter = await prisma.transporter.create({ data: { name: `Transporter ${run}` } });
  const beat = await prisma.beat.create({ data: { name: `Beat ${run}`, city: "Indore" } });
  const category = await prisma.buyerCategory.create({ data: { name: `Category ${run}` } });
  const sub = await prisma.buyerSubCategory.create({ data: { name: `Sub ${run}`, categoryId: category.id } });
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: "Existing Kirana",
      shopAddress: "Old Road",
      phone: phones.existing,
      tierId: ids.tier,
      salesRepId: ids.rep,
      creditLimit: 10000,
      paymentTermDays: 15,
      grade: "C",
      groupId: group.id,
      contactPerson: "Old Owner",
      transporterId: transporter.id,
      deliveryCity: "Indore",
      beatId: beat.id,
      shopTenureYears: 3,
      aadhaarNumber: "111122223333",
      buyerCategoryId: category.id,
      buyerSubCategoryId: sub.id,
    },
  });
  service = new RetailerFormService({ storage: new FakeStorage() });
  form = {
    partyName: "New Palasia Store",
    groupId: group.id,
    contactPerson: "Anita Verma",
    mobile: phones.next,
    telephone: "07314009999",
    transporterId: transporter.id,
    address1: "88 New Palasia",
    pin: "452001",
    tehsil: "Indore",
    district: "Indore",
    state: "Madhya Pradesh",
    deliveryCity: "Indore",
    salesmanRepId: ids.rep,
    beatId: beat.id,
    shopTenureYears: 5,
    gstin: "23AABCU9603R1ZX",
    aadhaarNumber: "999988887777",
    paymentTermDays: 30,
    creditLimit: 40000,
    grade: "A",
    buyerCategoryId: category.id,
    buyerSubCategoryId: sub.id,
    upiId: "anita@okaxis",
  };
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { subjectId: { in: [...proposalIds, ids.retailer] } } });
  await prisma.retailerProposal.deleteMany({ where: { id: { in: proposalIds } } });
  await prisma.retailerContact.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.creditProfile.deleteMany({ where: { retailerId: { in: [ids.retailer] } } });
  const created = await prisma.retailer.findMany({ where: { salesRepId: ids.rep, id: { not: ids.retailer } } });
  await prisma.retailerLocation.deleteMany({ where: { retailerId: { in: created.map((item) => item.id) } } });
  await prisma.creditProfile.deleteMany({ where: { retailerId: { in: created.map((item) => item.id) } } });
  await prisma.retailerContact.deleteMany({ where: { retailerId: { in: created.map((item) => item.id) } } });
  await prisma.retailerProposal.deleteMany({ where: { salesmanRepId: ids.rep } });
  await prisma.retailer.deleteMany({ where: { salesRepId: ids.rep } });
  await prisma.evidenceAsset.deleteMany({ where: { id: { in: assetIds } } });
  await prisma.buyerSubCategory.deleteMany({ where: { name: `Sub ${run}` } });
  await prisma.buyerCategory.deleteMany({ where: { name: `Category ${run}` } });
  await prisma.beat.deleteMany({ where: { name: `Beat ${run}` } });
  await prisma.transporter.deleteMany({ where: { name: `Transporter ${run}` } });
  await prisma.retailerGroup.deleteMany({ where: { name: `Group ${run}` } });
  await prisma.staffUser.deleteMany({ where: { id: ids.staff } });
  await prisma.salesRep.deleteMany({ where: { id: ids.rep } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
});

describe("retailer proposal service", () => {
  it("proposes a full payload then maps credit, terms and grade onto the approved retailer", async () => {
    const photoId = await uploadPhoto();
    const proposed = await service.propose(
      { staffId: ids.staff, permissions: ["retailer.propose"] },
      { ...form, aadhaarPhotoAssetId: photoId }
    );
    proposalIds.push(proposed.id);
    expect(proposed.status).toBe("pending");
    expect(proposed.creditLimit).toBe(40000);

    await expect(service.approve(proposed.id, {
      staffId: "reviewer-1",
      permissions: ["retailer.review"],
      reason: "Shop verified",
    })).rejects.toMatchObject({ code: "step_up_required" });

    const approved = await service.approve(proposed.id, {
      staffId: "reviewer-1",
      permissions: ["retailer.review"],
      reason: "Shop verified",
      stepUpUntil: new Date(Date.now() + 60_000),
    });
    expect(approved.status).toBe("approved");
    expect(approved.retailerId).toBeTruthy();
    const retailer = await prisma.retailer.findUniqueOrThrow({ where: { id: approved.retailerId! } });
    expect(Number(retailer.creditLimit)).toBe(40000);
    expect(retailer.paymentTermDays).toBe(30);
    expect(retailer.grade).toBe("A");
    expect(retailer.name).toBe("New Palasia Store");
    expect(retailer.deliveryCity).toBe("Indore");
    expect(retailer.aadhaarNumber).toBe("999988887777");
  });

  it("lets the assigned salesman update commercial fields directly", async () => {
    const photoId = await uploadPhoto();
    const updated = await service.updateAssigned(ids.retailer, { staffId: ids.staff, permissions: ["retailer.propose"] }, {
      ...form,
      partyName: "Existing Kirana",
      mobile: phones.existing,
      aadhaarPhotoAssetId: photoId,
      creditLimit: 88000,
      paymentTermDays: 45,
      grade: "B",
    });
    expect(updated.creditLimit).toBe(88000);
    const retailer = await prisma.retailer.findUniqueOrThrow({ where: { id: ids.retailer } });
    expect(Number(retailer.creditLimit)).toBe(88000);
    expect(retailer.paymentTermDays).toBe(45);
    expect(retailer.grade).toBe("B");
  });

  it("rejects a second pending proposal for the same mobile", async () => {
    const photoId = await uploadPhoto();
    const first = await service.propose(
      { staffId: ids.staff, permissions: ["retailer.propose"] },
      { ...form, mobile: phones.duplicate, aadhaarPhotoAssetId: photoId, partyName: "Duplicate Check" }
    );
    proposalIds.push(first.id);
    const photo2 = await uploadPhoto();
    await expect(service.propose(
      { staffId: ids.staff, permissions: ["retailer.propose"] },
      { ...form, mobile: phones.duplicate, aadhaarPhotoAssetId: photo2, partyName: "Duplicate Check 2" }
    )).rejects.toBeInstanceOf(RetailerFormError);
  });
});
