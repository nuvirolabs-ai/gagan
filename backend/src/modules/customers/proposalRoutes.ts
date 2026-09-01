import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { ScopeError, ScopeResolver, scopeResolver as defaultScopeResolver } from "../org/scope";
import {
  ProposalError,
  RetailerProposalService,
  defaultRetailerProposalService,
} from "./retailerProposalService";

function sendProposalError(error: unknown, res: any, next: any) {
  if (error instanceof ProposalError) {
    return res.status(error.status).json({ error: error.code, details: error.details });
  }
  return next(error);
}

const submitSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  ownerName: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(10).max(20),
  shopAddress: z.string().trim().min(4).max(400),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  accuracyMeters: z.number().finite().positive().optional(),
  proposedTierId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** What a salesperson can do: put a store forward and watch what happens to it. */
export function createRetailerProposalRouter(options: {
  authenticate: RequestHandler;
  service?: RetailerProposalService;
}) {
  const service = options.service ?? defaultRetailerProposalService;
  const router = Router();
  router.use("/retailer-proposals", options.authenticate);

  router.get(
    "/retailer-proposals",
    requirePermission(Permissions.RETAILER_PROPOSE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({ proposals: await service.listForSalesperson(req.staffAuth!.staffId) });
      } catch (error) {
        sendProposalError(error, res, next);
      }
    })
  );

  router.post(
    "/retailer-proposals",
    requirePermission(Permissions.RETAILER_PROPOSE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        const proposal = await service.submit({
          ...parsed.data,
          submittedByStaffId: req.staffAuth!.staffId,
        });
        res.status(201).json({ proposal });
      } catch (error) {
        sendProposalError(error, res, next);
      }
    })
  );

  router.post(
    "/retailer-proposals/:id/withdraw",
    requirePermission(Permissions.RETAILER_PROPOSE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          proposal: await service.withdraw({
            proposalId: req.params.id,
            salespersonId: req.staffAuth!.staffId,
          }),
        });
      } catch (error) {
        sendProposalError(error, res, next);
      }
    })
  );

  return router;
}

/**
 * The review side. The permission this needs is deliberately not held by any
 * field role, so admitting a store to the customer master can never be done by
 * the person who proposed it.
 */
export function createRetailerProposalAdminRouter(options: {
  authenticate: RequestHandler;
  service?: RetailerProposalService;
  scopes?: ScopeResolver;
}) {
  const service = options.service ?? defaultRetailerProposalService;
  const scopes = options.scopes ?? defaultScopeResolver;
  const router = Router();
  router.use("/retailer-proposals", options.authenticate);

  const scopeOf = async (req: StaffAuthedRequest) => (await scopes.resolve(req.staffAuth!)).staffIds;

  const sendError = (error: unknown, res: any, next: any) => {
    if (error instanceof ScopeError) return res.status(error.status).json({ error: error.code });
    return sendProposalError(error, res, next);
  };

  router.get(
    "/retailer-proposals",
    requirePermission(Permissions.RETAILER_PROPOSAL_REVIEW),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          proposals: await service.listForReview({
            status: typeof req.query.status === "string" ? req.query.status : undefined,
            scopeStaffIds: await scopeOf(req),
          }),
        });
      } catch (error) {
        sendError(error, res, next);
      }
    })
  );

  router.post(
    "/retailer-proposals/:id/approve",
    requirePermission(Permissions.RETAILER_PROPOSAL_REVIEW),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z.object({ tierId: z.string().uuid().optional() }).safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        res.json(
          await service.approve({
            proposalId: req.params.id,
            reviewerStaffId: req.staffAuth!.staffId,
            tierId: parsed.data.tierId,
            scopeStaffIds: await scopeOf(req),
          })
        );
      } catch (error) {
        sendError(error, res, next);
      }
    })
  );

  router.post(
    "/retailer-proposals/:id/reject",
    requirePermission(Permissions.RETAILER_PROPOSAL_REVIEW),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z.object({ reason: z.string().trim().min(3).max(500) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "rejection_reason_required" });
      try {
        res.json({
          proposal: await service.reject({
            proposalId: req.params.id,
            reviewerStaffId: req.staffAuth!.staffId,
            reason: parsed.data.reason,
            scopeStaffIds: await scopeOf(req),
          }),
        });
      } catch (error) {
        sendError(error, res, next);
      }
    })
  );

  return router;
}
