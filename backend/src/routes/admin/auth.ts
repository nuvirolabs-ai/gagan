import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../lib/adminAuth";
import { createSessionRouter } from "../../modules/identity/sessionRoutes";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";
import { lazyIdentityOtpService } from "../../modules/identity/otpRuntime";
import {
  adminRefreshCookieConfig,
  sendAdminSession,
} from "../../modules/identity/adminSession";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  // Same message either way so the response can't be used to enumerate accounts.
  if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }

  const staff = await prisma.staffUser.findUnique({
    where: { adminUserId: admin.id },
    select: { id: true },
  });
  if (!staff) return res.status(401).json({ error: "Incorrect email or password" });

  const session = await lazyIdentitySessionService.createSession({
    realm: "admin",
    subjectId: staff.id,
    deviceName: req.header("x-device-name") ?? "Admin browser",
    userAgent: req.header("user-agent") ?? undefined,
  });

  sendAdminSession(res, session, {
    id: admin.id,
    name: admin.name,
    email: admin.email,
  });
});

router.get("/auth/me", requireAdmin, async (req: AdminRequest, res) => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: req.adminId },
    select: { id: true, name: true, email: true },
  });
  res.json({ admin, permissions: req.staffAuth?.permissions ?? [] });
});

router.use(
  "/auth",
  createSessionRouter({
    realm: "admin",
    sessions: lazyIdentitySessionService,
    otpService: lazyIdentityOtpService,
    refreshCookie: adminRefreshCookieConfig(),
    resolvePhone: async (staffId) => {
      const staff = await prisma.staffUser.findUniqueOrThrow({
        where: { id: staffId },
        select: { phone: true },
      });
      return staff.phone;
    },
  })
);

export default router;
