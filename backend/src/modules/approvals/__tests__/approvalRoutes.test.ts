import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApprovalsRouter } from "../approvalRoutes";

const service = {
  list: vi.fn().mockResolvedValue([]),
  detail: vi.fn().mockResolvedValue({ id: "request-1" }),
  decide: vi.fn().mockResolvedValue({ id: "request-1", status: "approved" }),
};
const disputes = {
  raise: vi.fn().mockResolvedValue({ id: "dispute-1", status: "open" }),
  acknowledge: vi.fn(),
  submitCounterPosition: vi.fn(),
  resolve: vi.fn(),
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
      disputeService: disputes as any,
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

  it("requires a written position to open a dispute", async () => {
    expect((await request(app()).post("/approvals/request-1/disputes").send({})).status).toBe(400);
    const response = await request(app()).post("/approvals/request-1/disputes").send({
      writtenPosition: "Sales evidence supports a review.",
    });
    expect(response.status).toBe(201);
    expect(disputes.raise).toHaveBeenCalledWith(
      "request-1",
      expect.objectContaining({ actorStaffId: "staff-1", writtenPosition: "Sales evidence supports a review." })
    );
  });
});
