import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createLocationRouter } from "../locationRoutes";

const service = {
  getLocation: vi.fn().mockResolvedValue({ status: "NOT_SET" }),
  captureLocation: vi.fn().mockResolvedValue({ status: "CAPTURED" }),
  requestLocationChange: vi.fn().mockResolvedValue({ status: "NEEDS_REVIEW" }),
  verifyLocation: vi.fn().mockResolvedValue({ status: "VERIFIED" }),
  checkIn: vi.fn().mockResolvedValue({ id: "visit-1", verificationStatus: "VERIFIED" }),
  checkOut: vi.fn().mockResolvedValue({ id: "visit-1" }),
  listVisits: vi.fn().mockResolvedValue([]),
  history: vi.fn().mockResolvedValue([]),
  correctLocation: vi.fn().mockResolvedValue({ status: "NEEDS_REVIEW" }),
  assertAssignedSalesperson: vi.fn().mockResolvedValue(undefined),
};

function app() {
  const app = express();
  app.use(express.json());
  app.use(createLocationRouter({
    service: service as any,
    retailerAuthenticate: (req: any, _res: any, next: any) => { req.retailerId = "retailer-1"; next(); },
    staffAuthenticate: (req: any, _res: any, next: any) => { req.identityAuth = { subjectId: "staff-1" }; req.staffAuth = { staffId: "staff-1", permissions: ["location.capture", "location.verify", "visit.view"] }; next(); },
    adminAuthenticate: (req: any, _res: any, next: any) => { req.staffAuth = { staffId: "admin-1", permissions: ["location.view", "location.capture", "location.verify", "visit.view"] }; next(); },
  }));
  return app;
}

describe("location routes", () => {
  it("validates coordinates before invoking the service", async () => {
    const response = await request(app()).post("/location/capture").send({ latitude: 999, longitude: 1, accuracyMeters: 10 });
    expect(response.status).toBe(400);
    expect(service.captureLocation).not.toHaveBeenCalled();
  });

  it("captures a retailer location only after the authenticated retailer is resolved", async () => {
    const response = await request(app()).post("/location/capture").send({ latitude: 18.52, longitude: 73.85, accuracyMeters: 10 });
    expect(response.status).toBe(201);
    expect(service.captureLocation).toHaveBeenCalledWith(expect.objectContaining({ retailerId: "retailer-1", actorUserId: "retailer-1", source: "RETAILER_ONBOARDING" }));
  });

  it("uses the staff identity for assigned-retailer check-in", async () => {
    const response = await request(app()).post("/rep/retailers/retailer-1/check-in").send({ latitude: 18.52, longitude: 73.85, accuracyMeters: 10 });
    expect(response.status).toBe(201);
    expect(service.checkIn).toHaveBeenCalledWith(expect.objectContaining({ retailerId: "retailer-1", salespersonId: "staff-1" }));
  });

  it("requires a reason for admin corrections", async () => {
    const response = await request(app()).post("/admin/locations/retailer-1/correct").send({ latitude: 18.52, longitude: 73.85, accuracyMeters: 10 });
    expect(response.status).toBe(400);
    expect(service.correctLocation).not.toHaveBeenCalled();
  });
});
