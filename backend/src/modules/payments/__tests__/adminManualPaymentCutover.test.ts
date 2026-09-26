import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRetailer: vi.fn(),
  findPayment: vi.fn(),
  upsertPayment: vi.fn(),
  updatePayment: vi.fn(),
  updateManyPayments: vi.fn(),
  transaction: vi.fn(),
  settleNew: vi.fn(),
  financialSummary: vi.fn(),
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
}));
vi.mock("../paymentService", () => ({ settleSucceededPayment: mocks.settleNew }));
vi.mock("../../finance/financialSummary", () => ({ financialSummaryFor: mocks.financialSummary }));
vi.mock("../../../lib/ageing", () => ({
  ageingFor: vi.fn(),
  ageAllRetailers: vi.fn(),
}));

import adminRetailerRoutes from "../../../routes/admin/retailers";

describe("manual payment API cutover", () => {
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
});
