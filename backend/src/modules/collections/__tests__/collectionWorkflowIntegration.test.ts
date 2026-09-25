import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { requireAdminIdentity } from "../../../lib/adminAuth";
import { lazyIdentitySessionService } from "../../identity/sessionRuntime";
import { createRequireSession } from "../../identity/sessionAuth";
import type { ObjectStorage, PutObjectInput, StoredObject } from "../../../platform/storage/objectStorage";
import { createCollectionRouter } from "../collectionRoutes";
import { CollectionService } from "../collectionService";

class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, Buffer>();

  async put(input: PutObjectInput): Promise<StoredObject> {
    const objectKey = `${input.purpose}/${randomUUID()}`;
    this.objects.set(objectKey, input.body);
    return { objectKey, checksum: "local-collection-proof", contentType: input.contentType, sizeBytes: input.body.length };
  }

  async read(objectKey: string) {
    const body = this.objects.get(objectKey);
    if (!body) throw new Error("object_not_found");
    return body;
  }

  async signedReadUrl(objectKey: string) {
    return `signed://${objectKey}`;
  }

  async delete(objectKey: string) {
    this.objects.delete(objectKey);
  }
}

const ids = {
  tier: randomUUID(),
  retailer: randomUUID(),
  collector: randomUUID(),
  accounts: randomUUID(),
  adminUser: randomUUID(),
  invoice: randomUUID(),
  legacyLedgerEntry: randomUUID(),
};
const storage = new MemoryObjectStorage();
const service = new CollectionService({ storage });
const app = express();
app.use(express.json());
app.use("/rep", createCollectionRouter({ authenticate: createRequireSession("staff", lazyIdentitySessionService), service }));
app.use("/admin", createCollectionRouter({ authenticate: requireAdminIdentity, service }));

let collectorToken = "";
let accountsToken = "";

beforeAll(async () => {
  const [tier, collectorRole, accountsRole] = await Promise.all([
    prisma.tier.create({ data: { id: ids.tier, name: `collection-flow-${ids.tier}` } }),
    prisma.role.findUniqueOrThrow({ where: { name: "field_collector" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "accounts" } }),
  ]);
  await prisma.retailer.create({
    data: {
      id: ids.retailer,
      name: "Collection Flow Retailer",
      phone: `6${Date.now().toString().slice(-9)}`,
      shopAddress: "Local test address",
      tierId: tier.id,
      creditLimit: 1_000,
      currentBalance: 120,
    },
  });
  await prisma.staffUser.create({
    data: {
      id: ids.collector,
      name: "Asha Verma",
      phone: `7${Date.now().toString().slice(-9)}`,
      email: `${ids.collector}@test.invalid`,
      roles: { create: { roleId: collectorRole.id } },
    },
  });
  await prisma.adminUser.create({ data: { id: ids.adminUser, email: `${ids.adminUser}@test.invalid`, name: "Accounts Reviewer", passwordHash: "test-only" } });
  await prisma.staffUser.create({
    data: {
      id: ids.accounts,
      name: "Accounts Reviewer",
      phone: `8${Date.now().toString().slice(-9)}`,
      email: `${ids.accounts}@test.invalid`,
      adminUserId: ids.adminUser,
      roles: { create: { roleId: accountsRole.id } },
    },
  });
  await prisma.collectionAssignment.create({ data: { collectorStaffId: ids.collector, retailerId: ids.retailer } });

  await prisma.ledgerEntry.create({
    data: {
      id: ids.legacyLedgerEntry,
      retailerId: ids.retailer,
      type: "invoice",
      amount: 120,
      balanceAfter: 120,
      dueDate: new Date("2026-10-10T00:00:00.000Z"),
    },
  });
  await prisma.invoice.create({
    data: {
      id: ids.invoice,
      retailerId: ids.retailer,
      legacyLedgerEntryId: ids.legacyLedgerEntry,
      invoiceDate: new Date("2026-09-20T00:00:00.000Z"),
      dueDate: new Date("2026-10-10T00:00:00.000Z"),
      subtotal: 120,
      total: 120,
      outstandingAmount: 120,
      idempotencyKey: `collection-invoice-${ids.invoice}`,
      commercialSnapshot: {
        entities: [
          { entity: "jain_traders", total: "70.00" },
          { entity: "padam_international", total: "50.00" },
        ],
      },
    },
  });
  await prisma.financialLedgerEntry.create({
    data: {
      retailerId: ids.retailer,
      invoiceId: ids.invoice,
      direction: "debit",
      kind: "invoice",
      amount: 120,
      balanceAfter: 120,
      idempotencyKey: `collection-invoice-ledger-${ids.invoice}`,
      occurredAt: new Date("2026-09-20T00:00:00.000Z"),
    },
  });

  const [collectorSession, accountsSession] = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.collector, deviceName: "collection-flow-test" }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.accounts, deviceName: "collection-flow-test" }),
  ]);
  collectorToken = collectorSession.accessToken;
  accountsToken = accountsSession.accessToken;
});

