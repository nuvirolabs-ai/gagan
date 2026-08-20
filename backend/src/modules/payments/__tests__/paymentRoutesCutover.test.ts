import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPayment: vi.fn(),
  updatePayment: vi.fn(),
  settleNew: vi.fn(),
  verifyCallback: vi.fn(),
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: {
    payment: {
      findUnique: mocks.findPayment,
      update: mocks.updatePayment,
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({
        payment: {
          findUniqueOrThrow: mocks.findPayment,
          update: mocks.updatePayment,
        },
      }),
  },
}));
vi.mock("../../../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../../lib/payments", () => ({
  getPaymentProvider: () => ({ verifyCallback: mocks.verifyCallback }),
}));
vi.mock("../paymentService", () => ({ settleSucceededPayment: mocks.settleNew }));

import paymentRoutes from "../../../routes/payments";

describe("payment callback API cutover", () => {
  it("settles a verified success through the exactly-once payment service", async () => {
    mocks.verifyCallback.mockReturnValue({ providerRef: "provider-1", status: "succeeded" });
    mocks.findPayment.mockResolvedValue({
      id: "payment-1",
      retailerId: "retailer-1",
      providerRef: "provider-1",
      amount: 500,
      status: "pending",
    });
    mocks.settleNew.mockResolvedValue({
      paymentId: "payment-1",
      allocations: [],
      unallocated: 0,
      balanceAfter: 0,
      idempotent: false,
    });
    const app = express();
    app.use(express.json(), paymentRoutes);

    const response = await request(app).post("/payments/callback").send({ signed: true });

    expect(response.status).toBe(200);
    expect(mocks.settleNew).toHaveBeenCalledWith({
      paymentId: "payment-1",
      occurredAt: expect.any(Date),
    });
    expect(response.body).toMatchObject({ ok: true, status: "succeeded", balanceAfter: 0 });
  });
});
