import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSalespersonFeedbackRouter, createAdminSalespersonFeedbackRouter } from "../salespersonFeedbackRoutes";

const service = { submit: vi.fn().mockResolvedValue({ id: "feedback-a" }), forRetailer: vi.fn().mockResolvedValue({ feedback: [], nextCursor: null }), forAdmin: vi.fn().mockResolvedValue({ feedback: [], nextCursor: null }), assignmentForRetailer: vi.fn().mockResolvedValue({ id: "rep-a", name: "Ravi" }), byClientReference: vi.fn().mockResolvedValue({ id: "feedback-a" }) } as any;
const authenticateRetailer = (req: any, _res: any, next: any) => { req.retailerId = "retailer-a"; next(); };
const authenticateAdmin = (req: any, _res: any, next: any) => { req.staffAuth = { staffId: "manager-a", permissions: ["feedback.review"] }; next(); };
const scopes = { resolveFor: vi.fn().mockResolvedValue({ staffIds: ["staff-a"] }) } as any;
function app(retailerAuth = authenticateRetailer, adminAuth = authenticateAdmin) {
  const instance = express();
  instance.use(express.json());
  instance.use(createSalespersonFeedbackRouter({ authenticate: retailerAuth, service }));
  instance.use("/admin", createAdminSalespersonFeedbackRouter({ authenticate: adminAuth, service, scopes }));
  return instance;
}

describe("salesperson feedback HTTP boundaries", () => {
  it("takes actor from retailer session and rejects a client-supplied subject or actor", async () => {
    service.submit.mockClear();
    await request(app()).post("/salesperson-feedback").send({ description: "Good visit", clientReference: "a", retailerId: "retailer-b" }).expect(400);
    await request(app()).post("/salesperson-feedback").send({ description: "Good visit", clientReference: "a", salespersonStaffId: "staff-b" }).expect(400);
    await request(app()).post("/salesperson-feedback").send({ description: "Good visit", clientReference: "a", expectedSalesRepId: "rep-a" }).expect(201);
    expect(service.submit).toHaveBeenCalledWith({ retailerId: "retailer-a", description: "Good visit", clientReference: "a", expectedSalesRepId: "rep-a" });
    await request(app()).post("/salesperson-feedback").send({ description: "Good visit", clientReference: "b" }).expect(400);
  });
  it("rejects anonymous access and exposes no public review route", async () => {
    const deny = (_req: any, res: any) => res.status(401).json({ error: "authentication_required" });
    await request(app(deny)).get("/salesperson-feedback").expect(401);
    await request(app(deny)).post("/salesperson-feedback").send({ description: "Good visit", clientReference: "a", expectedSalesRepId: "rep-a" }).expect(401);
    await request(app()).get("/salesperson-feedback/review").expect(404);
  });
  it("requires Admin permission and passes server-resolved staff scope", async () => {
    const noPermission = (req: any, _res: any, next: any) => { req.staffAuth = { staffId: "staff-b", permissions: ["issue.review"] }; next(); };
    await request(app(authenticateRetailer, noPermission)).get("/admin/salesperson-feedback").expect(403);
    service.forAdmin.mockClear();
    await request(app()).get("/admin/salesperson-feedback?salespersonId=staff-a").expect(200);
    expect(scopes.resolveFor).toHaveBeenCalledWith(expect.objectContaining({ staffId: "manager-a" }), "staff-a");
    expect(service.forAdmin).toHaveBeenCalledWith(["staff-a"], undefined);
  });

  it("returns assignment and owner-only exact-key reconciliation, with cursor validation", async () => {
    const result = await request(app()).get("/salesperson-feedback").expect(200);
    expect(result.body.assignment).toEqual({ id: "rep-a", name: "Ravi" });
    await request(app()).get("/salesperson-feedback/submissions/retry-a").expect(200);
    expect(service.byClientReference).toHaveBeenCalledWith("retailer-a", "retry-a");
    await request(app()).get("/salesperson-feedback?cursor=").expect(400);
  });
});
