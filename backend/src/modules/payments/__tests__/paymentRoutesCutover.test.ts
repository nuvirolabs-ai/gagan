import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPayment: vi.fn(),
  updatePayment: vi.fn(),
  settleNew: vi.fn(),
  verifyCallback: vi.fn(),
  findRetailer: vi.fn(),
  invoiceCount: vi.fn(),
  createIntent: vi.fn(),
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: {
    retailer: {findUnique:mocks.findRetailer},
    invoice: {count:mocks.invoiceCount},
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
  getPaymentProvider: () => ({ verifyCallback: mocks.verifyCallback,createIntent:mocks.createIntent }),
}));
vi.mock("../paymentService", () => ({ settleSucceededPayment: mocks.settleNew }));

import paymentRoutes from "../../../routes/payments";

describe("payment callback API cutover", () => {
  it("requires a client idempotency key before creating an online payment intent",async()=>{
    mocks.findRetailer.mockClear();
    mocks.createIntent.mockClear();
    const app=express();app.use(express.json(),paymentRoutes);
    const response=await request(app).post("/payments/intent").send({amount:100});
    expect(response.status).toBe(400);
    expect(response.body).toEqual({error:"idempotency_key_required"});
    expect(mocks.findRetailer).not.toHaveBeenCalled();
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });

  it("blocks unallocated commercial payment before contacting a provider",async()=>{
    mocks.findRetailer.mockResolvedValue({id:"retailer-1",currentBalance:1000});
    mocks.invoiceCount.mockResolvedValue(1);
    const app=express();app.use(express.json(),paymentRoutes);
    const response=await request(app).post("/payments/intent").set("Idempotency-Key","attempt-1").send({amount:100});
    expect(response.status).toBe(409);expect(response.body.error).toContain("specific invoice");
    expect(mocks.createIntent).not.toHaveBeenCalled();
  });
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
