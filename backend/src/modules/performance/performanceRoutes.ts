import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { ScopeError, ScopeResolver, scopeResolver as defaultScopeResolver } from "../org/scope";
import { HierarchyService, hierarchyService as defaultHierarchy } from "../org/hierarchyService";
import { prisma } from "../../lib/prisma";
import { TargetService, currentMonth, defaultTargetService } from "./targetService";
import { AchievementService, defaultAchievementService } from "./achievementService";
import { RankingService, defaultRankingService } from "./rankingService";
import { OpportunityService, defaultOpportunityService } from "../intelligence/opportunityService";
import {
  SalespersonTodayService,
  defaultSalespersonTodayService,
} from "../readmodels/salespersonTodayService";
import { SalesLeaderService, defaultSalesLeaderService } from "../readmodels/salesLeaderService";
import { remainingSentence } from "./targetDomain";

export interface PerformanceServices {
  targets: TargetService;
  achievements: AchievementService;
  ranking: RankingService;
  opportunities: OpportunityService;
  today: SalespersonTodayService;
  leader: SalesLeaderService;
}

export const defaultPerformanceServices: PerformanceServices = {
  targets: defaultTargetService,
  achievements: defaultAchievementService,
  ranking: defaultRankingService,
  opportunities: defaultOpportunityService,
  today: defaultSalespersonTodayService,
  leader: defaultSalesLeaderService,
};

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value);
}

/**
 * A salesperson's own performance. Every route here reads
 * `req.staffAuth.staffId`; none accepts a salesperson id, so there is no
 * parameter through which one salesperson could ask for another's numbers.
 */
export function createPerformanceRouter(options: {
  authenticate: RequestHandler;
  services?: Partial<PerformanceServices>;
}) {
  const services = { ...defaultPerformanceServices, ...options.services };
  const router = Router();
  router.use("/performance", options.authenticate);
  router.use("/intelligence", options.authenticate);

  router.get(
    "/performance/targets",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const now = parseDate(req.query.now) ?? new Date();
      const period = currentMonth(now);
      const progress = await services.targets.progressFor({
        salespersonId: req.staffAuth!.staffId,
        period,
        now,
      });
      res.json({
        period: {
          from: period.from.toISOString().slice(0, 10),
          to: period.to.toISOString().slice(0, 10),
        },
        targets: progress.map((entry) => ({ ...entry, sentence: remainingSentence(entry) })),
        headline: TargetService.headline(progress),
      });
    })
  );

  router.get(
    "/performance/ranking",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      res.json(
        await services.ranking.standingFor({
          salespersonId: req.staffAuth!.staffId,
          now: parseDate(req.query.now),
        })
      );
    })
  );

  router.get(
    "/performance/achievements",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      res.json({
        achievements: await services.achievements.recent({
          subject: { kind: "salesperson", id: req.staffAuth!.staffId },
          limit: 20,
        }),
      });
    })
  );

  router.get(
    "/intelligence/opportunities",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const limit = Number(req.query.limit);
      res.json(
        await services.opportunities.forSalesperson({
          salespersonId: req.staffAuth!.staffId,
          limit: Number.isFinite(limit) && limit > 0 ? Math.min(50, limit) : 20,
        })
      );
    })
  );

  router.get(
    "/intelligence/retailers/:retailerId/baseline",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      // A salesperson may only profile a store on their own book.
      const assigned = await servicesRetailerIsAssigned(req.staffAuth!.staffId, req.params.retailerId);
      if (!assigned) return res.status(404).json({ error: "retailer_not_assigned" });
      res.json({
        baseline: await services.opportunities.baselineForRetailer({
          retailerId: req.params.retailerId,
        }),
      });
    })
  );

  return router;
}

/** Kept out of the service so the assignment rule stays one query in one place. */
async function servicesRetailerIsAssigned(staffId: string, retailerId: string): Promise<boolean> {
  const { prisma } = await import("../../lib/prisma");
  const [staff, retailer] = await Promise.all([
    prisma.staffUser.findUnique({ where: { id: staffId }, select: { salesRepId: true } }),
    prisma.retailer.findUnique({ where: { id: retailerId }, select: { salesRepId: true } }),
  ]);
  return Boolean(staff?.salesRepId && retailer?.salesRepId && staff.salesRepId === retailer.salesRepId);
}

