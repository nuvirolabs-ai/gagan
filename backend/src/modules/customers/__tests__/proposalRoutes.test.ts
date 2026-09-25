import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createRetailerProposalRouter } from "../proposalRoutes";

function appWith(permissions: string[], service: Record<string, any>) {
  const app = express();
  app.use(express.json());
  const authenticate: RequestHandler = (req: any, _res, next) => {
    req.staffAuth = { staffId: "staff-1", permissions, delegationIds: [] };
    next();
  };
  app.use("/rep", createRetailerProposalRouter({ authenticate, service: service as any }));
  return app;
}

const orderPermissions = ["retailer.propose", "order.create_for_retailer"];

describe("pending retailer demand routes", () => {
  it("requires both proposal and order permissions before returning the proposal catalog", async () => {
    const service = { proposalDemandCatalog: vi.fn().mockResolvedValue({ catalog: [] }) };
    const response = await request(appWith(["retailer.propose"], service))
      .get("/rep/retailer-proposals/proposal-1/catalog");

    expect(response.status).toBe(403);
    expect(service.proposalDemandCatalog).not.toHaveBeenCalled();
  });

  it("accepts unpriced demand and converts through the protected official-order endpoint", async () => {
    const service = {
      proposalDemandCatalog: vi.fn().mockResolvedValue({ catalog: [] }),
      punchOrderIntent: vi.fn().mockResolvedValue({ id: "intent-1", items: [{ variantId: "sku-1", qty: 2 }] }),
      orderIntentForSalesperson: vi.fn().mockResolvedValue({ id: "intent-1", demandState: "ready_for_official_order" }),
      convertOrderIntent: vi.fn().mockResolvedValue({
        order: { id: "order-1" },
        decision: { result: "approval_required" },
        approvalRequest: { id: "approval-1" },
        alreadyConverted: false,
      }),
    };
    const app = appWith(orderPermissions, service);

    const punched = await request(app)
      .post("/rep/retailer-proposals/proposal-1/order-intents")
      .set("Idempotency-Key", "punch-1")
      .send({ items: [{ variantId: "sku-1", qty: 2 }] });
    expect(punched.status).toBe(201);
    expect(service.punchOrderIntent).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      salespersonId: "staff-1",
      idempotencyKey: "punch-1",
      items: [{ variantId: "sku-1", qty: 2 }],
    });

    const converted = await request(app)
      .post("/rep/retailer-proposal-order-intents/intent-1/convert")
      .send({ commercial: { quoteId: "quote-1", revision: 1 } });
    expect(converted.status).toBe(201);
    expect(converted.body).toMatchObject({
      order: { id: "order-1" },
      creditDecision: { result: "approval_required" },
      approvalRequest: { id: "approval-1" },
      dispatchAuthorization: null,
    });
    expect(service.convertOrderIntent).toHaveBeenCalledWith({
      intentId: "intent-1",
      salespersonId: "staff-1",
      commercial: { quoteId: "quote-1", revision: 1 },
    });
  });
});
