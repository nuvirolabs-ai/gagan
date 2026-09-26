import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import { requireAdminIdentity } from "../../lib/adminAuth";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { createRateLimiter } from "../../platform/http/rateLimit";
import { FieldServiceError } from "../field/attendanceService";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { ScopeError, ScopeResolver, scopeResolver } from "../org/scope";
import { SalespersonFeedbackService, defaultSalespersonFeedbackService } from "./salespersonFeedbackService";

const submission = z.object({
  description: z.string().trim().min(3).max(1000),
  clientReference: z.string().min(1).max(120),
  expectedSalesRepId: z.string().min(1).max(120),
}).strict();

function cursorParam(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sendError(error: unknown, res: any, next: any) {
  if (error instanceof FieldServiceError || error instanceof ScopeError) return res.status(error.status).json({ error: error.code });
  return next(error);
}

export function createSalespersonFeedbackRouter(options: { authenticate?: RequestHandler; service?: SalespersonFeedbackService } = {}) {
  const router = Router();
  const service = options.service ?? defaultSalespersonFeedbackService;
  const authenticate = options.authenticate ?? requireAuth;
  router.get("/salesperson-feedback", authenticate, asyncRoute(async (req: AuthedRequest, res, next) => {
    const cursor = cursorParam(req.query.cursor);
    if (cursor === null) return res.status(400).json({ error: "invalid_feedback_cursor" });
    try {
      const [page, assignment] = await Promise.all([
        service.forRetailer(req.retailerId!, cursor),
        service.assignmentForRetailer(req.retailerId!),
      ]);
      res.json({ ...page, assignment });
    }
    catch (error) { sendError(error, res, next); }
  }));
  router.get("/salesperson-feedback/submissions/:clientReference", authenticate, asyncRoute(async (req: AuthedRequest, res, next) => {
    try { res.json({ feedback: await service.byClientReference(req.retailerId!, req.params.clientReference) }); }
    catch (error) { sendError(error, res, next); }
  }));
  router.post("/salesperson-feedback", authenticate, createRateLimiter({ name: "salesperson-feedback", limit: 10, windowMs: 60_000 }), asyncRoute(async (req: AuthedRequest, res, next) => {
    const parsed = submission.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
    try { res.status(201).json({ feedback: await service.submit({ retailerId: req.retailerId!, ...parsed.data }) }); }
    catch (error) { sendError(error, res, next); }
  }));
  return router;
}

export function createAdminSalespersonFeedbackRouter(options: { authenticate?: RequestHandler; service?: SalespersonFeedbackService; scopes?: ScopeResolver } = {}) {
  const router = Router();
  const service = options.service ?? defaultSalespersonFeedbackService;
  const scopes = options.scopes ?? scopeResolver;
  router.use(options.authenticate ?? requireAdminIdentity);
  router.get("/salesperson-feedback", requirePermission(Permissions.FEEDBACK_REVIEW), asyncRoute(async (req: StaffAuthedRequest, res, next) => {
    if (req.query.salespersonId !== undefined && (typeof req.query.salespersonId !== "string" || !req.query.salespersonId)) {
      return res.status(400).json({ error: "invalid_input" });
    }
    const cursor = cursorParam(req.query.cursor);
    if (cursor === null) return res.status(400).json({ error: "invalid_feedback_cursor" });
    try {
      const scope = await scopes.resolveFor(req.staffAuth!, req.query.salespersonId as string | undefined);
      res.json(await service.forAdmin(scope.staffIds, cursor));
    } catch (error) { sendError(error, res, next); }
  }));
  return router;
}
