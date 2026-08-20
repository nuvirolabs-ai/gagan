import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requireRecentStepUp } from "../identity/sessionAuth";
import type { StaffAuthedRequest } from "../identity/permissions";
import { ApprovalService, ApprovalServiceError } from "./approvalService";

interface ApprovalRouterOptions {
  authenticate: RequestHandler;
  service?: ApprovalService;
}

const decisionSchema = z.discriminatedUnion("result", [
  z.object({ result: z.literal("approved"), reason: z.string().trim().min(3).optional() }),
  z.object({ result: z.literal("rejected"), reason: z.string().trim().min(3) }),
]);

export function createApprovalsRouter(options: ApprovalRouterOptions) {
  const router = Router();
  const service = options.service ?? new ApprovalService();
  router.use(options.authenticate);

  router.get(
    "/approvals",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      res.json({ requests: await service.list(req.staffAuth!.permissions) });
    })
  );

  router.get(
    "/approvals/:id",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      res.json({ request: await service.detail(req.params.id, req.staffAuth!.permissions) });
    })
  );

  router.post(
    "/approvals/:id/decision",
    requireRecentStepUp,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const auth = req.staffAuth!;
      res.json({
        request: await service.decide(req.params.id, {
          actorStaffId: auth.staffId,
          actorPermissions: auth.permissions,
          stepUpSessionId: auth.sessionId,
          ...parsed.data,
        }),
      });
    })
  );

  router.use((error: unknown, _req: unknown, res: any, next: (error?: unknown) => void) => {
    if (error instanceof ApprovalServiceError) {
      return res.status(error.status).json({ error: error.code, details: error.details });
    }
    next(error);
  });
  return router;
}
