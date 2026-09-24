import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  objects: new Map<string, Buffer>(),
  sequence: 0,
  put: vi.fn(async (input: { purpose: string; contentType: string; body: Buffer }) => {
    const objectKey = `${input.purpose}/test-${++mocks.sequence}`;
    mocks.objects.set(objectKey, input.body);
    return { objectKey, checksum: "test-checksum", contentType: input.contentType, sizeBytes: input.body.length };
  }),
  signedReadUrl: vi.fn(async (objectKey: string) => `signed://${objectKey}`),
  delete: vi.fn(async (objectKey: string) => { mocks.objects.delete(objectKey); }),
}));

vi.mock("../../../platform/storage/storageRuntime", () => ({
  getObjectStorage: () => ({ put: mocks.put, signedReadUrl: mocks.signedReadUrl, delete: mocks.delete, read: vi.fn() }),
}));

import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../identity/sessionRuntime";
import paymentRoutes from "../../../routes/payments";

const ids = { tier: randomUUID(), retailer: randomUUID(), otherRetailer: randomUUID(), payment: randomUUID() };
const app = express();
app.use(express.json(), paymentRoutes);
let retailerToken = "";
let otherRetailerToken = "";

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `payment-proof-${ids.tier}` } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "Proof Shop", phone: `8${Date.now().toString().slice(-9)}`, shopAddress: "Test", tierId: ids.tier } });
  await prisma.retailer.create({ data: { id: ids.otherRetailer, name: "Other Proof Shop", phone: `7${Date.now().toString().slice(-9)}`, shopAddress: "Test", tierId: ids.tier } });
  await prisma.payment.create({
    data: {
      id: ids.payment,
      retailerId: ids.retailer,
      amount: 120,
      status: "pending",
      channel: "online",
      provider: "mock",
      providerRef: `evidence-${ids.payment}`,
    },
  });
  const session = await lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: ids.retailer, deviceName: "payment-evidence-test" });
  const otherSession = await lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: ids.otherRetailer, deviceName: "payment-evidence-test" });
  retailerToken = session.accessToken;
  otherRetailerToken = otherSession.accessToken;
});

afterAll(async () => {
  await prisma.paymentEvidence.deleteMany({ where: { paymentId: ids.payment } });
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.retailer, ids.otherRetailer] }, realm: "retailer" } });
  await prisma.payment.delete({ where: { id: ids.payment } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.retailer.delete({ where: { id: ids.otherRetailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("retailer payment proof API", () => {
  it("attaches privately to the owned payment and returns signed evidence on later read", async () => {
    const upload = await request(app)
      .post(`/payments/${ids.payment}/evidence`)
      .set("Authorization", `Bearer ${retailerToken}`)
      .send({ contentType: "image/jpeg", bodyBase64: Buffer.from("payment screenshot").toString("base64") });

    expect(upload.status).toBe(201);
    expect(upload.body.evidence).toMatchObject({ paymentId: ids.payment, contentType: "image/jpeg", signedUrl: "signed://payment_receipt/test-1" });
    expect(upload.body.evidence).not.toHaveProperty("objectKey");

    const detail = await request(app).get(`/payments/${ids.payment}`).set("Authorization", `Bearer ${retailerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.evidence).toHaveLength(1);
    expect(detail.body.evidence[0]).toMatchObject({ id: upload.body.evidence.id, signedUrl: "signed://payment_receipt/test-1" });
    expect(detail.body.evidence[0]).not.toHaveProperty("objectKey");

    const list = await request(app).get("/payments").set("Authorization", `Bearer ${retailerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.payments[0].evidence).toHaveLength(1);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: ids.payment } });
    expect(payment.status).toBe("pending");
    expect(payment.settledAt).toBeNull();
    expect(await prisma.financialLedgerEntry.count({ where: { paymentId: ids.payment } })).toBe(0);
  });

  it("does not let a different retailer upload or read the payment evidence", async () => {
    const upload = await request(app)
      .post(`/payments/${ids.payment}/evidence`)
      .set("Authorization", `Bearer ${otherRetailerToken}`)
      .send({ contentType: "image/jpeg", bodyBase64: Buffer.from("private").toString("base64") });
    expect(upload.status).toBe(404);

    const detail = await request(app).get(`/payments/${ids.payment}`).set("Authorization", `Bearer ${otherRetailerToken}`);
    expect(detail.status).toBe(404);
  });

  it("rejects requests without a retailer session", async () => {
    const response = await request(app)
      .post(`/payments/${ids.payment}/evidence`)
      .send({ contentType: "image/jpeg", bodyBase64: Buffer.from("private").toString("base64") });
    expect(response.status).toBe(401);
  });

  it("rejects client storage keys and non-image proof", async () => {
    const before = mocks.put.mock.calls.length;
    const key = await request(app)
      .post(`/payments/${ids.payment}/evidence`)
      .set("Authorization", `Bearer ${retailerToken}`)
      .send({ contentType: "image/jpeg", bodyBase64: "cHJvb2Y=", objectKey: "public/forged.jpg" });
    expect(key.status).toBe(400);

    const pdf = await request(app)
      .post(`/payments/${ids.payment}/evidence`)
      .set("Authorization", `Bearer ${retailerToken}`)
      .send({ contentType: "application/pdf", bodyBase64: "cHJvb2Y=" });
    expect(pdf.status).toBe(400);
    expect(mocks.put).toHaveBeenCalledTimes(before);
  });
});
