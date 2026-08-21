import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createKycRouter } from "../kycRoutes";

const service = {
  startCase: vi.fn().mockResolvedValue({ id: "case-1", status: "draft" }),
  listPending: vi.fn().mockResolvedValue([]),
  detail: vi.fn().mockResolvedValue({ id: "case-1", status: "submitted" }),
  uploadDocument: vi.fn().mockResolvedValue({ id: "document-1" }),
  submit: vi.fn().mockResolvedValue({ id: "case-1", status: "submitted" }),
  review: vi.fn().mockResolvedValue({ id: "case-1", status: "approved" }),
};

function app(stepUpUntil?: Date) {
  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.use(createKycRouter({
    authenticate: (_req, _res, next) => {
      (_req as any).staffAuth = {
        staffId: "staff-1",
        permissions: ["kyc.submit", "kyc.view", "kyc.review"],
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

describe("KYC routes", () => {
  it("starts and submits a salesperson case", async () => {
    const started = await request(app()).post("/kyc").send({ retailerId: "00000000-0000-0000-0000-000000000001" });
    expect(started.status).toBe(201);
    expect(service.startCase).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001", "staff-1", expect.any(Array));

    const submitted = await request(app()).post("/kyc/case-1/submit");
    expect(submitted.status).toBe(200);
    expect(service.submit).toHaveBeenCalledWith("case-1", { staffId: "staff-1", permissions: expect.any(Array) });
  });

  it("requires recent step-up for admin review", async () => {
    const response = await request(app()).post("/kyc/case-1/approve").send({ reason: "Verified documents" });
    expect(response.status).toBe(403);
    expect(service.review).not.toHaveBeenCalled();

    const approved = await request(app(new Date(Date.now() + 60_000)))
      .post("/kyc/case-1/approve")
      .send({ reason: "Verified documents" });
    expect(approved.status).toBe(200);
    expect(service.review).toHaveBeenCalledWith("case-1", expect.objectContaining({ decision: "approved", stepUpUntil: expect.any(Date) }));
  });
});
