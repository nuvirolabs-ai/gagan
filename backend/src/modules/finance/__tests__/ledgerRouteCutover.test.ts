import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRetailer: vi.fn(),
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
vi.mock("../financialQueries", () => ({ financialLedgerFor: mocks.financialLedger }));

import ledgerRoutes from "../../../routes/ledger";

describe("retailer ledger API cutover", () => {
  it("returns the immutable financial projection for only the signed-in retailer", async () => {
    mocks.findRetailer.mockResolvedValue({ currentBalance: 300, creditLimit: 1_000 });
    mocks.financialLedger.mockResolvedValue([
      { id: "event-1", kind: "credit_note", direction: "credit", amount: 100 },
    ]);
    const app = express();
    app.use(ledgerRoutes);

    const response = await request(app).get("/ledger/retailer-1");

    expect(response.status).toBe(200);
    expect(mocks.financialLedger).toHaveBeenCalledWith(expect.anything(), "retailer-1");
    expect(response.body).toMatchObject({
      currentBalance: 300,
      creditLimit: 1_000,
      entries: [{ id: "event-1", kind: "credit_note" }],
    });
  });

  it("denies another retailer id before querying financial data", async () => {
    const app = express();
    app.use(ledgerRoutes);

    const response = await request(app).get("/ledger/retailer-2");

    expect(response.status).toBe(403);
  });
});
