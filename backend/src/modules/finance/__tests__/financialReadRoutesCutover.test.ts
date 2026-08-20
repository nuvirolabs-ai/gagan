import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRetailer: vi.fn(),
  financialAgeing: vi.fn(),
  financialLedger: vi.fn(),
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: { retailer: { findUnique: mocks.findRetailer } },
}));
vi.mock("../../../lib/auth", () => ({
  requireAuth: (req: { retailerId?: string }, _res: unknown, next: () => void) => {
    req.retailerId = "retailer-1";
    next();
  },
}));
vi.mock("../../../lib/adminAuth", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../financialQueries", () => ({
  financialAgeingFor: mocks.financialAgeing,
  financialLedgerFor: mocks.financialLedger,
}));
vi.mock("../../../lib/ageing", () => ({ ageAllRetailers: vi.fn() }));
vi.mock("../../../lib/payments", () => ({ getPaymentProvider: vi.fn() }));

import paymentRoutes from "../../../routes/payments";
import adminRetailerRoutes from "../../../routes/admin/retailers";

describe("financial read API cutover", () => {
  it("returns retailer dues from explicit invoice ageing", async () => {
    mocks.findRetailer.mockResolvedValue({
      id: "retailer-1",
      currentBalance: 300,
      overdueAmount: 100,
      creditLimit: 1_000,
    });
    mocks.financialAgeing.mockResolvedValue({ totalOutstanding: 300, totalOverdue: 100 });
    const app = express();
    app.use(paymentRoutes);

    const response = await request(app).get("/payments/dues");

    expect(response.status).toBe(200);
    expect(mocks.financialAgeing).toHaveBeenCalledWith(expect.anything(), "retailer-1");
    expect(response.body).toMatchObject({ outstanding: 300, ageing: { totalOutstanding: 300 } });
  });

  it("returns the same immutable ledger projection to authorised admin users", async () => {
    mocks.findRetailer.mockResolvedValue({
      id: "retailer-1",
      currentBalance: 300,
      overdueAmount: 100,
      creditLimit: 1_000,
    });
    mocks.financialAgeing.mockResolvedValue({ totalOutstanding: 300, totalOverdue: 100 });
    mocks.financialLedger.mockResolvedValue([
      { id: "entry-1", kind: "payment_reversal", direction: "debit" },
    ]);
    const app = express();
    app.use(adminRetailerRoutes);

    const response = await request(app).get("/retailers/retailer-1/ledger");

    expect(response.status).toBe(200);
    expect(mocks.financialLedger).toHaveBeenCalledWith(expect.anything(), "retailer-1");
    expect(response.body.entries).toEqual([
      { id: "entry-1", kind: "payment_reversal", direction: "debit" },
    ]);
  });
});
