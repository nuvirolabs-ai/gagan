import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
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
}) {
  const services = { ...defaultPerformanceServices, ...options.services };
  const router = Router();
  router.use("/sales-leader", options.authenticate);

  router.get(
    "/sales-leader",
    requirePermission(Permissions.PERFORMANCE_VIEW_TEAM),
    asyncRoute(async (req, res) => {
      const territory =
        typeof req.query.territory === "string" && req.query.territory.trim().length > 0
          ? req.query.territory
          : null;
      res.json(await services.leader.load({ territory, now: parseDate(req.query.now) }));
    })
  );

  router.get(
    "/sales-leader/ranking",
    requirePermission(Permissions.PERFORMANCE_VIEW_TEAM),
    asyncRoute(async (req, res) => {
      const parsed = z
        .object({
          scope: z.enum(["territory", "company"]).default("company"),
          territory: z.string().trim().max(120).optional(),
        })
        .safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      res.json(
        await services.ranking.rank({
          scope: parsed.data.scope,
          territory: parsed.data.territory ?? null,
          now: parseDate(req.query.now),
        })
      );
    })
  );

  return router;
}
