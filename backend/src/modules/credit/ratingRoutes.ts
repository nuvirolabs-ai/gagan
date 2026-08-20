import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission } from "../identity/permissions";
import { requireRecentStepUp } from "../identity/sessionAuth";
import type { StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { RatingService, RatingServiceError } from "./ratingService";

export function createRatingRouter(options: { authenticate: RequestHandler; service?: RatingService }) {
  const router = Router();
  const service = options.service ?? new RatingService();
  router.use(options.authenticate, requirePermission(Permissions.CREDIT_RATING_CONFIRM));
  router.get("/credit/rating-proposals", asyncRoute(async (_req, res) => {
    res.json({ proposals: await service.list() });
  }));
  router.post(
    "/credit/rating-proposals/:id/confirm",
    requireRecentStepUp,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z.object({ reason: z.string().trim().min(5) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      res.json({ proposal: await service.confirm(req.params.id, {
        actorStaffId: req.staffAuth!.staffId,
        reason: parsed.data.reason,
      }) });
    })
  );
  router.use((error: unknown, _req: unknown, res: any, next: (error?: unknown) => void) => {
    if (error instanceof RatingServiceError) return res.status(error.status).json({ error: error.code });
    next(error);
  });
  return router;
}
