import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRetailer: vi.fn(),
  findPayment: vi.fn(),
  upsertPayment: vi.fn(),
  updatePayment: vi.fn(),
  updateManyPayments: vi.fn(),
  transaction: vi.fn(),
  settleNew: vi.fn(),
  financialSummary: vi.fn(),
  paymentInvoices: vi.fn(),
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: {
    retailer: { findUnique: mocks.findRetailer },
    payment: {
      findUnique: mocks.findPayment,
      upsert: mocks.upsertPayment,
      update: mocks.updatePayment,
      updateMany: mocks.updateManyPayments,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../../../lib/adminAuth", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdminPermission: (..._perms: unknown[]) => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAnyAdminPermission: (..._perms: unknown[]) => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../paymentService", () => ({ settleSucceededPayment: mocks.settleNew }));
vi.mock("../../finance/financialQueries", () => ({ retailerPaymentInvoicesFor: mocks.paymentInvoices }));
vi.mock("../../finance/financialSummary", () => ({ financialSummaryFor: mocks.financialSummary }));
vi.mock("../../../lib/ageing", () => ({
  ageingFor: vi.fn(),
  ageAllRetailers: vi.fn(),
}));

import adminRetailerRoutes from "../../../routes/admin/retailers";

describe("manual payment API cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.paymentInvoices.mockResolvedValue({ invoiceAllocationRequired: false, paymentInvoices: [] });
  });
  it("creates pending evidence of the attempt before exactly-once settlement", async () => {
    mocks.findPayment.mockResolvedValue(null);
    mocks.financialSummary.mockResolvedValue({ reconciliationRequired: false });
    mocks.findRetailer.mockResolvedValue({
      id: "retailer-1",
      currentBalance: 500,
    });
    mocks.upsertPayment.mockResolvedValue({
      id: "payment-1",
      retailerId: "retailer-1",
      amount: 500,
      status: "pending",
      channel: "manual",
    });
    mocks.settleNew.mockResolvedValue({
      paymentId: "payment-1",
      allocations: [],
      unallocated: 0,
      balanceAfter: 0,
      idempotent: false,
    });
    mocks.transaction.mockResolvedValue({ legacy: true });
    const app = express();
    app.use(express.json(), adminRetailerRoutes);

    const response = await request(app).post("/payments").send({
      retailerId: "retailer-1",
      amount: 500,
      idempotencyKey: "manual-request-1",
    });

    expect(response.status).toBe(200);
    expect(mocks.upsertPayment).toHaveBeenCalledWith({
      where: { providerRef: "manual:manual-request-1" },
      update: {},
      create: {
        retailerId: "retailer-1",
        amount: 500,
        status: "pending",
        channel: "manual",
        provider: "manual",
        providerRef: "manual:manual-request-1",
        confirmedMethod: "OFFLINE_RECORDED",
        confirmedByStaffId: null,
        invoiceScopeId: null,
      },
    });
    expect(mocks.settleNew).toHaveBeenCalledWith({
      paymentId: "payment-1",
      occurredAt: expect.any(Date),
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("denies new manual settlement before any payment row is created for an unreconciled account", async () => {
    mocks.findRetailer.mockResolvedValue({ id: "retailer-1", currentBalance: 62412 });
    mocks.findPayment.mockResolvedValue(null);
    mocks.financialSummary.mockResolvedValue({ reconciliationRequired: true });
    mocks.upsertPayment.mockClear();
    const app = express(); app.use(express.json(), adminRetailerRoutes);
    const response = await request(app).post("/payments").send({ retailerId: "retailer-1", amount: 100, idempotencyKey: "manual-review-1" });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "financial_reconciliation_required" });
    expect(mocks.upsertPayment).not.toHaveBeenCalled();
  });

  it("validates a firm invoice scope before recording and detects a replay against its sibling", async () => {
    mocks.findRetailer.mockResolvedValue({ id: "retailer-1", currentBalance: 500 });
    mocks.financialSummary.mockResolvedValue({ reconciliationRequired: false });
    mocks.findPayment.mockResolvedValue(null);
    mocks.paymentInvoices.mockResolvedValue({
      invoiceAllocationRequired: true,
      paymentInvoices: [{
        id: "padam-invoice", paymentEligible: true,
        entityBalances: { jainTraders: 0, padamInternational: 500 },
      }],
    });
    const payload = { retailerId: "retailer-1", amount: 100, idempotencyKey: "manual-firm-1" };
    const app = express();
    app.use(express.json(), adminRetailerRoutes);

    const unscoped = await request(app).post("/payments").send(payload);
    expect(unscoped.body).toEqual({ error: "invoice_entity_allocation_required" });
    const wrongCompany = await request(app).post("/payments").send({
      ...payload, invoiceScopeId: "padam-invoice", jainAmount: 100, padamAmount: 0,
    });
    expect(wrongCompany.body).toEqual({ error: "invoice_entity_allocation_invalid" });
    expect(mocks.upsertPayment).not.toHaveBeenCalled();

    const posted = {
      id: "payment-1", retailerId: payload.retailerId, amount: payload.amount,
      invoiceScopeId: "padam-invoice", confirmedJainAmount: 0, confirmedPadamAmount: 100,
    };
    mocks.upsertPayment.mockResolvedValue(posted);
    mocks.settleNew.mockResolvedValue({ paymentId: "payment-1" });
    const scoped = await request(app).post("/payments").send({
      ...payload, invoiceScopeId: "padam-invoice", jainAmount: 0, padamAmount: 100,
    });
    expect(scoped.status).toBe(200);
    expect(mocks.upsertPayment).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ invoiceScopeId: "padam-invoice", confirmedJainAmount: 0, confirmedPadamAmount: 100 }),
    }));

    mocks.findPayment.mockResolvedValue(posted);
    const siblingReplay = await request(app).post("/payments").send({
      ...payload, invoiceScopeId: "jain-invoice", jainAmount: 100, padamAmount: 0,
    });
    expect(siblingReplay.status).toBe(409);
    expect(siblingReplay.body).toEqual({ error: "idempotency_key_conflict" });
    expect(mocks.settleNew).toHaveBeenCalledTimes(1);
  });
});
