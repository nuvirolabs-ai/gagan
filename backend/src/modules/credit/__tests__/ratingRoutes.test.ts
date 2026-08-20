import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createRatingRouter } from "../ratingRoutes";

const service = {
  listKycPending: vi.fn().mockResolvedValue([{ retailerId: "retailer-1" }]),
  confirmKyc: vi.fn().mockResolvedValue({ retailerId: "retailer-1", kycVerifiedAt: new Date() }),
  list: vi.fn().mockResolvedValue([]),
  confirm: vi.fn(),
};

function app(stepUpUntil?: Date) {
  const app = express();
  app.use(express.json());
  app.use(createRatingRouter({
    authenticate: (req, _res, next) => {
      (req as any).staffAuth = {
        staffId: "credit-lead-1",
        permissions: ["credit.rating_confirm"],
        delegationIds: [],
        sessionId: "session-1",
        stepUpUntil,
      };
      next();
    },
    service: service as any,
  }));
  return app;
}

describe("KYC confirmation routes", () => {
  it("lists pending profiles for the authorized Credit Lead", async () => {
    const response = await request(app()).get("/credit/kyc-pending");
    expect(response.status).toBe(200);
    expect(response.body.profiles).toEqual([{ retailerId: "retailer-1" }]);
  });

  it("requires step-up and records an evidence reference", async () => {
    const body = { evidenceReference: "KYC-CASE-100", reason: "Original documents verified" };
    expect((await request(app()).post("/credit/kyc/retailer-1/confirm").send(body)).status).toBe(403);
    const response = await request(app(new Date(Date.now() + 60_000)))
      .post("/credit/kyc/retailer-1/confirm")
      .send(body);
    expect(response.status).toBe(200);
    expect(service.confirmKyc).toHaveBeenCalledWith("retailer-1", {
      actorStaffId: "credit-lead-1",
      ...body,
    });
  });
});
