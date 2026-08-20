import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken, requireAuth, AuthedRequest } from "../lib/auth";

const router = Router();
const MOCK_OTP = process.env.MOCK_OTP || "123456";

const phoneSchema = z.object({ phone: z.string().min(10).max(15) });

router.post("/otp/request", async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid phone" });

  const retailer = await prisma.retailer.findUnique({ where: { phone: parsed.data.phone } });
  if (!retailer) return res.status(404).json({ error: "No retailer registered with this phone" });

  console.log(`[mock OTP] ${parsed.data.phone} -> ${MOCK_OTP}`);
  res.json({ ok: true, message: "OTP sent (mocked)" });
});

const verifySchema = z.object({ phone: z.string().min(10).max(15), otp: z.string() });

router.post("/otp/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  if (parsed.data.otp !== MOCK_OTP) {
    return res.status(401).json({ error: "Incorrect OTP" });
  }

  const retailer = await prisma.retailer.findUnique({ where: { phone: parsed.data.phone } });
  if (!retailer) return res.status(404).json({ error: "No retailer registered with this phone" });

  const token = signToken(retailer.id);
  res.json({
    token,
    retailer: { id: retailer.id, name: retailer.name, phone: retailer.phone },
  });
});

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
