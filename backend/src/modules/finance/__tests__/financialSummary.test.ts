import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../identity/sessionRuntime";
import { financialSummaryFor } from "../financialSummary";
import { FieldDashboardService } from "../../field/dashboardService";

const run = randomUUID();
const ids = {
  tier: `summary-tier-${run}`,
  retailer: `summary-retailer-${run}`,
  order: `summary-order-${run}`,
  invoice: `summary-invoice-${run}`,
  entityRetailer: `summary-entity-retailer-${run}`,
  attributedInvoice: `summary-attributed-invoice-${run}`,
  legacyInvoice: `summary-legacy-invoice-${run}`,
  payment: `summary-payment-${run}`,
  rep: randomUUID(),
  staff: randomUUID(),
};

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Summary tier ${run}` } });
  await prisma.salesRep.create({ data: { id: ids.rep, name: "Summary rep", phone: `86${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "6")}` } });
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "salesperson" } });
  await prisma.staffUser.create({ data: { id: ids.staff, name: "Summary staff", phone: `86${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "6")}`, email: `summary-${run}@test.invalid`, salesRepId: ids.rep, roles: { create: { roleId: role.id } } } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "Summary retailer", phone: `87${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "7")}`, shopAddress: "Test", tierId: ids.tier, salesRepId: ids.rep, creditLimit: 100_000, currentBalance: 62_412, overdueAmount: 40_500 } });
  await prisma.retailer.create({ data: { id: ids.entityRetailer, name: "Entity summary retailer", phone: `88${run.replace(/\D/g, "").slice(0, 8).padEnd(8, "8")}`, shopAddress: "Test", tierId: ids.tier, creditLimit: 100_000, currentBalance: 0, overdueAmount: 0 } });
});

afterAll(async () => {
  await prisma.paymentAllocation.deleteMany({ where: { paymentId: ids.payment } });
  await prisma.payment.deleteMany({ where: { id: ids.payment } });
  await prisma.deviceSession.deleteMany({ where: { subjectId: ids.staff } });
  await prisma.staffUser.deleteMany({ where: { id: ids.staff } });
  await prisma.invoice.deleteMany({ where: { retailerId: ids.entityRetailer } });
  await prisma.retailer.deleteMany({ where: { id: ids.entityRetailer } });
  await prisma.invoice.deleteMany({ where: { retailerId: ids.retailer } });
  await prisma.order.deleteMany({ where: { id: ids.order } });
  await prisma.retailer.deleteMany({ where: { id: ids.retailer } });
  await prisma.salesRep.deleteMany({ where: { id: ids.rep } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("shared financial summary", () => {
  it("marks cached balances as stale and does not fabricate zero ageing", async () => {
    const summary = await financialSummaryFor(prisma, ids.retailer);
    expect(summary).toMatchObject({
      outstanding: 62_412,
      overdue: 40_500,
      source: "cached_retailer_balance",
      isStale: true,
      invoiceAgeing: null,
      entityBalances: {
        outstanding: { jainTraders: 0, padamInternational: 0, unattributed: 62_412 },
        overdue: { jainTraders: 0, padamInternational: 0, unattributed: 40_500 },
        attributionStatus: "contains_unattributed",
      },
    });
  });

  it("uses invoice ageing as the source once local invoices exist", async () => {
    await prisma.order.create({ data: { id: ids.order, retailerId: ids.retailer, orderTotal: 12_500 } });
    await prisma.invoice.create({ data: { id: ids.invoice, retailerId: ids.retailer, orderId: ids.order, invoiceDate: new Date("2026-08-01"), dueDate: new Date("2026-08-10"), subtotal: 12_500, total: 12_500, outstandingAmount: 12_500, idempotencyKey: `${ids.invoice}-key` } });
    const summary = await financialSummaryFor(prisma, ids.retailer, new Date("2026-08-21"));
    expect(summary).toMatchObject({ outstanding: 12_500, overdue: 12_500, source: "local_invoice_ledger", isStale: false });
    expect(summary?.invoiceAgeing?.totalOutstanding).toBe(12_500);
    expect(summary?.reconciliationRequired).toBe(true);

    const receivables = await new FieldDashboardService(prisma).pendingCollections(ids.staff);
    expect(receivables.retailers).toEqual([]);
    expect(receivables.reviewRetailers).toEqual([{ id: ids.retailer, name: "Summary retailer" }]);
    expect(receivables.totalOverdue).toBe(0);
    const staffSession = await lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staff, deviceName: "finance-reconciliation-rep-test" });
    const repHeaders = { Authorization: `Bearer ${staffSession.accessToken}` };
    const repToday = await request(createApp()).get("/rep/field/today").set(repHeaders).expect(200);
    expect(repToday.body.pendingCollections.reviewRetailers).toEqual([{ id: ids.retailer, name: "Summary retailer" }]);
    const repRetailers = await request(createApp()).get("/rep/retailers").set(repHeaders).expect(200);
    expect(repRetailers.body.retailers[0].financialSummary.reconciliationRequired).toBe(true);
    expect(repRetailers.body.totals).toMatchObject({ count: 1, outstanding: 0, overdue: 0, reconciliationRequiredCount: 1 });

    const session = await lazyIdentitySessionService.createSession({
      realm: "retailer", subjectId: ids.retailer, deviceName: "finance-reconciliation-test",
    });
    const app = createApp();
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}` };
      const home = await request(app).get("/home").set(headers).expect(200);
      expect(home.body.financialSummary.reconciliationRequired).toBe(true);
      const ledger = await request(app).get(`/ledger/${ids.retailer}`).set(headers).expect(200);
      expect(ledger.body.financialSummary.reconciliationRequired).toBe(true);
      const dues = await request(app).get("/payments/dues").set(headers).expect(200);
      expect(dues.body.financialSummary.reconciliationRequired).toBe(true);
      const before = await prisma.payment.count({ where: { retailerId: ids.retailer } });
      const intent = await request(app).post("/payments/intent").set(headers)
        .set("Idempotency-Key", `reconciliation-${run}`).send({ amount: 100 });
      expect(intent.status).toBe(409);
      expect(intent.body).toEqual({ error: "financial_reconciliation_required" });
      expect(await prisma.payment.count({ where: { retailerId: ids.retailer } })).toBe(before);
    } finally {
      await prisma.deviceSession.deleteMany({ where: { subjectId: ids.retailer } });
    }
  });

  it("reads back entity balances from invoice snapshots and payment allocations", async () => {
    await prisma.invoice.create({
      data: {
        id: ids.attributedInvoice,
        retailerId: ids.entityRetailer,
        invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
        dueDate: new Date("2026-08-10T00:00:00.000Z"),
        subtotal: 100,
        total: 100,
        outstandingAmount: 70,
        status: "partially_paid",
        commercialSnapshot: {
          entities: [
            { entity: "jain_traders", total: "60.00" },
            { entity: "padam_international", total: "40.00" },
          ],
        },
        idempotencyKey: `${ids.attributedInvoice}-key`,
      },
    });
    await prisma.invoice.create({
      data: {
        id: ids.legacyInvoice,
        retailerId: ids.entityRetailer,
        invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
        dueDate: new Date("2026-09-01T00:00:00.000Z"),
        subtotal: 25,
        total: 25,
        outstandingAmount: 25,
        idempotencyKey: `${ids.legacyInvoice}-key`,
      },
    });
    await prisma.payment.create({
      data: {
        id: ids.payment,
        retailerId: ids.entityRetailer,
        amount: 30,
        status: "succeeded",
        channel: "manual",
      },
    });
    await prisma.paymentAllocation.create({
      data: {
        paymentId: ids.payment,
        invoiceId: ids.attributedInvoice,
        amount: 30,
        jainAmount: 20,
        padamAmount: 10,
      },
    });

    await prisma.retailer.update({ where: { id: ids.entityRetailer }, data: { currentBalance: 95, overdueAmount: 70 } });
    const summary = await financialSummaryFor(prisma, ids.entityRetailer, new Date("2026-08-21T00:00:00.000Z"));

    expect(summary).toMatchObject({
      outstanding: 95,
      overdue: 70,
      reconciliationRequired: false,
      entityBalances: {
        outstanding: { jainTraders: 40, padamInternational: 30, unattributed: 25 },
        overdue: { jainTraders: 40, padamInternational: 30, unattributed: 0 },
        attributionStatus: "contains_unattributed",
      },
    });
    expect(
      summary!.entityBalances.outstanding.jainTraders +
        summary!.entityBalances.outstanding.padamInternational +
        summary!.entityBalances.outstanding.unattributed
    ).toBe(summary!.outstanding);

    const session = await lazyIdentitySessionService.createSession({
      realm: "retailer",
      subjectId: ids.entityRetailer,
      deviceName: "retailer-home-finance-test",
    });
    const app = createApp();
    try {
      await request(app).get("/home").expect(401);
      const home = await request(app)
        .get("/home")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .expect(200);

      expect(home.body.credit).toMatchObject({
        outstanding: 95,
        overdue: 95,
        creditLimit: 100_000,
        used: 95,
        available: 99_905,
      });
      expect(home.body.financialSummary.entityBalances).toMatchObject({
        outstanding: { jainTraders: 40, padamInternational: 30, unattributed: 25 },
        overdue: { jainTraders: 40, padamInternational: 30, unattributed: 25 },
        attributionStatus: "contains_unattributed",
      });
    } finally {
      await prisma.deviceSession.deleteMany({ where: { subjectId: ids.entityRetailer } });
    }
  });
});
