import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import type { ObjectStorage, PutObjectInput, StoredObject } from "../../../platform/storage/objectStorage";
import { RecoveryLegalService } from "../recoveryLegalService";

class FakeStorage implements ObjectStorage {
  readonly objects = new Map<string, Buffer>();

  async put(input: PutObjectInput): Promise<StoredObject> {
    const objectKey = `recovery-letter/${this.objects.size + 1}`;
    this.objects.set(objectKey, input.body);
    return { objectKey, checksum: "checksum", contentType: input.contentType, sizeBytes: input.body.length };
  }

  async read(objectKey: string) { return this.objects.get(objectKey) ?? Buffer.alloc(0); }
  async signedReadUrl(objectKey: string) { return `signed://${objectKey}`; }
  async delete(objectKey: string) { this.objects.delete(objectKey); }
}

const run = randomUUID();
const ids = { tier: `legal-tier-${run}`, retailer: `legal-retailer-${run}`, order: `legal-order-${run}`, invoice: `legal-invoice-${run}` };
const storage = new FakeStorage();
const service = new RecoveryLegalService(storage);

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Legal ${run}` } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "Legal Shop", phone: `86${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "6")}`, shopAddress: "Test", tierId: ids.tier } });
  await prisma.order.create({ data: { id: ids.order, retailerId: ids.retailer, status: "delivered", orderTotal: 12_500 } });
  await prisma.invoice.create({ data: { id: ids.invoice, retailerId: ids.retailer, orderId: ids.order, invoiceDate: new Date("2026-05-01T00:00:00.000Z"), dueDate: new Date("2026-05-16T00:00:00.000Z"), subtotal: 12_500, total: 12_500, outstandingAmount: 12_500, idempotencyKey: randomUUID() } });
  await prisma.recoveryCase.create({ data: { invoiceId: ids.invoice, retailerId: ids.retailer } });
});

afterAll(async () => {
  await prisma.legalDecision.deleteMany({ where: { legalCase: { recoveryCase: { invoiceId: ids.invoice } } } });
  await prisma.legalCase.deleteMany({ where: { recoveryCase: { invoiceId: ids.invoice } } });
  await prisma.recoveryLetterDelivery.deleteMany({ where: { letter: { recoveryCase: { invoiceId: ids.invoice } } } });
  await prisma.recoveryLetter.deleteMany({ where: { recoveryCase: { invoiceId: ids.invoice } } });
  await prisma.recoveryCase.deleteMany({ where: { invoiceId: ids.invoice } });
  await prisma.invoice.delete({ where: { id: ids.invoice } });
  await prisma.order.delete({ where: { id: ids.order } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("recovery letters and legal decisions", () => {
  it("stores a private, idempotent letter and delivery metadata", async () => {
    const caseId = (await prisma.recoveryCase.findUniqueOrThrow({ where: { invoiceId: ids.invoice } })).id;
    const input = { caseId, actorStaffId: "admin-1", actorPermissions: ["staff.manage"], idempotencyKey: `letter-${run}`, sentAt: new Date("2026-08-21T00:00:00.000Z") };
    const first = await service.createLetter(input);
    const second = await service.createLetter(input);
    expect(first.id).toBe(second.id);
    expect(first.objectKey).toMatch(/^recovery-letter\//);
    expect(first.signedUrl).toBe(`signed://${first.objectKey}`);
    const delivery = await service.recordDelivery(first.id, { actorStaffId: "admin-1", actorPermissions: ["staff.manage"], channel: "manual", idempotencyKey: `delivery-${run}` });
    expect(delivery.channel).toBe("manual");
  });

  it("requires an explicit admin referral and founder decision", async () => {
    const caseId = (await prisma.recoveryCase.findUniqueOrThrow({ where: { invoiceId: ids.invoice } })).id;
    const letter = await prisma.recoveryLetter.findFirstOrThrow({ where: { recoveryCase: { invoiceId: ids.invoice } } });
    await expect(service.createLegalCase({ caseId, letterId: letter.id, actorStaffId: "collector-1", actorPermissions: ["recovery.update"], reason: "Prepare legal review", idempotencyKey: `legal-denied-${run}` })).rejects.toMatchObject({ code: "permission_required" });
    const legalCase = await service.createLegalCase({ caseId, letterId: letter.id, actorStaffId: "admin-1", actorPermissions: ["staff.manage"], reason: "Prepare legal review", idempotencyKey: `legal-${run}` });
    await expect(service.decide(legalCase.id, { actorStaffId: "credit-1", actorPermissions: ["credit.rating_confirm"], type: "write_off", amount: 1000, reason: "Not authorised", idempotencyKey: `decision-denied-${run}` })).rejects.toMatchObject({ code: "permission_required" });
    const decided = await service.decide(legalCase.id, { actorStaffId: "founder-1", actorPermissions: ["legal.decide"], type: "settlement", amount: 10_000, reason: "Approved settlement", idempotencyKey: `decision-${run}` });
    expect(decided.status).toBe("settled");
    await expect(service.decide(legalCase.id, { actorStaffId: "founder-1", actorPermissions: ["legal.decide"], type: "write_off", amount: 500, reason: "Retry", idempotencyKey: `decision-retry-${run}` })).rejects.toMatchObject({ code: "legal_case_decided" });
  });
});