afterAll(async () => {
  await prisma.collectionEvidence.deleteMany({ where: { submission: { retailerId: ids.retailer } } });
  await prisma.collectionSubmission.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.collectionAssignment.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.paymentAllocation.deleteMany({ where: { invoiceId: ids.invoice } });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId: ids.retailer, paymentId: { not: null } } });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.payment.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: ids.invoice } });
  await prisma.invoice.deleteMany({ where: { id: ids.invoice } });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.collector, ids.accounts] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [ids.collector, ids.accounts] } } });
  await prisma.adminUser.deleteMany({ where: { id: ids.adminUser } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
});

describe("authenticated field collection lifecycle", () => {
  it("captures and confirms CASH, CHEQUE, and NEFT against explicit invoice entity splits", async () => {
    const submitted = await request(app)
      .post("/rep/collections")
      .set("Authorization", `Bearer ${collectorToken}`)
      .send({
        retailerId: ids.retailer,
        invoiceScopeId: ids.invoice,
        jainAmount: "60.00",
        padamAmount: "40.00",
        amount: 100,
        method: "cheque",
        reference: "CHQ-2026-001",
        notes: "Collected at the retailer counter",
        idempotencyKey: `collection-flow-${randomUUID()}`,
        evidence: { contentType: "image/jpeg", bodyBase64: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64") },
      });

    expect(submitted.status).toBe(201);
    const submission = submitted.body.submission;
    expect(submission).toMatchObject({
      retailerId: ids.retailer,
      collectorStaffId: ids.collector,
      collectorName: "Asha Verma",
      invoiceScopeId: ids.invoice,
      amount: "100",
      method: "cheque",
      reference: "CHQ-2026-001",
      notes: "Collected at the retailer counter",
      status: "pending",
      jainAmount: "60",
      padamAmount: "40",
    });
    expect(Number.isFinite(Date.parse(submission.submittedAt))).toBe(true);
    expect(submission.evidence[0].signedUrl).toMatch(/^signed:\/\/collection_receipt\//);
    expect(submission.evidence[0]).not.toHaveProperty("objectKey");
    expect(await prisma.payment.count({ where: { retailerId: ids.retailer } })).toBe(0);
    expect(await prisma.financialLedgerEntry.count({ where: { retailerId: ids.retailer, paymentId: { not: null } } })).toBe(0);

    const queue = await request(app).get("/admin/collections").set("Authorization", `Bearer ${accountsToken}`).expect(200);
    const queued = queue.body.submissions.find((item: { id: string }) => item.id === submission.id);
    expect(queued).toMatchObject({ collectorName: "Asha Verma", status: "pending", notes: "Collected at the retailer counter", reference: "CHQ-2026-001", invoiceScopeId: ids.invoice, jainAmount: "60", padamAmount: "40" });
    expect(queued.evidence[0].signedUrl).toMatch(/^signed:\/\//);

    const detail = await request(app).get(`/admin/collections/${submission.id}`).set("Authorization", `Bearer ${accountsToken}`).expect(200);
    expect(detail.body.submission).toMatchObject({ id: submission.id, collectorName: "Asha Verma", status: "pending", notes: "Collected at the retailer counter" });

    const elevated = await lazyIdentitySessionService.elevateSession((await prisma.deviceSession.findFirstOrThrow({ where: { subjectId: ids.accounts, realm: "admin" } })).id, "admin", ids.accounts);
    const confirmed = await request(app)
      .post(`/admin/collections/${submission.id}/confirm`)
      .set("Authorization", `Bearer ${elevated.accessToken}`)
      .expect(200);
    expect(confirmed.body).toMatchObject({ submissionId: submission.id, idempotent: false, settlement: { allocations: [{ invoiceId: ids.invoice, amount: 100 }], unallocated: 0 } });

    const readback = await request(app).get(`/admin/collections/${submission.id}`).set("Authorization", `Bearer ${accountsToken}`).expect(200);
    expect(readback.body.submission).toMatchObject({ status: "confirmed", confirmedByStaffId: ids.accounts, paymentId: confirmed.body.paymentId, collectorName: "Asha Verma" });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: confirmed.body.paymentId }, include: { allocations: true, settlementLedgerEntry: true } });
    expect(payment).toMatchObject({ status: "succeeded", invoiceScopeId: ids.invoice, confirmedMethod: "cheque", confirmedReference: "CHQ-2026-001", confirmedByStaffId: ids.accounts });
    expect(payment.confirmedJainAmount?.toFixed(2)).toBe("60.00");
    expect(payment.confirmedPadamAmount?.toFixed(2)).toBe("40.00");
    expect(payment.allocations).toHaveLength(1);
    expect(payment.allocations[0].jainAmount?.toFixed(2)).toBe("60.00");
    expect(payment.allocations[0].padamAmount?.toFixed(2)).toBe("40.00");
    expect(payment.settlementLedgerEntry).toMatchObject({ direction: "credit", kind: "payment" });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: ids.invoice } })).outstandingAmount.toFixed(2)).toBe("20.00");
    expect((await prisma.retailer.findUniqueOrThrow({ where: { id: ids.retailer } })).currentBalance.toFixed(2)).toBe("20.00");
    expect(await prisma.ledgerEntry.count({ where: { paymentId: payment.id, type: "payment" } })).toBe(1);
    expect((await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: ids.legacyLedgerEntry } })).settledAmount.toFixed(2)).toBe("100.00");

    for (const collection of [
      { method: "cash" as const, reference: "CASH-2026-001", jainAmount: "10.00", padamAmount: "0.00" },
      { method: "neft" as const, reference: "UTR-2026-001", jainAmount: "0.00", padamAmount: "10.00" },
    ]) {
      const capture = await request(app)
        .post("/rep/collections")
        .set("Authorization", `Bearer ${collectorToken}`)
        .send({
          retailerId: ids.retailer,
          invoiceScopeId: ids.invoice,
          amount: 10,
          method: collection.method,
          reference: collection.reference,
          notes: `Verified ${collection.method.toUpperCase()} collection`,
          jainAmount: collection.jainAmount,
          padamAmount: collection.padamAmount,
          idempotencyKey: `collection-flow-${randomUUID()}`,
        })
        .expect(201);
      expect(capture.body.submission).toMatchObject({
        collectorStaffId: ids.collector,
        retailerId: ids.retailer,
        method: collection.method,
        reference: collection.reference,
        notes: `Verified ${collection.method.toUpperCase()} collection`,
        status: "pending",
      });

      const elevatedSession = await lazyIdentitySessionService.elevateSession(
        (await prisma.deviceSession.findFirstOrThrow({ where: { subjectId: ids.accounts, realm: "admin" } })).id,
        "admin",
        ids.accounts,
      );
      const confirmation = await request(app)
        .post(`/admin/collections/${capture.body.submission.id}/confirm`)
        .set("Authorization", `Bearer ${elevatedSession.accessToken}`)
        .expect(200);

      const confirmedPayment = await prisma.payment.findUniqueOrThrow({
        where: { id: confirmation.body.paymentId },
        include: { allocations: true, settlementLedgerEntry: true },
      });
      expect(confirmedPayment).toMatchObject({
        status: "succeeded",
        confirmedMethod: collection.method,
        confirmedReference: collection.reference,
        confirmedByStaffId: ids.accounts,
      });
      expect(confirmedPayment.allocations).toHaveLength(1);
      expect(confirmedPayment.allocations[0].jainAmount?.toFixed(2)).toBe(collection.jainAmount);
      expect(confirmedPayment.allocations[0].padamAmount?.toFixed(2)).toBe(collection.padamAmount);
      expect(confirmedPayment.settlementLedgerEntry).toMatchObject({ direction: "credit", kind: "payment" });

      const adminReadback = await request(app)
        .get(`/admin/collections/${capture.body.submission.id}`)
        .set("Authorization", `Bearer ${accountsToken}`)
        .expect(200);
      expect(adminReadback.body.submission).toMatchObject({
        status: "confirmed",
        method: collection.method,
        reference: collection.reference,
        notes: `Verified ${collection.method.toUpperCase()} collection`,
      });
    }

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: ids.invoice } })).status).toBe("paid");
    expect((await prisma.retailer.findUniqueOrThrow({ where: { id: ids.retailer } })).currentBalance.toFixed(2)).toBe("0.00");
  });
});
