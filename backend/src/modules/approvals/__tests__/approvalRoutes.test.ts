import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApprovalsRouter } from "../approvalRoutes";

const service = {
  list: vi.fn().mockResolvedValue([]),
  detail: vi.fn().mockResolvedValue({ id: "request-1" }),
  decide: vi.fn().mockResolvedValue({ id: "request-1", status: "approved" }),
};

function app(stepUpUntil?: Date) {
  const app = express();
  app.use(express.json());
  app.use(
    createApprovalsRouter({
      authenticate: (req, _res, next) => {
        (req as any).staffAuth = {
          staffId: "staff-1",
          permissions: ["approval.second_invoice"],
          delegationIds: [],
          sessionId: "session-1",
          stepUpUntil,
        };
        next();
      },
      service: service as any,
    })
  );
  return app;
}

describe("approval routes", () => {
  it("allows a shared queue read without step-up", async () => {
    expect((await request(app()).get("/approvals")).status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(["approval.second_invoice"]);
  });

  it("requires recent step-up for a decision", async () => {
    const response = await request(app()).post("/approvals/request-1/decision").send({
      result: "approved",
      reason: "Within policy",
    });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "step_up_required" });
  });

  it("requires a rejection reason", async () => {
    const response = await request(app(new Date(Date.now() + 60_000)))
      .post("/approvals/request-1/decision")
      .send({ result: "rejected" });
    expect(response.status).toBe(400);
    expect(service.decide).not.toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ result: "rejected" })
    );
  });
});
