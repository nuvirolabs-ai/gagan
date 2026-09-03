import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createRetailerFormRouter } from "../retailerProposalRoutes";

const service = {
  masters: vi.fn().mockResolvedValue({ groups: [{ id: "g1", name: "Kirana Independent" }] }),
  uploadAadhaar: vi.fn().mockResolvedValue({ id: "asset-1" }),
  propose: vi.fn().mockResolvedValue({ id: "proposal-1", status: "pending" }),
  listProposals: vi.fn().mockResolvedValue([]),
  detail: vi.fn().mockResolvedValue({ id: "proposal-1", status: "pending", partyName: "Sharma Kirana" }),
  approve: vi.fn().mockResolvedValue({ id: "proposal-1", status: "approved", retailer: { id: "r1" } }),
  reject: vi.fn().mockResolvedValue({ id: "proposal-1", status: "rejected" }),
  updateAssigned: vi.fn().mockResolvedValue({ id: "r1", creditLimit: 50000, grade: "A" }),
};

function app(stepUpUntil?: Date, permissions = ["retailer.propose", "retailer.review", "order.create_for_retailer"]) {
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.use(createRetailerFormRouter({
    authenticate: (_req, _res, next) => {
      (_req as any).staffAuth = {
        staffId: "staff-1",
        permissions,
        sessionId: "session-1",
        delegationIds: [],
        stepUpUntil,
      };
      next();
    },
    service: service as any,
  }));
  return app;
}

describe("retailer form routes", () => {
  it("lists masters and accepts a full proposal payload", async () => {
    const masters = await request(app()).get("/retailer-masters");
    expect(masters.status).toBe(200);
    expect(masters.body.groups[0].name).toBe("Kirana Independent");

    const created = await request(app()).post("/retailer-proposals").send({ partyName: "Sharma Kirana" });
    expect(created.status).toBe(201);
    expect(service.propose).toHaveBeenCalledWith(
      { staffId: "staff-1", permissions: expect.any(Array) },
      expect.objectContaining({ partyName: "Sharma Kirana" })
    );
  });

  it("requires recent step-up before approving a proposal", async () => {
    const blocked = await request(app()).post("/retailer-proposals/proposal-1/approve").send({ reason: "Verified shop" });
    expect(blocked.status).toBe(403);
    expect(service.approve).not.toHaveBeenCalled();

    const approved = await request(app(new Date(Date.now() + 60_000)))
      .post("/retailer-proposals/proposal-1/approve")
      .send({ reason: "Verified shop" });
    expect(approved.status).toBe(200);
    expect(service.approve).toHaveBeenCalledWith(
      "proposal-1",
      expect.objectContaining({ reason: "Verified shop", stepUpUntil: expect.any(Date) })
    );
  });

  it("updates an assigned retailer profile including commercial fields", async () => {
    const updated = await request(app())
      .patch("/retailers/r1/profile")
      .send({ creditLimit: 50000, grade: "A", paymentTermDays: 21 });
    expect(updated.status).toBe(200);
    expect(service.updateAssigned).toHaveBeenCalledWith(
      "r1",
      { staffId: "staff-1", permissions: expect.any(Array) },
      expect.objectContaining({ creditLimit: 50000, grade: "A", paymentTermDays: 21 })
    );
  });
});
