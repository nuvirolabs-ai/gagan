import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createRecoveryRouter } from "../recoveryRoutes";

const service = {
  list: vi.fn().mockResolvedValue([]),
  timeline: vi.fn().mockResolvedValue({ events: [] }),
  logCall: vi.fn().mockResolvedValue({ id: "call-1" }),
  createPromise: vi.fn().mockResolvedValue({ id: "promise-1", status: "promised" }),
  setPromiseStatus: vi.fn().mockResolvedValue({ id: "promise-1", status: "kept" }),
};

function app() {
  const app = express();
  app.use(express.json());
  app.use(createRecoveryRouter({
    authenticate: (req, _res, next) => {
      (req as any).staffAuth = { staffId: "staff-1", permissions: ["recovery.view", "recovery.update"], sessionId: "session-1", delegationIds: [] };
      next();
    },
    service: service as any,
  }));
  return app;
}

describe("recovery routes", () => {
  it("lists open cases for the recovery queue", async () => {
    const response = await request(app()).get("/recovery");
    expect(response.status).toBe(200);
    expect(response.body.cases).toEqual([]);
  });

  it("logs a call with the authenticated actor", async () => {
    const response = await request(app()).post("/recovery/case-1/calls").send({ outcome: "spoke_with_customer", notes: "Customer answered", idempotencyKey: "call-1234" });
    expect(response.status).toBe(201);
    expect(service.logCall).toHaveBeenCalledWith(expect.objectContaining({ caseId: "case-1", actorStaffId: "staff-1", outcome: "spoke_with_customer" }));
  });

  it("creates a promise and records status transitions", async () => {
    const response = await request(app()).post("/recovery/case-1/promises").send({ amount: 500, dueAt: "2026-08-30T00:00:00.000Z", idempotencyKey: "promise-1234" });
    expect(response.status).toBe(201);
    expect(service.createPromise).toHaveBeenCalledWith(expect.objectContaining({ caseId: "case-1", amount: 500 }));
    const status = await request(app()).post("/recovery/promises/promise-1/status").send({ status: "kept" });
    expect(status.status).toBe(200);
    expect(service.setPromiseStatus).toHaveBeenCalledWith("promise-1", "kept", expect.objectContaining({ actorStaffId: "staff-1" }));
  });
});
