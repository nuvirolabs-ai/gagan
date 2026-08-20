import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { normalizeIndianPhone } from "../modules/identity/otpService";
import { lazyIdentityOtpService } from "../modules/identity/otpRuntime";
import { createOtpRouter } from "../modules/identity/otpRoutes";
import { createSessionRouter } from "../modules/identity/sessionRoutes";
import { lazyIdentitySessionService } from "../modules/identity/sessionRuntime";

const router = Router();

async function findRetailer(phoneInput: string) {
  const normalized = normalizeIndianPhone(phoneInput);
  return prisma.retailer.findFirst({
    where: { phone: { in: [normalized, normalized.slice(3)] } },
    select: { id: true, name: true, phone: true },
  });
}

router.use(
  createOtpRouter({
    realm: "retailer",
    otpService: lazyIdentityOtpService,
    findAccount: findRetailer,
    issueIdentity: async (retailer, req) => {
      const session = await lazyIdentitySessionService.createSession({
        realm: "retailer",
        subjectId: retailer.id,
        deviceName: req.header("x-device-name") ?? undefined,
        userAgent: req.header("user-agent") ?? undefined,
      });
      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        session: { id: session.session.id, expiresAt: session.session.expiresAt },
        retailer,
      };
    },
  })
);

router.use(
  createSessionRouter({
    realm: "retailer",
    sessions: lazyIdentitySessionService,
    otpService: lazyIdentityOtpService,
    resolvePhone: async (retailerId) => {
      const retailer = await prisma.retailer.findUniqueOrThrow({
        where: { id: retailerId },
        select: { phone: true },
      });
      return retailer.phone;
    },
  })
);

// Lets the app rebuild its session from a stored token on relaunch, instead of
// persisting retailer details client-side where they'd go stale.
router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const retailer = await prisma.retailer.findUnique({
    where: { id: req.retailerId },
    select: { id: true, name: true, phone: true },
  });
  if (!retailer) return res.status(401).json({ error: "Session no longer valid" });
  res.json({ retailer });
});

export default router;
