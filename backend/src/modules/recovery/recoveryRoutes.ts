import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import type { StaffAuthedRequest } from "../identity/permissions";
import { RecoveryService, RecoveryServiceError } from "./recoveryService";

interface RecoveryRouterOptions {
  authenticate: RequestHandler;
  service?: RecoveryService;
}

const callSchema = z.object({
  outcome: z.enum(["no_answer", "spoke_with_customer", "promise_made", "dispute_raised", "wrong_number"]),
  notes: z.string().trim().min(3).max(1_000),
  occurredAt: z.string().datetime().optional(),
  nextActionAt: z.string().datetime().optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

const promiseSchema = z.object({
  amount: z.number().positive(),
  dueAt: z.string().datetime(),
  promisedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export function createRecoveryRouter(options: RecoveryRouterOptions) {
  const router = Router();
  const service = options.service ?? new RecoveryService();
  router.use(options.authenticate);

  router.get("/recovery", asyncRoute(async (req: StaffAuthedRequest, res) => {
    res.json({ cases: await service.list(req.staffAuth!.permissions) });
  }));

  router.get("/recovery/:caseId", asyncRoute(async (req: StaffAuthedRequest, res) => {
    res.json(await service.timeline(req.params.caseId, req.staffAuth!.permissions));
  }));

  router.post("/recovery/:caseId/calls", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const parsed = callSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
    const auth = req.staffAuth!;
    const call = await service.logCall({
      caseId: req.params.caseId,
      actorStaffId: auth.staffId,
      actorPermissions: auth.permissions,
      outcome: parsed.data.outcome,
      notes: parsed.data.notes,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
      nextActionAt: parsed.data.nextActionAt ? new Date(parsed.data.nextActionAt) : undefined,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    res.status(201).json({ call });
  }));

  router.post("/recovery/:caseId/promises", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const parsed = promiseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
    const auth = req.staffAuth!;
    const promise = await service.createPromise({
      caseId: req.params.caseId,
      actorStaffId: auth.staffId,
      actorPermissions: auth.permissions,
      amount: parsed.data.amount,
      dueAt: new Date(parsed.data.dueAt),
      promisedAt: parsed.data.promisedAt ? new Date(parsed.data.promisedAt) : undefined,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    res.status(201).json({ promise });
  }));

  router.post("/recovery/promises/:id/status", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const parsed = z.object({ status: z.enum(["kept", "missed"]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
    const auth = req.staffAuth!;
    const promise = await service.setPromiseStatus(req.params.id, parsed.data.status, { actorStaffId: auth.staffId, actorPermissions: auth.permissions });
    res.json({ promise });
  }));

  router.use((error: unknown, _req: unknown, res: any, next: (error?: unknown) => void) => {
    if (error instanceof RecoveryServiceError) return res.status(error.status).json({ error: error.code, details: error.details });
    next(error);
  });
  return router;
}
