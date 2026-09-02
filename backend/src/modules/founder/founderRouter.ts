import { Router, type RequestHandler } from "express";
import { prisma } from "../../lib/prisma";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { normalizeIndianPhone } from "../identity/otpService";
import { lazyIdentityOtpService } from "../identity/otpRuntime";
import { createOtpRouter } from "../identity/otpRoutes";
import { createSessionRouter } from "../identity/sessionRoutes";
import { lazyIdentitySessionService } from "../identity/sessionRuntime";
import { createRequireSession, type IdentityAuthedRequest } from "../identity/sessionAuth";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { BriefService } from "./briefService";
import { DecisionsService, FounderDecisionError } from "./decisionsService";
import { IssuesService } from "./issuesService";
import { PulseService } from "./pulseService";
import { TeamService } from "./teamService";
import { TrendsService } from "./trendsService";

interface FounderRouterOptions {
  authenticate?: RequestHandler;
  pulseService?: PulseService;
  trendsService?: TrendsService;
  issuesService?: IssuesService;
  decisionsService?: DecisionsService;
  briefService?: BriefService;
  teamService?: TeamService;
}

async function findStaffAccount(phoneInput: string) {
  const normalized = normalizeIndianPhone(phoneInput);
  return prisma.staffUser.findFirst({
    where: {
      phone: { in: [normalized, normalized.slice(3)] },
      status: "active",
    },
    select: { id: true, name: true, phone: true, email: true },
  });
}

export function createFounderRouter(options: FounderRouterOptions = {}) {
  const router = Router();
  const pulseService = options.pulseService ?? new PulseService(prisma);
  const trendsService = options.trendsService ?? new TrendsService(prisma);
  const issuesService = options.issuesService ?? new IssuesService(prisma);
  const decisionsService = options.decisionsService ?? new DecisionsService(prisma);
  const briefService = options.briefService ?? new BriefService(prisma, pulseService);
  const teamService = options.teamService ?? new TeamService(prisma);
  const authenticate =
    options.authenticate ?? createRequireSession("staff", lazyIdentitySessionService);
  const requireFounderView = requirePermission(Permissions.FOUNDER_VIEW);
  const requireFounderDecide = requirePermission(Permissions.FOUNDER_DECIDE);

  router.use(
    "/auth",
    createOtpRouter({
      realm: "staff",
      otpService: lazyIdentityOtpService,
      findAccount: findStaffAccount,
      issueIdentity: async (staff, req) => {
        const session = await lazyIdentitySessionService.createSession({
          realm: "staff",
          subjectId: staff.id,
          deviceName: req.header("x-device-name") ?? undefined,
          userAgent: req.header("user-agent") ?? undefined,
        });
        const claims = lazyIdentitySessionService.verifyAccessToken(session.accessToken, "staff");
        return {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          session: { id: session.session.id, expiresAt: session.session.expiresAt },
          staff: {
            id: staff.id,
            name: staff.name,
            phone: staff.phone,
            email: staff.email,
            permissions: claims.permissions,
          },
        };
      },
    })
  );

  router.use(
    "/auth",
    createSessionRouter({
      realm: "staff",
      sessions: lazyIdentitySessionService,
      otpService: lazyIdentityOtpService,
      resolvePhone: async (staffId) => {
        const staff = await prisma.staffUser.findUniqueOrThrow({
          where: { id: staffId },
          select: { phone: true },
        });
        return staff.phone;
      },
    })
  );

  router.use(authenticate);

  router.get(
    "/me",
    requireFounderView,
    asyncRoute(async (req: IdentityAuthedRequest, res) => {
      const staff = await prisma.staffUser.findUnique({
        where: { id: req.staffAuth!.staffId },
        select: { id: true, name: true, phone: true, email: true },
      });
      res.json({
        staff,
        permissions: req.staffAuth!.permissions,
      });
    })
  );

  router.get(
    "/pulse",
    requireFounderView,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const staff = await prisma.staffUser.findUnique({
        where: { id: req.staffAuth!.staffId },
        select: { name: true },
      });
      const pulse = await pulseService.getPulse({
        staffId: req.staffAuth!.staffId,
        name: staff?.name ?? "there",
      });
      res.json(pulse);
    })
  );

  router.get(
    "/trends",
    requireFounderView,
    asyncRoute(async (req, res) => {
      const period = typeof req.query.period === "string" ? req.query.period : "30D";
      res.json(await trendsService.getTrends({ period }));
    })
  );

  router.get(
    "/issues",
    requireFounderView,
    asyncRoute(async (req, res) => {
      const status = typeof req.query.status === "string" ? req.query.status : "open";
      const issues = await issuesService.list({ status });
      res.json({ issues, status });
    })
  );

  router.get(
    "/issues/:id",
    requireFounderView,
    asyncRoute(async (req, res) => {
      const detail = await issuesService.detail(req.params.id);
      if (!detail) return res.status(404).json({ error: "issue_not_found" });
      res.json(detail);
    })
  );

  router.get(
    "/decisions",
    requireFounderView,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const segment = typeof req.query.segment === "string" ? req.query.segment : "open";
      res.json(
        await decisionsService.list({
          segment,
          permissions: req.staffAuth!.permissions,
        })
      );
    })
  );

  router.get(
    "/decisions/:id",
    requireFounderView,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      try {
        res.json(await decisionsService.detail(req.params.id, req.staffAuth!.permissions));
      } catch (error) {
        sendDecisionError(res, error);
      }
    })
  );

  router.post(
    "/decisions/:id/approve",
    requireFounderDecide,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      try {
        res.json(
          await decisionsService.decide({
            id: req.params.id,
            result: "approved",
            reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
            actorStaffId: req.staffAuth!.staffId,
            permissions: req.staffAuth!.permissions,
          })
        );
      } catch (error) {
        sendDecisionError(res, error);
      }
    })
  );

  router.post(
    "/decisions/:id/decline",
    requireFounderDecide,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      try {
        res.json(
          await decisionsService.decide({
            id: req.params.id,
            result: "rejected",
            reason: typeof req.body?.reason === "string" ? req.body.reason : "Declined by founder.",
            actorStaffId: req.staffAuth!.staffId,
            permissions: req.staffAuth!.permissions,
          })
        );
      } catch (error) {
        sendDecisionError(res, error);
      }
    })
  );

  router.post(
    "/decisions/:id/ask-owner",
    requireFounderDecide,
    asyncRoute(async (_req, res) => {
      try {
        decisionsService.askOwner();
      } catch (error) {
        sendDecisionError(res, error);
      }
    })
  );

  router.get(
    "/brief",
    requireFounderView,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const staff = await prisma.staffUser.findUnique({
        where: { id: req.staffAuth!.staffId },
        select: { name: true },
      });
      const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
      res.json(
        await briefService.getBrief({
          kind,
          staffId: req.staffAuth!.staffId,
          name: staff?.name ?? "there",
        })
      );
    })
  );

  router.get(
    "/team",
    requireFounderView,
    asyncRoute(async (_req, res) => {
      res.json(await teamService.getTeam());
    })
  );

  return router;
}

function sendDecisionError(res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown) {
  if (error instanceof FounderDecisionError) {
    res.status(error.status).json({ error: error.code, ...(error.details as object) });
    return;
  }
  throw error;
}
