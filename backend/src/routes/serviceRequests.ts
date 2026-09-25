import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { asyncRoute } from "../platform/http/asyncRoute";
import { createRateLimiter } from "../platform/http/rateLimit";
import { FieldServiceError } from "../modules/field/attendanceService";
import { defaultIssueService, type IssueService } from "../modules/field/issueService";

export function createRetailerServiceRequestRouter(options: { authenticate?: RequestHandler; service?: IssueService } = {}) {
  const router = Router();
  const authenticate = options.authenticate ?? requireAuth;
  const service = options.service ?? defaultIssueService;
  const handle = (error: unknown, res: any, next: any) =>
    error instanceof FieldServiceError ? res.status(error.status).json({ error: error.code }) : next(error);

  router.get("/service-requests", authenticate, asyncRoute(async (req: AuthedRequest, res, next) => {
    try { res.json({ requests: await service.retailerRequests(req.retailerId!) }); }
    catch (error) { handle(error, res, next); }
  }));

  router.post("/service-requests", authenticate, createRateLimiter({ name: "retailer-service-request", limit: 10, windowMs: 60_000 }), asyncRoute(async (req: AuthedRequest, res, next) => {
    const parsed = z.object({ description: z.string().trim().min(3).max(1000), clientReference: z.string().min(1).max(120) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
    try { res.status(201).json({ request: await service.raiseRetailerRequest({ retailerId: req.retailerId!, ...parsed.data }) }); }
    catch (error) { handle(error, res, next); }
  }));

  router.post("/service-requests/:id/withdraw", authenticate, asyncRoute(async (req: AuthedRequest, res, next) => {
    try { res.json({ request: await service.withdrawRetailerRequest(req.params.id, req.retailerId!) }); }
    catch (error) { handle(error, res, next); }
  }));

  return router;
}
