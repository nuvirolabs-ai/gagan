import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { normalizeIndianPhone } from "../modules/identity/otpService";
import { lazyIdentityOtpService } from "../modules/identity/otpRuntime";
import { createOtpRouter } from "../modules/identity/otpRoutes";
import { createSessionRouter } from "../modules/identity/sessionRoutes";
import { lazyIdentitySessionService } from "../modules/identity/sessionRuntime";
import { Msg91Error, verifyMsg91AccessToken } from "../modules/identity/msg91Service";

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

async function autoProvisionRetailer(phoneInput: string) {
  const normalized = normalizeIndianPhone(phoneInput);
  const plainDigits = normalized.slice(3);

  const existing = await findRetailer(phoneInput);
  if (existing) return existing;

  let tier = await prisma.tier.findFirst({ orderBy: { name: "asc" } });
  if (!tier) {
    tier = await prisma.tier.create({
      data: { name: "Standard Retailer" },
    });
  }

  const salesRep =
    (await prisma.salesRep.findFirst({ where: { id: "rep-vikram-singh-01" } })) ||
    (await prisma.salesRep.findFirst());

  return prisma.retailer.create({
    data: {
      name: `Gagan Partner Store (${plainDigits.slice(-4)})`,
      ownerName: "Verified Store Partner",
      phone: plainDigits,
      shopAddress: "Main Market, Vijay Nagar, Indore",
      deliveryCity: "Indore",
      status: "active",
      tierId: tier.id,
      creditLimit: 100000,
      salesRepId: salesRep?.id,
    },
    select: { id: true, name: true, phone: true },
  });
}

router.post("/msg91/verify", async (req, res) => {
  const token = req.body.accessToken || req.body["access-token"] || req.body.token;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "missing_token", message: "MSG91 access token is required" });
  }

  try {
    const { phone } = await verifyMsg91AccessToken({
      accessToken: token,
      expectedPhone: req.body.phone,
    });

    let retailer = await findRetailer(phone);
    if (!retailer) {
      retailer = await autoProvisionRetailer(phone);
    }

    const session = await lazyIdentitySessionService.createSession({
      realm: "retailer",
      subjectId: retailer.id,
      deviceName: req.header("x-device-name") ?? undefined,
      userAgent: req.header("user-agent") ?? undefined,
    });

    return res.json({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      session: { id: session.session.id, expiresAt: session.session.expiresAt },
      retailer,
    });
  } catch (err) {
    if (err instanceof Msg91Error) {
      return res.status(err.status).json({ error: err.code, details: err.details });
    }
    return res.status(500).json({
      error: "msg91_verification_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
router.post("/msg91", (req, res) => {
  // Alias for /msg91/verify
  return (router as any).handle({ ...req, url: "/msg91/verify" }, res);
});

export default router;
