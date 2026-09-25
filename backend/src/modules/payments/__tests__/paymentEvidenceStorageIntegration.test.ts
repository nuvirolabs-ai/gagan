import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../identity/sessionRuntime";
import { getObjectStorage } from "../../../platform/storage/storageRuntime";

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  otherRetailer: randomUUID(),
  payment: randomUUID(),
};
const app = createApp();
const storage = getObjectStorage();
const proof = Buffer.from("private payment proof");
let retailerToken = "";
let otherRetailerToken = "";

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname)
    || !url.pathname.includes("test")
    || process.env.STORAGE_PROVIDER !== "local") {
    throw new Error("Disposable local DB and filesystem storage required");
  }

  await prisma.tier.create({ data: { id: ids.tier, name: `Payment proof ${ids.tier}` } });
  await prisma.retailer.createMany({
    data: [
      {
        id: ids.retailer,
        name: "Payment proof owner",
        phone: `owner-${ids.retailer}`,
        shopAddress: "Local test",
        tierId: ids.tier,
      },
      {
        id: ids.otherRetailer,
        name: "Payment proof other retailer",
        phone: `other-${ids.otherRetailer}`,
        shopAddress: "Local test",
        tierId: ids.tier,
      },
    ],
  });
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
  const [owner, other] = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: ids.retailer, deviceName: "local-proof-test" }),
    lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: ids.otherRetailer, deviceName: "local-proof-test" }),
  ]);
  retailerToken = owner.accessToken;
  otherRetailerToken = other.accessToken;
});

afterAll(async () => {
  const evidence = await prisma.paymentEvidence.findMany({ where: { paymentId: ids.payment }, select: { objectKey: true } });
  await Promise.all(evidence.map(({ objectKey }) => storage.delete(objectKey)));
  await prisma.paymentEvidence.deleteMany({ where: { paymentId: ids.payment } });
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.retailer, ids.otherRetailer] }, realm: "retailer" } });
  await prisma.payment.deleteMany({ where: { id: ids.payment } });
  await prisma.retailer.deleteMany({ where: { id: { in: [ids.retailer, ids.otherRetailer] } } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("payment proof with the configured local private-storage adapter", () => {
  it("persists, reads and scopes an uploaded proof without exposing its object key", async () => {
    const upload = await request(app)
      .post(`/payments/${ids.payment}/evidence`)
      .set("Authorization", `Bearer ${retailerToken}`)
      .send({ contentType: "image/jpeg", bodyBase64: proof.toString("base64") })
      .expect(201);

    expect(upload.body.evidence).toMatchObject({ paymentId: ids.payment, contentType: "image/jpeg" });
    expect(upload.body.evidence.signedUrl).toMatch(/^local-storage:\/\//);
    expect(upload.body.evidence).not.toHaveProperty("objectKey");

    const saved = await prisma.paymentEvidence.findUniqueOrThrow({ where: { id: upload.body.evidence.id } });
    await expect(storage.read(saved.objectKey)).resolves.toEqual(proof);

    const readback = await request(app)
      .get(`/payments/${ids.payment}`)
      .set("Authorization", `Bearer ${retailerToken}`)
      .expect(200);
    expect(readback.body.evidence).toHaveLength(1);
    expect(readback.body.evidence[0]).toMatchObject({ id: saved.id, signedUrl: expect.stringMatching(/^local-storage:\/\//) });
    expect(readback.body.evidence[0]).not.toHaveProperty("objectKey");

    await request(app)
      .get(`/payments/${ids.payment}`)
      .set("Authorization", `Bearer ${otherRetailerToken}`)
      .expect(404);
    await request(app)
      .post(`/payments/${ids.payment}/evidence`)
      .set("Authorization", `Bearer ${otherRetailerToken}`)
      .send({ contentType: "image/jpeg", bodyBase64: proof.toString("base64") })
      .expect(404);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: ids.payment } });
    expect(payment.status).toBe("pending");
    expect(payment.settledAt).toBeNull();
    expect(await prisma.financialLedgerEntry.count({ where: { paymentId: ids.payment } })).toBe(0);
  });
});
