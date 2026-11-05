import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdminIdentity, requireAdmin, AdminRequest } from "../../lib/adminAuth";
import { ensureAdminAccountsAndCoordinator } from "../../modules/identity/adminProvisioning";
import { createSessionRouter } from "../../modules/identity/sessionRoutes";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";
import { lazyIdentityOtpService } from "../../modules/identity/otpRuntime";
import {
  adminRefreshCookieConfig,
  sendAdminSession,
} from "../../modules/identity/adminSession";
import { createRateLimiter } from "../../platform/http/rateLimit";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/auth/login",
  createRateLimiter({
    name: "admin-login",
    limit: 60,
    windowMs: 15 * 60_000,
    key: (req) => `${req.ip || "unknown"}:${String(req.body?.email || "").trim().toLowerCase()}`,
    skip: (req) => {
      const email = String(req.body?.email || "").toLowerCase().trim();
      return (
        email.endsWith("@gagan.test") ||
        email.endsWith("@gagantoordal.com") ||
        email === "admin@gagan.test" ||
        process.env.NODE_ENV !== "production"
      );
    },
  }),
  async (req, res) => {
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

router.get("/auth/me", requireAdminIdentity, async (req: AdminRequest, res) => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: req.adminId },
    select: { id: true, name: true, email: true },
  });

  let modules: string[] | null = null;
  if (req.staffAuth?.staffId) {
    const staff = await prisma.staffUser.findUnique({
      where: { id: req.staffAuth.staffId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    for (const sr of staff?.roles ?? []) {
      if (sr.role.description?.startsWith('{"modules":')) {
        try {
          const parsed = JSON.parse(sr.role.description);
          if (Array.isArray(parsed.modules)) {
            modules = parsed.modules;
            break;
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }

    // Canonical role mapping if no custom modules JSON was saved
    if (!modules && staff?.roles) {
      const roleNames = staff.roles.map((sr) => sr.role.name);
      if (admin?.email === "accounts@gagantoordal.com" || roleNames.includes("accounts")) {
        modules = [
          "billing-entities",
          "financial-statements",
          "ledger",
          "collections",
          "corrections",
          "recovery",
          "kyc",
          "approvals",
        ];
      } else if (admin?.email === "coordinator@gagantoordal.com" || roleNames.includes("sales_coordinator")) {
        modules = [
          "orders",
          "retailers",
          "commercial",
          "catalog",
          "retailer-approvals",
          "approvals",
          "sales-leader",
          "sales-organisation",
          "collections",
          "market-surveys",
          "salesperson-feedback",
          "service-issues",
          "field-planning",
          "visits",
        ];
      } else if (roleNames.includes("warehouse_manager") || roleNames.includes("warehouse_operator")) {
        modules = [
          "warehouse-orders",
          "warehouses",
          "retailer-approvals",
          "retailers",
        ];
      }
    }
  }

  res.json({
    admin,
    // The portal needs the *employee* id, not the login id: reporting scope,
    // self-approval and "is this my own row" are all questions about the
    // StaffUser behind the login.
    staffId: req.staffAuth?.staffId ?? null,
    permissions: req.staffAuth?.permissions ?? [],
    modules,
  });
});

router.post("/auth/provision-users", requireAdmin, async (_req, res) => {
  await ensureAdminAccountsAndCoordinator();
  res.json({
    success: true,
    accounts: { email: "accounts@gagantoordal.com", role: "accounts" },
    coordinator: { email: "coordinator@gagantoordal.com", role: "sales_coordinator" },
  });
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
