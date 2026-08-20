import { Router } from "express";
import { prisma } from "../lib/prisma";
import { signToken, requireAuth, AuthedRequest } from "../lib/auth";
import { normalizeIndianPhone } from "../modules/identity/otpService";
import { lazyIdentityOtpService } from "../modules/identity/otpRuntime";
import { createOtpRouter } from "../modules/identity/otpRoutes";

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
    issueIdentity: async (retailer) => ({
      token: signToken(retailer.id),
      retailer,
    }),
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
