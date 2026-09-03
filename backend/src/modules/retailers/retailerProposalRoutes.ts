import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requireRecentStepUp } from "../identity/sessionAuth";
import type { StaffAuthedRequest } from "../identity/permissions";
import { RetailerFormError, RetailerFormService } from "./retailerProposalService";

const uploadSchema = z.object({
  contentType: z.string().min(3),
  bodyBase64: z.string().min(4).max(14_000_000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

const reviewSchema = z.object({ reason: z.string().trim().min(5).max(500).optional() });
const rejectSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export function createRetailerFormRouter(options: {
  authenticate: RequestHandler;
  service?: RetailerFormService;
}) {
  const router = Router();
  let service: RetailerFormService | undefined = options.service;
  const getService = () => (service ??= new RetailerFormService());
  router.use(options.authenticate);

  router.get("/retailer-masters", asyncRoute(async (_req, res) => {
    res.json(await getService().masters());
  }));

  router.post("/retailer-evidence/aadhaar", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
    const auth = req.staffAuth!;
    const asset = await getService().uploadAadhaar({ staffId: auth.staffId, permissions: auth.permissions }, parsed.data);
    res.status(201).json({ asset });
  }));

  router.get("/retailer-proposals", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const auth = req.staffAuth!;
    res.json({ proposals: await getService().listProposals({ staffId: auth.staffId, permissions: auth.permissions }) });
  }));

  router.post("/retailer-proposals", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const auth = req.staffAuth!;
    const proposal = await getService().propose({ staffId: auth.staffId, permissions: auth.permissions }, req.body);
    res.status(201).json({ proposal });
  }));

  router.get("/retailer-proposals/:id", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const auth = req.staffAuth!;
    res.json({ proposal: await getService().detail(req.params.id, { staffId: auth.staffId, permissions: auth.permissions }) });
  }));

  router.post(
    "/retailer-proposals/:id/approve",
    requireRecentStepUp,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = reviewSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const auth = req.staffAuth!;
      const proposal = await getService().approve(req.params.id, {
        staffId: auth.staffId,
        permissions: auth.permissions,
        reason: parsed.data.reason,
        stepUpUntil: auth.stepUpUntil,
      });
      res.json({ proposal });
    })
  );

  router.post(
    "/retailer-proposals/:id/reject",
    requireRecentStepUp,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const auth = req.staffAuth!;
      const proposal = await getService().reject(req.params.id, {
        staffId: auth.staffId,
        permissions: auth.permissions,
        reason: parsed.data.reason,
        stepUpUntil: auth.stepUpUntil,
      });
      res.json({ proposal });
    })
  );

  router.patch("/retailers/:id/profile", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const auth = req.staffAuth!;
    const retailer = await getService().updateAssigned(req.params.id, { staffId: auth.staffId, permissions: auth.permissions }, req.body);
    res.json({ retailer });
  }));

  router.use((error: unknown, _req: unknown, res: any, next: (error?: unknown) => void) => {
    if (error instanceof RetailerFormError) return res.status(error.status).json({ error: error.code, details: error.details });
    next(error);
  });

  return router;
}
