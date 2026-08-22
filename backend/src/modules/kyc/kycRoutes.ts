import { KycDocumentType, KycReviewDecision } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requireRecentStepUp } from "../identity/sessionAuth";
import type { StaffAuthedRequest } from "../identity/permissions";
import { KycService, KycServiceError } from "./kycService";

const startSchema = z.object({ retailerId: z.string().uuid() });
const uploadSchema = z.object({
  type: z.nativeEnum(KycDocumentType),
  contentType: z.string().min(3),
  bodyBase64: z.string().min(4).max(14_000_000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
const reviewSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export function createKycRouter(options: { authenticate: RequestHandler; service?: KycService }) {
  const router = Router();
  let service: KycService | undefined = options.service;
  const getService = () => (service ??= new KycService());
  router.use(options.authenticate);

  router.get("/kyc/pending", asyncRoute(async (req: StaffAuthedRequest, res) => {
    res.json({ cases: await getService().listPending(req.staffAuth!.permissions) });
  }));

  router.post("/kyc", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
    const auth = req.staffAuth!;
    res.status(201).json({ kycCase: await getService().startCase(parsed.data.retailerId, auth.staffId, auth.permissions) });
  }));

  router.get("/kyc/:id", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const auth = req.staffAuth!;
    res.json({ kycCase: await getService().detail(req.params.id, auth.staffId, auth.permissions) });
  }));

  router.post("/kyc/:id/documents", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
    const auth = req.staffAuth!;
    const document = await getService().uploadDocument(req.params.id, { ...parsed.data, staffId: auth.staffId, permissions: auth.permissions });
    res.status(201).json({ document });
  }));

  router.post("/kyc/:id/submit", asyncRoute(async (req: StaffAuthedRequest, res) => {
    const auth = req.staffAuth!;
    res.json({ kycCase: await getService().submit(req.params.id, { staffId: auth.staffId, permissions: auth.permissions }) });
  }));

  router.post("/kyc/:id/approve", requireRecentStepUp, asyncRoute(async (req: StaffAuthedRequest, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
    const auth = req.staffAuth!;
    res.json({ kycCase: await getService().review(req.params.id, { ...parsed.data, decision: KycReviewDecision.approved, staffId: auth.staffId, permissions: auth.permissions, stepUpUntil: auth.stepUpUntil }) });
  }));

  router.post("/kyc/:id/reject", requireRecentStepUp, asyncRoute(async (req: StaffAuthedRequest, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
    const auth = req.staffAuth!;
    res.json({ kycCase: await getService().review(req.params.id, { ...parsed.data, decision: KycReviewDecision.rejected, staffId: auth.staffId, permissions: auth.permissions, stepUpUntil: auth.stepUpUntil }) });
  }));

  router.use((error: unknown, _req: unknown, res: any, next: (error?: unknown) => void) => {
    if (error instanceof KycServiceError) return res.status(error.status).json({ error: error.code, details: error.details });
    next(error);
  });
  return router;
}
