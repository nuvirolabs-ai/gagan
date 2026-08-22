import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOrder: vi.fn(),
  findOrderOrThrow: vi.fn(),
  transaction: vi.fn(),
  createInvoice: vi.fn(),
  findAuthorization: vi.fn(),
  updateOrder: vi.fn(),
  findRetailer: vi.fn(),
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: {
    order: { findUnique: mocks.findOrder, findUniqueOrThrow: mocks.findOrderOrThrow, update: mocks.updateOrder },
    retailer: { findUnique: mocks.findRetailer },
    dispatchAuthorization: { findFirst: mocks.findAuthorization },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../../../lib/adminAuth", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../invoiceService", () => ({ createInvoiceForDelivery: mocks.createInvoice }));

import adminOrderRoutes from "../../../routes/admin/orders";

describe("delivery API cutover", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cannot confirm an order without current dispatch authorization", async () => {
    mocks.findOrder.mockResolvedValue({ id: "order-held", status: "placed" });
    mocks.findAuthorization.mockResolvedValue(null);
    const app = express();
    app.use(express.json(), adminOrderRoutes);

    const response = await request(app).post("/orders/order-held/approve");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "dispatch_authorization_required" });
    expect(mocks.updateOrder).not.toHaveBeenCalled();
  });

  it("does not dispatch when rating invalidation wins the authorization race", async () => {
    mocks.findOrder.mockResolvedValue({ id: "order-race", status: "packed" });
    mocks.findRetailer.mockResolvedValue({ id: "retailer-1", status: "active", creditProfile: { kycVerifiedAt: new Date() }, kycCase: null });
    mocks.findAuthorization.mockResolvedValue({ id: "authorization-race" });
    mocks.transaction.mockImplementationOnce(async (work) => work({
      dispatchAuthorization: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }));
    const app = express();
    app.use(express.json(), adminOrderRoutes);

    const response = await request(app)
      .post("/dispatch/order-race/assign")
      .send({ routeId: "route-1" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "dispatch_authorization_expired" });
  });

  it("completes POD through exactly-once invoice creation", async () => {
    mocks.findAuthorization.mockResolvedValue({ id: "authorization-1" });
    mocks.findOrder.mockResolvedValue({
      id: "order-1",
      retailerId: "retailer-1",
      status: "out_for_delivery",
      items: [
        { id: "item-1", variant: {} },
        { id: "item-2", variant: {} },
      ],
      retailer: { currentBalance: 0 },
    });
    mocks.findOrderOrThrow.mockResolvedValue({ id: "order-1", status: "delivered" });
    mocks.transaction.mockResolvedValue({ legacy: true });
    mocks.createInvoice.mockResolvedValue({
      id: "invoice-1",
      total: 300,
      ledgerEntry: { balanceAfter: 300 },
      legacyLedgerEntry: { id: "legacy-1" },
    });
    const app = express();
    app.use(express.json(), adminOrderRoutes);

    const response = await request(app)
      .post("/dispatch/order-1/pod")
      .send({
        podType: "otp",
        items: [
          { orderItemId: "item-1", qtyDelivered: 1 },
          { orderItemId: "item-2", qtyDelivered: 2, weightDeliveredKg: 20 },
        ],
      });

    expect(response.status).toBe(200);
    expect(mocks.createInvoice).toHaveBeenCalledWith({
      orderId: "order-1",
      occurredAt: expect.any(Date),
      idempotencyKey: "delivery:order-1",
      lines: [
        { orderItemId: "item-1", deliveredCases: 1, deliveredWeightKg: undefined },
        { orderItemId: "item-2", deliveredCases: 2, deliveredWeightKg: 20 },
      ],
      proof: { podType: "otp", capturedAt: expect.any(Date) },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({ invoice: { id: "invoice-1" }, balanceAfter: 300 });
  });

  it("returns the existing invoice when the POD request is retried", async () => {
    mocks.findAuthorization.mockResolvedValue({ id: "authorization-1" });
    mocks.findOrder.mockResolvedValue({
      id: "order-1",
      retailerId: "retailer-1",
      status: "delivered",
      items: [{ id: "item-1", variant: {} }],
      retailer: { currentBalance: 300 },
    });
    mocks.findOrderOrThrow.mockResolvedValue({ id: "order-1", status: "delivered" });
    mocks.createInvoice.mockResolvedValue({
      id: "invoice-1",
      total: 300,
      ledgerEntry: { balanceAfter: 300 },
      legacyLedgerEntry: { id: "legacy-1" },
    });
    const app = express();
    app.use(express.json(), adminOrderRoutes);

    const response = await request(app)
      .post("/dispatch/order-1/pod")
      .send({
        podType: "otp",
        items: [{ orderItemId: "item-1", qtyDelivered: 1 }],
      });

    expect(response.status).toBe(200);
    expect(response.body.invoice.id).toBe("invoice-1");
  });
});
