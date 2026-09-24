import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createRetailerServiceRequestRouter } from "../serviceRequests";

const service = {
  retailerRequests: vi.fn().mockResolvedValue([]),
  raiseRetailerRequest: vi.fn().mockResolvedValue({ id: "request-1", status: "open" }),
  withdrawRetailerRequest: vi.fn().mockResolvedValue({ id: "request-1", status: "withdrawn" }),
} as any;

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(createRetailerServiceRequestRouter({
    authenticate: (req, _res, next) => { (req as any).retailerId = "authenticated-retailer"; next(); },
    service,
  }));
  return instance;
}

describe("retailer service request HTTP boundary", () => {
  it("uses authenticated retailer identity, never a client-supplied owner", async () => {
    service.raiseRetailerRequest.mockClear();
    await request(app()).post("/service-requests").send({ description: "Please call me", clientReference: "request-a", retailerId: "other" }).expect(400);
    await request(app()).post("/service-requests").send({ description: "Please call me", clientReference: "request-a" }).expect(201);
    expect(service.raiseRetailerRequest).toHaveBeenCalledWith({ retailerId: "authenticated-retailer", description: "Please call me", clientReference: "request-a" });
  });
  it("scopes list and withdrawal to the same authenticated retailer", async () => {
    await request(app()).get("/service-requests").expect(200);
    expect(service.retailerRequests).toHaveBeenCalledWith("authenticated-retailer");
    await request(app()).post("/service-requests/request-1/withdraw").expect(200);
    expect(service.withdrawRetailerRequest).toHaveBeenCalledWith("request-1", "authenticated-retailer");
  });
});
