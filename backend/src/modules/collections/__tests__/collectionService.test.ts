import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { getObjectStorage } from "../../../platform/storage/storageRuntime";
import { CollectionService } from "../collectionService";

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  order: randomUUID(),
  invoice: randomUUID(),
};

const service = new CollectionService();

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname)
    || !url.pathname.includes("test")
    || process.env.STORAGE_PROVIDER !== "local") {
    throw new Error("Disposable local DB and filesystem storage required");
  }

  await prisma.tier.create({
    data: { id: ids.tier, name: `collection-test-${ids.tier}`, paymentTermDays: 15 },
  });
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: "Collection test retailer",
      shopAddress: "Test address",
      phone: `7${randomInt(0, 1_000_000_000).toString().padStart(9, "0")}`,
      tierId: ids.tier,
      creditLimit: 100_000,
      currentBalance: 1_000,
    },
  });
  await prisma.collectionAssignment.create({
    data: { collectorStaffId: "collector-1", retailerId: ids.retailer },
  });
  await prisma.collectionAssignment.create({
    data: { collectorStaffId: "collector-2", retailerId: ids.retailer },
  });
  await prisma.collectionAssignment.create({
    data: { collectorStaffId: "collector-3", retailerId: ids.retailer },
  });
  await prisma.order.create({
    data: { id: ids.order, retailerId: ids.retailer, status: "delivered", orderTotal: 1_000 },
  });
  await prisma.invoice.create({
    data: {
      id: ids.invoice,
      retailerId: ids.retailer,
      orderId: ids.order,
      invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
      dueDate: new Date("2026-08-16T00:00:00.000Z"),
      subtotal: 1_000,
      total: 1_000,
      outstandingAmount: 1_000,
      idempotencyKey: randomUUID(),
    },
  });
  await prisma.financialLedgerEntry.create({
    data: {
      retailerId: ids.retailer,
      invoiceId: ids.invoice,
      direction: "debit",
      kind: "invoice",
      amount: 1_000,
      balanceAfter: 1_000,
      idempotencyKey: randomUUID(),
      occurredAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });
  await prisma.ledgerEntry.create({
    data: {
      retailerId: ids.retailer,
      orderId: ids.order,
      type: "invoice",
      amount: 1_000,
      balanceAfter: 1_000,
      dueDate: new Date("2026-08-16T00:00:00.000Z"),
    },
  });
});

afterAll(async () => {
  const evidence = await prisma.collectionEvidence.findMany({
    where: { submission: { retailerId: ids.retailer } },
    select: { objectKey: true },
  });
  await Promise.all(evidence.map(({ objectKey }) => getObjectStorage().delete(objectKey)));
  await prisma.collectionEvidence.deleteMany({ where: { submission: { retailerId: ids.retailer } } });
  await prisma.collectionSubmission.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.collectionAssignment.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.paymentAllocation.deleteMany({ where: { payment: { retailerId: ids.retailer } } });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.payment.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.invoice.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.order.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
  expect(await prisma.collectionEvidence.count({ where: { submission: { retailerId: ids.retailer } } })).toBe(0);
  await prisma.$disconnect();
});

describe("field collection workflow", () => {
  it("requires receipt or reference evidence before accepting a submission", async () => {
    await expect(
      service.submit({
        retailerId: ids.retailer,
        collectorStaffId: "collector-1",
        actorPermissions: ["collection.submit"],
        amount: 50,
        method: "cash",
        idempotencyKey: `submission-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: "evidence_required" });
  });

  it("keeps collector submissions out of the ledger until Accounts confirms", async () => {
    const submission = await service.submit({
      retailerId: ids.retailer,
      collectorStaffId: "collector-1",
      actorPermissions: ["collection.submit"],
      amount: 400,
      method: "cash",
      reference: "receipt-100",
      idempotencyKey: `submission-${randomUUID()}`,
      evidence: {
        contentType: "image/jpeg",
        bodyBase64: Buffer.from("receipt").toString("base64"),
      },
    });

    expect(submission.status).toBe("pending");
    expect(await prisma.payment.count({ where: { retailerId: ids.retailer } })).toBe(0);
    expect(await prisma.financialLedgerEntry.count({ where: { retailerId: ids.retailer } })).toBe(1);
  });

  it("requires Accounts permission and recent step-up to confirm", async () => {
    const submission = await service.submit({
      retailerId: ids.retailer,
      collectorStaffId: "collector-2",
      actorPermissions: ["collection.submit"],
      amount: 100,
      method: "neft",
      reference: "neft-100",
      idempotencyKey: `submission-${randomUUID()}`,
    });

    await expect(
      service.confirm(submission.id, {
        actorStaffId: "accounts-1",
        actorPermissions: [],
        stepUpUntil: new Date(Date.now() + 60_000),
      })
    ).rejects.toMatchObject({ code: "permission_required" });

    await expect(
      service.confirm(submission.id, {
        actorStaffId: "accounts-1",
        actorPermissions: ["collection.confirm"],
        stepUpUntil: new Date(Date.now() - 1),
      })
    ).rejects.toMatchObject({ code: "step_up_required" });
  });

  it("confirms a submission once even when Accounts retries concurrently", async () => {
    const submission = await service.submit({
      retailerId: ids.retailer,
      collectorStaffId: "collector-3",
      actorPermissions: ["collection.submit"],
      amount: 300,
      method: "cheque",
      reference: "chq-101",
      idempotencyKey: `submission-${randomUUID()}`,
    });

    const input = {
      actorStaffId: "accounts-2",
      actorPermissions: ["collection.confirm"],
      stepUpUntil: new Date(Date.now() + 60_000),
    };
    const [first, second] = await Promise.all([
      service.confirm(submission.id, input),
      service.confirm(submission.id, input),
    ]);

    expect(first.paymentId).toBe(second.paymentId);
    expect(await prisma.payment.count({ where: { id: first.paymentId } })).toBe(1);
    expect(await prisma.financialLedgerEntry.count({ where: { paymentId: first.paymentId } })).toBe(1);
    expect(await prisma.collectionSubmission.count({ where: { status: "confirmed", retailerId: ids.retailer } })).toBe(1);
  });

  it("does not accept a new collection while the account balance needs reconciliation", async () => {
    await prisma.retailer.update({ where: { id: ids.retailer }, data: { currentBalance: 62_412 } });
    const before = await prisma.collectionSubmission.count({ where: { retailerId: ids.retailer } });
    await expect(service.submit({
      retailerId: ids.retailer,
      collectorStaffId: "collector-1",
      actorPermissions: ["collection.submit"],
      amount: 100,
      method: "cash",
      reference: "uat-review-no-payment",
      idempotencyKey: `reconciliation-${randomUUID()}`,
    })).rejects.toMatchObject({ code: "financial_reconciliation_required", status: 409 });
    expect(await prisma.collectionSubmission.count({ where: { retailerId: ids.retailer } })).toBe(before);
  });

  it("does not start a new payment when Accounts confirms a pending collection for an account under review", async () => {
    const pending = await prisma.collectionSubmission.findFirstOrThrow({
      where: { retailerId: ids.retailer, status: "pending", paymentId: null },
    });
    const before = await prisma.payment.count({ where: { retailerId: ids.retailer } });
    await expect(service.confirm(pending.id, {
      actorStaffId: "accounts-1",
      actorPermissions: ["collection.confirm"],
      stepUpUntil: new Date(Date.now() + 60_000),
    })).rejects.toMatchObject({ code: "financial_reconciliation_required", status: 409 });
    expect(await prisma.payment.count({ where: { retailerId: ids.retailer } })).toBe(before);
  });
});