/**
 * The sales leader's team view. Guarded by a permission the field roles do not
 * hold, so a salesperson cannot read their colleagues' numbers.
 */
export function createSalesLeaderRouter(options: {
  authenticate: RequestHandler;
  services?: Partial<PerformanceServices>;
  scopes?: ScopeResolver;
  hierarchy?: HierarchyService;
}) {
  const services = { ...defaultPerformanceServices, ...options.services };
  const scopes = options.scopes ?? defaultScopeResolver;
  const hierarchy = options.hierarchy ?? defaultHierarchy;
  const router = Router();
  router.use("/sales-leader", options.authenticate);

  const sendError = (error: unknown, res: any) => {
    if (error instanceof ScopeError) return res.status(error.status).json({ error: error.code });
    throw error;
  };

  router.get(
    "/sales-leader",
    requirePermission(Permissions.PERFORMANCE_VIEW_TEAM),
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      try {
        // The team is derived from the caller's own reporting tree. A
        // salespersonId on the query string narrows within it and can never
        // reach outside it.
        const scope = await scopes.resolveFor(
          req.staffAuth!,
          typeof req.query.salespersonId === "string" ? req.query.salespersonId : undefined
        );
        res.json(
          await services.leader.load({
            scopeStaffIds: scope.staffIds,
            managerStaffId: req.staffAuth!.staffId,
            now: parseDate(req.query.now),
          })
        );
      } catch (error) {
        sendError(error, res);
      }
    })
  );

  /**
   * Opportunities across a manager's tree.
   *
   * Three views of the same computed triggers — nothing is stored, so this is
   * not a second copy of what the salespeople see:
   *
   *   team    (default) the caller's whole reporting tree
   *   direct  only their direct reports
   *   person  one named employee, who must be inside the tree
   */
  router.get(
    "/sales-leader/opportunities",
    requirePermission(Permissions.PERFORMANCE_VIEW_TEAM),
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z
        .object({
          view: z.enum(["team", "direct", "person"]).default("team"),
          salespersonId: z.string().uuid().optional(),
          limit: z.coerce.number().int().min(1).max(50).default(20),
        })
        .safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

      try {
        const scope = await scopes.resolve(req.staffAuth!);
        let staffIds: string[];

        if (parsed.data.view === "person") {
          if (!parsed.data.salespersonId) return res.status(400).json({ error: "invalid_input" });
          const narrowed = await scopes.resolveFor(req.staffAuth!, parsed.data.salespersonId);
          staffIds = narrowed.staffIds ?? [parsed.data.salespersonId];
        } else if (parsed.data.view === "direct") {
          const reports = await hierarchy.getDirectReports(req.staffAuth!.staffId);
          staffIds = reports.filter((report) => report.status === "active").map((report) => report.id);
        } else {
          // An org-wide reader has no tree of their own, so "my team" for them
          // is every active salesperson rather than an empty list.
          staffIds =
            scope.staffIds ??
            (
              await prisma.staffUser.findMany({
                where: { status: "active", salesRepId: { not: null } },
                select: { id: true },
              })
            ).map((row) => row.id);
        }

        res.json({
          view: parsed.data.view,
          salespeople: staffIds.length,
          ...(await services.opportunities.forTeam({
            staffIds,
            limit: parsed.data.limit,
            now: parseDate(req.query.now),
          })),
        });
      } catch (error) {
        sendError(error, res);
      }
    })
  );

  router.get(
    "/sales-leader/ranking",
    requirePermission(Permissions.PERFORMANCE_VIEW_TEAM),
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z
        .object({
          scope: z.enum(["team", "territory", "company"]).default("team"),
          territory: z.string().trim().max(120).optional(),
        })
        .safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const scope = await scopes.resolve(req.staffAuth!);
      // A company-wide ranking is only available to an org-wide reader. Asking
      // for one without that permission returns the caller's own tree, labelled
      // as their team — the request is narrowed rather than silently answered
      // with data they may not see.
      const requested = scope.staffIds === null ? parsed.data.scope : "team";
      res.json(
        await services.ranking.rank({
          scope: requested,
          territory: parsed.data.territory ?? null,
          staffIds: scope.staffIds,
          now: parseDate(req.query.now),
        })
      );
    })
  );

  return router;
}
