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
import { PulseService } from "./pulseService";

interface FounderRouterOptions {
  authenticate?: RequestHandler;
  pulseService?: PulseService;
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
  const authenticate =
    options.authenticate ?? createRequireSession("staff", lazyIdentitySessionService);
  const requireFounderView = requirePermission(Permissions.FOUNDER_VIEW);

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

  return router;
}
