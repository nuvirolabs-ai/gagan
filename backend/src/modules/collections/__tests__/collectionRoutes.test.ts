import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createCollectionRouter } from "../collectionRoutes";

const service = {
  listPending: vi.fn().mockResolvedValue([]),
  detail: vi.fn().mockResolvedValue({ id: "submission-1" }),
  submit: vi.fn().mockResolvedValue({ id: "submission-1", status: "pending" }),
  confirm: vi.fn().mockResolvedValue({ submissionId: "submission-1", paymentId: "payment-1" }),
  reject: vi.fn().mockResolvedValue({ id: "submission-1", status: "rejected" }),
};

function app(stepUpUntil?: Date) {
  const app = express();
  app.use(express.json());
  app.use(
    createCollectionRouter({
      authenticate: (_req, _res, next) => {
        (_req as any).staffAuth = {
          staffId: "staff-1",
          permissions: ["collection.submit", "collection.confirm"],
          sessionId: "session-1",
          delegationIds: [],
          stepUpUntil,
        };
        next();
      },
      service: service as any,
    })
  );
  return app;
}

describe("collection routes", () => {
  it("lets a collector submit evidence without step-up", async () => {
    const response = await request(app()).post("/collections").send({
      retailerId: "00000000-0000-0000-0000-000000000001",
      amount: 120,
      method: "cash",
      idempotencyKey: "receipt-1234",
      evidence: {
        contentType: "image/jpeg",
        bodyBase64: Buffer.from("receipt").toString("base64"),
      },
    });
    expect(response.status).toBe(201);
    expect(service.submit).toHaveBeenCalledWith(expect.objectContaining({
      collectorStaffId: "staff-1",
      amount: 120,
    }));
  });

  it("requires recent step-up before confirmation", async () => {
    const response = await request(app()).post("/collections/submission-1/confirm");
    expect(response.status).toBe(403);
    expect(service.confirm).not.toHaveBeenCalled();
  });

  it("rejects client-chosen storage keys", async () => {
    service.submit.mockClear();
    const response = await request(app()).post("/collections").send({
      retailerId: "00000000-0000-0000-0000-000000000001",
      amount: 120,
      method: "cash",
      idempotencyKey: "receipt-key-1",
      evidence: { objectKey: "receipts/unsafe.jpg", contentType: "image/jpeg", sizeBytes: 10, checksum: "sha256:unsafe" },
    });
    expect(response.status).toBe(400);
    expect(service.submit).not.toHaveBeenCalled();
  });

  it("passes the Accounts decision to the service after step-up", async () => {
    const response = await request(app(new Date(Date.now() + 60_000)))
      .post("/collections/submission-1/confirm");
    expect(response.status).toBe(200);
    expect(service.confirm).toHaveBeenCalledWith("submission-1", expect.objectContaining({
      actorStaffId: "staff-1",
      actorPermissions: ["collection.submit", "collection.confirm"],
    }));
  });
});
