import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import type { ObjectStorage, PutObjectInput, StoredObject } from "../../../platform/storage/objectStorage";
import { CollectionService } from "../collectionService";

class FakeStorage implements ObjectStorage {
  readonly objects = new Map<string, Buffer>();
  async put(input: PutObjectInput): Promise<StoredObject> {
    const objectKey = `${input.purpose}/${randomUUID()}`;
    this.objects.set(objectKey, input.body);
    return { objectKey, checksum: "receipt-checksum", contentType: input.contentType, sizeBytes: input.body.length };
  }
  async read(objectKey: string) { return this.objects.get(objectKey)!; }
  async signedReadUrl(objectKey: string) { return `signed://${objectKey}`; }
  async delete(objectKey: string) { this.objects.delete(objectKey); }
}

const ids = { tier: randomUUID(), retailer: randomUUID(), collector: randomUUID() };
const storage = new FakeStorage();
const service = new CollectionService({ storage });

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `collection-evidence-${ids.tier}` } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "Receipt Shop", phone: `7${Date.now().toString().slice(-9)}`, shopAddress: "Test", tierId: ids.tier } });
  await prisma.collectionAssignment.create({ data: { collectorStaffId: ids.collector, retailerId: ids.retailer } });
});

afterAll(async () => {
  await prisma.collectionEvidence.deleteMany({ where: { submission: { retailerId: ids.retailer } } });
  await prisma.collectionSubmission.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.collectionAssignment.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("protected collection evidence", () => {
  it("stores receipt bytes privately and returns only a signed URL", async () => {
    const submission = await service.submit({
      retailerId: ids.retailer,
      collectorStaffId: ids.collector,
      actorPermissions: ["collection.submit"],
      amount: 120,
      method: "cash",
      idempotencyKey: `receipt-${randomUUID()}`,
      evidence: { contentType: "image/jpeg", bodyBase64: Buffer.from("receipt").toString("base64") },
    });

    expect(storage.objects.size).toBe(1);
    expect(submission.evidence[0]).not.toHaveProperty("objectKey");
    expect(submission.evidence[0].signedUrl).toMatch(/^signed:\/\//);
  });

  it("does not accept a client-chosen object key", async () => {
    await expect(service.submit({
      retailerId: ids.retailer,
      collectorStaffId: ids.collector,
      actorPermissions: ["collection.submit"],
      amount: 120,
      method: "cash",
      idempotencyKey: `receipt-${randomUUID()}`,
      evidence: { objectKey: "../../public/receipt.jpg", checksum: "bad", contentType: "image/jpeg", sizeBytes: 4 } as any,
    })).rejects.toMatchObject({ code: "invalid_evidence_body" });
  });
});
