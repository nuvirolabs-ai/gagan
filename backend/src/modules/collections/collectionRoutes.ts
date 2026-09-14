import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { invoiceBalances,CommercialError } from "../commercial/service";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requireRecentStepUp } from "../identity/sessionAuth";
import type { StaffAuthedRequest } from "../identity/permissions";
import {
  CollectionService,
  CollectionServiceError,
} from "./collectionService";

interface CollectionRouterOptions {
  authenticate: RequestHandler;
  service?: CollectionService;
}

const evidenceSchema = z.object({
  contentType: z.string().trim().min(3),
  bodyBase64: z.string().min(4).max(14_000_000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

const submitSchema = z.object({
  invoiceScopeId:z.string().uuid().optional(),
  jainAmount:z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  padamAmount:z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  retailerId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(["cash", "cheque", "neft", "upi"]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
  evidence: evidenceSchema.optional(),
});

export function createCollectionRouter(options: CollectionRouterOptions) {
  const router = Router();
  const service = options.service ?? new CollectionService();
  router.use(options.authenticate);
  router.get("/collections/invoices/:retailerId",asyncRoute(async(req:StaffAuthedRequest,res)=>{
    const auth=req.staffAuth!;
    if (!auth.permissions.includes("collection.submit") || !await prisma.collectionAssignment.findFirst({where:{collectorStaffId:auth.staffId,retailerId:req.params.retailerId,active:true}})) return res.status(403).json({error:"collection_assignment_required"});
    const invoices=await prisma.invoice.findMany({where:{retailerId:req.params.retailerId,outstandingAmount:{gt:0}},orderBy:{invoiceDate:"asc"}});
    const result=[];
    for(const invoice of invoices.filter(i=>i.commercialSnapshot!==null)) {
      const b=await prisma.$transaction(tx=>invoiceBalances(tx,invoice.id));
      result.push({id:invoice.id,invoiceNumber:invoice.invoiceNumber,jain:b.jain.toFixed(2),padam:b.padam.toFixed(2),total:invoice.outstandingAmount.toFixed(2)});
    }
    res.json({invoices:result});
  }));

  router.get(
    "/collections",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      res.json({ submissions: await service.listPending(req.staffAuth!.permissions) });
    })
  );

  router.get(
    "/collections/assigned-retailers",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const auth = req.staffAuth!;
      res.json({ retailers: await service.assignedRetailers(auth.staffId, auth.permissions) });
    })
  );

  router.post(
    "/collections/assignments",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z.object({ collectorStaffId: z.string().uuid(), retailerId: z.string().uuid() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const assignment = await service.assign({
        ...parsed.data,
        actorPermissions: req.staffAuth!.permissions,
      });
      res.status(201).json({ assignment });
    })
  );

  router.delete(
    "/collections/assignments/:id",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      res.json({ assignment: await service.unassign(req.params.id, req.staffAuth!.permissions) });
    })
  );

  router.get(
    "/collections/:id",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      res.json({ submission: await service.detail(req.params.id, req.staffAuth!.permissions) });
    })
  );

  router.post(
    "/collections",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
      const auth = req.staffAuth!;
      const submission = await service.submit({
        ...parsed.data,
        collectorStaffId: auth.staffId,
        actorPermissions: auth.permissions,
      });
      res.status(201).json({ submission });
    })
  );

  router.post(
    "/collections/:id/confirm",
    requireRecentStepUp,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const auth = req.staffAuth!;
      const result = await service.confirm(req.params.id, {
        actorStaffId: auth.staffId,
        actorPermissions: auth.permissions,
        stepUpUntil: auth.stepUpUntil,
      });
      res.json(result);
    })
  );

  router.post(
    "/collections/:id/reject",
    requireRecentStepUp,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z.object({ reason: z.string().trim().min(3).max(500) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const auth = req.staffAuth!;
      const submission = await service.reject(req.params.id, {
        actorStaffId: auth.staffId,
        actorPermissions: auth.permissions,
        stepUpUntil: auth.stepUpUntil,
        reason: parsed.data.reason,
      });
      res.json({ submission });
    })
  );

  router.use((error: unknown, _req: unknown, res: any, next: (error?: unknown) => void) => {
    if (error instanceof CommercialError) return res.status(error.status).json({error:error.code});
    if (error instanceof CollectionServiceError) {
      return res.status(error.status).json({ error: error.code, details: error.details });
    }
    next(error);
  });
  return router;
}
