import { Router, type RequestHandler } from "express";
import { ServiceIssueStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdminIdentity } from "../../lib/adminAuth";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { ScopeError, ScopeResolver, scopeResolver } from "../org/scope";
import { ExportError, ServiceIssueExportService, defaultServiceIssueExportService } from "./serviceIssueExportService";

const filtersSchema = z.object({
  status: z.nativeEnum(ServiceIssueStatus).optional(),
  retailerId: z.string().uuid().optional(),
  salespersonId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  through: z.string().date().optional(),
}).strict().refine((filters) => !filters.from || !filters.through || filters.from <= filters.through, {
  path: ["through"], message: "through_before_from",
});

export function createServiceIssueExportRouter(options: {
  authenticate?: RequestHandler;
  service?: ServiceIssueExportService;
  scopes?: ScopeResolver;
} = {}) {
  const router = Router();
  const service = options.service ?? defaultServiceIssueExportService;
  const scopes = options.scopes ?? scopeResolver;
  router.get("/exports/service-issues.xlsx", options.authenticate ?? requireAdminIdentity,
    requirePermission(Permissions.ISSUE_REVIEW), asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = filtersSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "invalid_export_filters" });
      try {
        const scope = await scopes.resolveFor(req.staffAuth!, parsed.data.salespersonId);
        const file = await service.excel({
          status: parsed.data.status, retailerId: parsed.data.retailerId, salespersonId: parsed.data.salespersonId,
          from: parsed.data.from, through: parsed.data.through, scopeStaffIds: scope.staffIds,
        });
        res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Disposition", 'attachment; filename="gagan-service-issues.xlsx"');
        res.send(file);
      } catch (error) {
        if (error instanceof ScopeError || error instanceof ExportError) {
          return res.status(error.status).json({ error: error.code });
        }
        next(error);
      }
    }));
  return router;
}
