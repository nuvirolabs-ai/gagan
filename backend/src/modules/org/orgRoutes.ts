import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { prisma } from "../../lib/prisma";
import { HierarchyError, HierarchyService, hierarchyService as defaultHierarchy } from "./hierarchyService";

function sendHierarchyError(error: unknown, res: any, next: any) {
  if (error instanceof HierarchyError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  return next(error);
}

/**
 * Administration of the reporting hierarchy.
 *
 * Reading the chart and changing it are separate permissions: plenty of people
 * need to see who reports to whom, far fewer should be able to move anybody.
 */
export function createOrgRouter(options: {
  authenticate: RequestHandler;
  hierarchy?: HierarchyService;
}) {
  const hierarchy = options.hierarchy ?? defaultHierarchy;
  const router = Router();
  router.use("/org", options.authenticate);

  router.get(
    "/org/tree",
    requirePermission(Permissions.ORG_VIEW_ALL),
    asyncRoute(async (_req, res) => {
      res.json({ nodes: await hierarchy.tree() });
    })
  );

  router.get(
    "/org/unassigned",
    requirePermission(Permissions.ORG_VIEW_ALL),
    asyncRoute(async (_req, res) => {
      res.json({ staff: await hierarchy.unassigned() });
    })
  );

  /** One employee's place in the chart: who they report to, who reports to them, and every past move. */
  router.get(
    "/org/staff/:id",
    requirePermission(Permissions.ORG_VIEW_ALL),
    asyncRoute(async (req, res) => {
      const staff = await prisma.staffUser.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, phone: true, status: true, managerId: true },
      });
      if (!staff) return res.status(404).json({ error: "staff_not_found" });

      const [chain, directReports, allReports, history] = await Promise.all([
        hierarchy.getManagementChain(staff.id),
        hierarchy.getDirectReports(staff.id),
        hierarchy.getAllReports(staff.id),
        hierarchy.managerHistory(staff.id),
      ]);

      res.json({
        staff,
        managementChain: chain,
        directReports,
        teamSize: allReports.length,
        history,
      });
    })
  );

  router.post(
    "/org/staff/:id/manager",
    requirePermission(Permissions.ORG_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          // Explicit null moves someone to the top of the tree, which is a
          // deliberate act and not the same as omitting the field.
          managerId: z.string().uuid().nullable(),
          reason: z.string().trim().max(300).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

      try {
        const result = await hierarchy.setManager({
          employeeId: req.params.id,
          managerId: parsed.data.managerId,
          actorStaffId: req.staffAuth!.staffId,
          reason: parsed.data.reason,
        });
        res.json(result);
      } catch (error) {
        sendHierarchyError(error, res, next);
      }
    })
  );

  /**
   * Who the caller may pick as a manager for this employee.
   *
   * The employee themselves and everyone beneath them are removed, so the admin
   * screen cannot offer a choice that the server would then reject as a cycle.
   */
  router.get(
    "/org/staff/:id/eligible-managers",
    requirePermission(Permissions.ORG_MANAGE),
    asyncRoute(async (req, res) => {
      const [candidates, descendants] = await Promise.all([
        prisma.staffUser.findMany({
          where: { status: "active" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        hierarchy.getAllReports(req.params.id),
      ]);
      const excluded = new Set([req.params.id, ...descendants.map((member) => member.id)]);
      res.json({ managers: candidates.filter((candidate) => !excluded.has(candidate.id)) });
    })
  );

  return router;
}
